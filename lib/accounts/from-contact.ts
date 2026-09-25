import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { City, type UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendWelcomePartner } from '@/lib/messaging/whatsapp-templates'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isPlaceholderName, syncConversationsFromContact, toE164 } from '@/lib/inbox/contacts'

const logger = createLogger('accounts-from-contact')

/** The access link is the only way in: the person sets their own password, nobody on the team sees one. */
export const ACCESS_LINK_TTL_HOURS = 72
export const MAX_PARTNER_SERVICES = 5

export type AccountRole = Extract<UserRole, 'CLIENT' | 'PARTNER'>

export type CreateAccountInput = {
  contactId: string
  role: AccountRole
  name: string
  email: string
  phone?: string | null
  /** Partners only: CityConfig slug and up to 5 service ids */
  citySlug?: string | null
  serviceIds?: string[]
  createdBy: { type: 'user' | 'ai'; id: string; name: string }
}

export type CreateAccountResult =
  | { ok: true; userId: string; role: AccountRole; accessUrl: string; expiresAt: Date }
  | { ok: false; code: 'already_linked' | 'email_taken' | 'invalid' | 'no_contact'; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCityName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '_')
}

/** Pure validation, shared by the inbox form and the AI tool. */
export function validateAccountInput(input: { name: string; email: string; phone?: string | null; role: string; serviceIds?: string[] }) {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const email = input.email.trim().toLowerCase()
  if (name.length < 2) return { ok: false as const, error: 'El nombre debe tener al menos 2 caracteres' }
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: 'Correo inválido' }
  if (input.role !== 'CLIENT' && input.role !== 'PARTNER') return { ok: false as const, error: 'Rol no válido' }
  const phone = input.phone ? toE164(input.phone) : null
  if (input.phone && !phone) return { ok: false as const, error: 'Teléfono inválido' }
  if (input.role === 'PARTNER' && (!input.serviceIds?.length || input.serviceIds.length > MAX_PARTNER_SERVICES)) {
    return { ok: false as const, error: `Un socio necesita entre 1 y ${MAX_PARTNER_SERVICES} servicios` }
  }
  return { ok: true as const, name, email, phone }
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')
}

/** Single-use access link (MagicToken) that asks the person to set their password on first entry. */
export async function createAccessLink(userId: string, role: AccountRole) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ACCESS_LINK_TTL_HOURS * 3600_000)
  await prisma.magicToken.create({
    data: { userId, token, redirectUrl: role === 'PARTNER' ? '/partner/verification' : '/dashboard', requirePasswordChange: true, expiresAt },
  })
  return { url: `${appUrl()}/auth/magic?token=${token}`, expiresAt }
}

/**
 * Creates a platform account for an inbox contact and links it. Same side effects as public
 * registration (welcome automations, partner profile unverified with services at base price), but
 * with an unknowable random password: access is only through the link sent to the person.
 */
export async function createAccountFromContact(input: CreateAccountInput): Promise<CreateAccountResult> {
  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } })
  if (!contact) return { ok: false, code: 'no_contact', error: 'Contacto no encontrado' }
  if (contact.userId) return { ok: false, code: 'already_linked', error: 'Este contacto ya tiene una cuenta vinculada' }

  const valid = validateAccountInput({ ...input, phone: input.phone ?? contact.phone })
  if (!valid.ok) return { ok: false, code: 'invalid', error: valid.error }

  const taken = await prisma.user.findUnique({ where: { email: valid.email }, select: { id: true } })
  if (taken) return { ok: false, code: 'email_taken', error: 'Ya existe una cuenta con ese correo' }

  let city: City = City.MEDELLIN
  let services: Array<{ id: string; basePrice: number }> = []
  if (input.role === 'PARTNER') {
    if (input.citySlug) {
      const cityRecord = await prisma.cityConfig.findUnique({ where: { slug: input.citySlug } })
      const cityName = cityRecord ? normalizeCityName(cityRecord.name) : ''
      if (!cityRecord || !(cityName in City)) return { ok: false, code: 'invalid', error: 'Ciudad no válida' }
      city = cityName as City
    }
    services = await prisma.service.findMany({ where: { id: { in: (input.serviceIds || []).slice(0, MAX_PARTNER_SERVICES) } }, select: { id: true, basePrice: true } })
    if (!services.length) return { ok: false, code: 'invalid', error: 'Servicios no válidos' }
  }

  const password = await bcrypt.hash(randomBytes(24).toString('base64url'), 10)
  const user = await prisma.user.create({
    data: {
      email: valid.email,
      name: valid.name,
      phone: valid.phone,
      password,
      role: input.role,
      // Created from an inbox conversation: that is where the person came from
      acquisition: { source: 'inbox', medium: 'conversation', campaign: null, content: null, term: null, referrer: null, landing: null, at: new Date().toISOString() },
      ...(input.role === 'PARTNER' ? { partnerProfile: { create: { bio: '', rating: 0, totalReviews: 0, verified: false, city } } } : {}),
    },
    include: { partnerProfile: { select: { id: true } } },
  })
  if (input.role === 'PARTNER' && user.partnerProfile) {
    await prisma.partnerService.createMany({
      data: services.map((s) => ({ partnerId: user.partnerProfile!.id, serviceId: s.id, price: s.basePrice, city, active: true })),
      skipDuplicates: true,
    })
  }

  // The contact takes the account and the data it just got
  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      userId: user.id,
      email: contact.email || valid.email,
      name: isPlaceholderName(contact.name) ? valid.name : contact.name,
      ...(!contact.phone && valid.phone ? { phone: valid.phone } : {}),
    },
  })
  await syncConversationsFromContact(updated)

  const { url, expiresAt } = await createAccessLink(user.id, input.role)

  // Same automations as the public registration
  scheduleAutomationsForUser(user.id, input.role === 'PARTNER' ? 'PARTNER_REGISTERED' : 'CLIENT_REGISTERED').catch(() => null)
  if (input.role === 'PARTNER') {
    if (valid.phone) sendWelcomePartner(valid.phone, valid.name).catch((err) => logger.warn('Welcome WA failed', { userId: user.id, err }))
    scheduleAutomationsForUser(user.id, 'PARTNER_DOCS_REMINDER').catch(() => null)
    scheduleAutomationsForUser(user.id, 'PARTNER_REFERRAL_REMINDER').catch(() => null)
  } else {
    scheduleAutomationsForUser(user.id, 'CLIENT_FIRST_BOOKING_NUDGE').catch(() => null)
    scheduleAutomationsForUser(user.id, 'CLIENT_REFERRAL_REMINDER').catch(() => null)
  }

  // Visible fact in every conversation of the contact
  const conversations = await prisma.conversation.findMany({ where: { contactId: contact.id }, select: { id: true, workspaceId: true } })
  const roleLabel = input.role === 'PARTNER' ? 'socio' : 'cliente'
  for (const c of conversations) {
    await prisma.conversationEvent.create({
      data: {
        conversationId: c.id, type: 'account_created', actorType: input.createdBy.type, actorId: input.createdBy.id,
        actorName: input.createdBy.name, detail: `Cuenta de ${roleLabel} creada (${valid.email})`,
      },
    })
    emitInboxEvent({ type: 'status-update', conversationId: c.id, workspaceId: c.workspaceId })
  }
  logger.info('Account created from inbox contact', { userId: user.id, role: input.role, by: input.createdBy.type })
  return { ok: true, userId: user.id, role: input.role, accessUrl: url, expiresAt }
}

export function accessLinkMessage(name: string, role: AccountRole, url: string) {
  const first = name.split(' ')[0]
  return role === 'PARTNER'
    ? `${first}, ya creamos tu cuenta de socio en LoHaggo. Entra con este enlace para crear tu contraseña y subir tus documentos de verificación (vale ${ACCESS_LINK_TTL_HOURS} horas): ${url}`
    : `${first}, ya creamos tu cuenta en LoHaggo. Entra con este enlace para crear tu contraseña (vale ${ACCESS_LINK_TTL_HOURS} horas): ${url}`
}

/** Emails the access link: whoever opens it proves they own the address. */
export async function emailAccessLink(email: string, name: string, role: AccountRole, url: string) {
  const runtime = await getMessagingProviderRuntimeConfig()
  if (!runtime.sendgrid?.active) return { ok: false as const, error: 'Correo no configurado' }
  const first = name.split(' ')[0]
  const body = [
    `Hola ${first},`,
    '',
    role === 'PARTNER'
      ? 'Creamos tu cuenta de socio en LoHaggo. Entra con este enlace para crear tu contraseña y subir tus documentos de verificación:'
      : 'Creamos tu cuenta en LoHaggo. Entra con este enlace para crear tu contraseña:',
    '',
    `<a href="${url}">${url}</a>`,
    '',
    `El enlace vale ${ACCESS_LINK_TTL_HOURS} horas y solo se puede usar una vez. Si no pediste esta cuenta, ignora este correo.`,
  ].join('<br>')
  const res = await sendMessageViaProvider({ channel: 'EMAIL', to: email, subject: 'Tu cuenta en LoHaggo', body }, runtime)
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.errorMessage || 'No se pudo enviar el correo' }
}

/** Existing-account check without creating anything (used before creating from an unverified chat). */
export async function emailProviderReady() {
  const runtime = await getMessagingProviderRuntimeConfig()
  return Boolean(runtime.sendgrid?.active)
}

function fold(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Maps what a person says in a chat ("Medellín", "plomería y pintura") to a city slug and catalog
 * service ids. Exact name first, then a name that contains / is contained in what was said.
 */
export async function resolvePartnerChoices(cityText: string, serviceNames: string[]) {
  const [cities, services] = await Promise.all([
    prisma.cityConfig.findMany({ where: { status: { in: ['ACTIVE', 'COMING_SOON'] } }, select: { slug: true, name: true } }),
    prisma.service.findMany({ select: { id: true, name: true } }),
  ])
  const c = fold(cityText)
  const city = cities.find((x) => fold(x.name) === c || x.slug === c) ?? cities.find((x) => c && (fold(x.name).includes(c) || c.includes(fold(x.name))))
  const serviceIds: string[] = []
  const unknown: string[] = []
  for (const raw of serviceNames) {
    const n = fold(raw)
    if (!n) continue
    const hit = services.find((x) => fold(x.name) === n) ?? services.find((x) => fold(x.name).includes(n) || n.includes(fold(x.name)))
    if (hit && !serviceIds.includes(hit.id)) serviceIds.push(hit.id)
    else if (!hit) unknown.push(raw)
  }
  return { citySlug: city?.slug ?? null, cityOptions: cities.map((x) => x.name), serviceIds: serviceIds.slice(0, MAX_PARTNER_SERVICES), unknown }
}
