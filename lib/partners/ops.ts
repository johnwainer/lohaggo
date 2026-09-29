import { City, DocumentType, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { validateUploadedFile } from '@/lib/file-validation'
import { createNotification } from '@/lib/notifications/notificationService'
import { findColombiaBankByName } from '@/lib/banking/catalog'
import { normalizeAccountNumber, normalizeHolderDocumentNumber, validateColombianBankAccount, type BankAccountInput } from '@/lib/banking/validate'
import { setPartnerAvailability } from '@/lib/ops/platform-ops'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isTrustedAttachmentUrl } from '@/lib/messaging/attachments'
import { OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { dateOnlyUtc, formatBookingWhen } from '@/lib/bookings/when'

/**
 * Partner (socio) operations shared by /api/partner/* and the inbox AI agents. They load, validate and
 * throw OpsError in Spanish; they do not check the session nor write the audit log (the caller does).
 */

const logger = createLogger('partners-ops')

export const MAX_ACTIVE_SERVICES = 5

export const IDENTITY_DOCUMENT_TYPES: DocumentType[] = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

/** A verification document counts while it is approved or waiting for review. */
const COUNTS_AS_PRESENT = ['APPROVED', 'PENDING']

export const partnerInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
  services: { include: { service: { include: { category: true } } }, orderBy: { createdAt: 'asc' } },
  documents: { orderBy: { createdAt: 'desc' } },
  bankAccounts: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
} satisfies Prisma.PartnerProfileInclude

export type PartnerWithRelations = Prisma.PartnerProfileGetPayload<{ include: typeof partnerInclude }>

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

// ─── Loading ────────────────────────────────────────────────────────────────

/** The partner profile of a user, with everything the chat and the panel show. 403 when they are not a partner. */
export async function partnerByUser(userId: string): Promise<PartnerWithRelations> {
  const partner = await prisma.partnerProfile.findUnique({ where: { userId }, include: partnerInclude })
  if (!partner) throw new OpsError('No eres socio', 403)
  return partner
}

/** PartnerProfile.id (and city) for an actor: the one on the actor, else the profile of their user. */
async function requirePartner(actor: Actor) {
  const where = actor.partnerId ? { id: actor.partnerId } : { userId: actor.userId }
  const partner = await prisma.partnerProfile.findUnique({ where, select: { id: true, userId: true, city: true } })
  if (!partner || partner.userId !== actor.userId) throw new OpsError('No eres socio', 403)
  return partner
}

async function loadPlatformConfig() {
  return (await prisma.platformConfig.findFirst({ where: { key: 'default' } })) || (await prisma.platformConfig.findFirst({ orderBy: { createdAt: 'asc' } }))
}

// ─── Documents that are missing ─────────────────────────────────────────────

export type MissingDocument = { key: 'IDENTIDAD' | 'ANTECEDENTES'; label: string; accepts: DocumentType[] }

/**
 * What the partner still has to upload to get verified: an identity document (any of the identity types)
 * and the background check. A type is covered when a document of it is APPROVED or PENDING.
 */
export function missingDocuments(partner: { documents: Array<{ type: DocumentType; status: string }> }): MissingDocument[] {
  const present = partner.documents.filter((d) => COUNTS_AS_PRESENT.includes(d.status)).map((d) => d.type)
  const missing: MissingDocument[] = []
  if (!IDENTITY_DOCUMENT_TYPES.some((t) => present.includes(t))) {
    missing.push({ key: 'IDENTIDAD', label: 'documento de identidad (cédula, cédula de extranjería, pasaporte o PEP)', accepts: IDENTITY_DOCUMENT_TYPES })
  }
  if (!present.includes('ANTECEDENTES')) missing.push({ key: 'ANTECEDENTES', label: 'certificado de antecedentes', accepts: ['ANTECEDENTES'] })
  return missing
}

// ─── Status summary for the chat ────────────────────────────────────────────

const BOOKING_LABEL: Record<string, string> = { PENDING: 'pendiente de confirmar', CONFIRMED: 'confirmada', IN_PROGRESS: 'en curso' }
const DOC_LABEL: Record<DocumentType, string> = {
  CEDULA_CIUDADANIA: 'cédula de ciudadanía', CEDULA_EXTRANJERIA: 'cédula de extranjería', PASAPORTE: 'pasaporte', PEP: 'PEP',
  DIPLOMA_BACHILLERATO: 'diploma de bachillerato', DIPLOMA_TECNICO: 'diploma técnico', DIPLOMA_TECNOLOGO: 'diploma tecnólogo',
  DIPLOMA_PROFESIONAL: 'diploma profesional', DIPLOMA_POSGRADO: 'diploma de posgrado', CERTIFICADO_CURSO: 'certificado de curso',
  ANTECEDENTES: 'antecedentes', CAMARA_COMERCIO: 'cámara de comercio',
}

/** Plain Spanish text for the agent: verification, availability, services, next bookings, pending money. */
export async function partnerStatusSummary(partnerId: string): Promise<string> {
  const partner = await prisma.partnerProfile.findUnique({ where: { id: partnerId }, include: partnerInclude })
  if (!partner) throw new OpsError('Socio no encontrado', 404)

  const now = new Date()
  const [bookings, pendingPayments, pendingPayouts] = await Promise.all([
    prisma.booking.findMany({
      where: { partnerId, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledDate: { gte: dateOnlyUtc(now) } },
      orderBy: { scheduledDate: 'asc' },
      take: 3,
      select: { id: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true, service: { select: { name: true } }, user: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { booking: { partnerId }, confirmationStatus: 'CLIENT_REPORTED' },
      select: { bookingId: true, amount: true, clientReportedMethod: true },
    }),
    prisma.payout.findMany({ where: { partnerId, status: { in: ['PENDING', 'PROCESSING'] } }, select: { netAmount: true, status: true } }),
  ])

  const lines: string[] = []

  if (partner.verified) {
    lines.push('Verificación: verificado.')
  } else {
    const missing = missingDocuments(partner)
    const rejected = partner.documents.filter((d) => d.status === 'REJECTED')
    const pending = partner.documents.filter((d) => d.status === 'PENDING')
    const parts = ['Verificación: pendiente.']
    if (missing.length) parts.push(`Falta subir: ${missing.map((m) => m.label).join(' y ')}.`)
    if (pending.length) parts.push(`En revisión: ${pending.map((d) => DOC_LABEL[d.type]).join(', ')}.`)
    if (rejected.length) parts.push(`Rechazados: ${rejected.map((d) => `${DOC_LABEL[d.type]}${d.rejectionReason ? ` (${d.rejectionReason})` : ''}`).join('; ')}.`)
    lines.push(parts.join(' '))
  }

  lines.push(`Disponibilidad: ${partner.isAvailable ? 'disponible, recibe solicitudes nuevas' : 'no disponible, no recibe solicitudes nuevas'}.`)

  const active = partner.services.filter((s) => s.active)
  lines.push(active.length
    ? `Servicios activos (${active.length} de ${MAX_ACTIVE_SERVICES}): ${active.map((s) => `${s.service.name} a ${money(s.price)}`).join(', ')}.`
    : 'Servicios activos: ninguno.')

  lines.push(bookings.length
    ? `Próximas reservas: ${bookings.map((b) => `${b.service.name} con ${b.user.name} el ${formatBookingWhen(b)} (${BOOKING_LABEL[b.status] ?? b.status}, ${money(b.totalPrice)}, ref. ${b.id.slice(-6)})`).join('; ')}.`
    : 'Próximas reservas: ninguna.')

  lines.push(pendingPayments.length
    ? `Pagos por confirmar: ${pendingPayments.length} (${pendingPayments.map((p) => `${money(p.amount)} en ${p.clientReportedMethod === 'CASH' ? 'efectivo' : 'transferencia'}, ref. ${p.bookingId.slice(-6)}`).join('; ')}). El cliente reportó el pago y falta que el socio lo confirme.`
    : 'Pagos por confirmar: ninguno.')

  const payoutTotal = pendingPayouts.reduce((sum, p) => sum + p.netAmount, 0)
  lines.push(pendingPayouts.length
    ? `Pagos de la plataforma pendientes: ${pendingPayouts.length} por ${money(payoutTotal)} en total${partner.bankAccounts.some((a) => a.isActive) ? '' : ' (sin cuenta bancaria registrada: hay que registrar una para recibirlos)'}.`
    : 'Pagos de la plataforma pendientes: ninguno.')

  return lines.join('\n')
}

// ─── Availability ───────────────────────────────────────────────────────────

export async function setAvailability(actor: Actor, isAvailable: boolean, origin: Origin) {
  const partner = await requirePartner(actor)
  const result = await setPartnerAvailability(partner.id, isAvailable)
  logger.info('Partner availability changed', { partnerId: partner.id, isAvailable, via: origin.via })
  return result
}

// ─── Services ───────────────────────────────────────────────────────────────

export type PartnerServiceInput = {
  /** Catalog service id; or `partnerServiceId` of the partner's own row */
  serviceId?: string
  partnerServiceId?: string
  price?: number | string | null
  city?: string | null
  active?: boolean | null
}

/** "Bogotá" → BOGOTA; null when the text is not a City the platform serves. */
export function parseCity(text: string | null | undefined): City | null {
  if (!text?.trim()) return null
  const key = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/\s+/g, '_')
  return key in City ? (key as City) : null
}

const serviceInclude = { service: { include: { category: true } } } satisfies Prisma.PartnerServiceInclude

/**
 * Adds a catalog service to the partner or updates its price / city / active flag. Price defaults to the
 * catalog base price, never goes below it and stays within the platform's min/max. At most
 * MAX_ACTIVE_SERVICES active at once.
 */
export async function upsertPartnerService(actor: Actor, input: PartnerServiceInput, origin: Origin) {
  const partner = await requirePartner(actor)

  let existing = input.partnerServiceId
    ? await prisma.partnerService.findUnique({ where: { id: input.partnerServiceId } })
    : null
  if (input.partnerServiceId && (!existing || existing.partnerId !== partner.id)) throw new OpsError('Servicio no encontrado', 404)

  const serviceId = existing?.serviceId ?? input.serviceId
  if (!serviceId) throw new OpsError('serviceId requerido', 400)
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) throw new OpsError('Servicio no encontrado', 404)

  if (!existing) existing = await prisma.partnerService.findUnique({ where: { partnerId_serviceId: { partnerId: partner.id, serviceId } } })

  const price = input.price != null && input.price !== '' ? Number(input.price) : existing?.price ?? service.basePrice
  if (!Number.isFinite(price) || price <= 0) throw new OpsError('Precio inválido', 400)
  if (price < service.basePrice) throw new OpsError(`El precio no puede ser menor al precio base de ${service.name} (${money(service.basePrice)})`, 400)
  const config = await loadPlatformConfig()
  if (config) {
    if (price < config.minServicePrice) throw new OpsError(`El precio mínimo en la plataforma es ${money(config.minServicePrice)}`, 400)
    if (price > config.maxServicePrice) throw new OpsError(`El precio máximo en la plataforma es ${money(config.maxServicePrice)}`, 400)
  }

  let city: City = existing?.city ?? partner.city
  if (input.city != null && String(input.city).trim() !== '') {
    const parsed = parseCity(String(input.city))
    if (!parsed) throw new OpsError(`Ciudad inválida. Opciones: ${Object.values(City).join(', ')}`, 400)
    city = parsed
  }

  const active = input.active ?? existing?.active ?? true
  if (active && !(existing?.active)) {
    const activeCount = await prisma.partnerService.count({ where: { partnerId: partner.id, active: true, ...(existing ? { id: { not: existing.id } } : {}) } })
    if (activeCount >= MAX_ACTIVE_SERVICES) {
      throw new OpsError(`No puedes ofrecer más de ${MAX_ACTIVE_SERVICES} servicios activos. Pausa o elimina uno para agregar otro.`, 400)
    }
  }

  const row = existing
    ? await prisma.partnerService.update({ where: { id: existing.id }, data: { price, city, active }, include: serviceInclude })
    : await prisma.partnerService.create({ data: { partnerId: partner.id, serviceId, price, city, active }, include: serviceInclude })
  logger.info(existing ? 'Partner service updated' : 'Partner service added', { partnerId: partner.id, serviceId, price, city, active, via: origin.via })
  return row
}

/** Pauses one of the partner's services (by catalog service id): it stays with its price but gets no requests. */
export async function pausePartnerService(actor: Actor, serviceId: string, origin: Origin) {
  const partner = await requirePartner(actor)
  const existing = await prisma.partnerService.findUnique({ where: { partnerId_serviceId: { partnerId: partner.id, serviceId } } })
  if (!existing) throw new OpsError('No ofreces ese servicio', 404)
  if (!existing.active) return existing
  const row = await prisma.partnerService.update({ where: { id: existing.id }, data: { active: false }, include: serviceInclude })
  logger.info('Partner service paused', { partnerId: partner.id, serviceId, via: origin.via })
  return row
}

/** Removes a partner service row (its availability slots go with it by cascade). */
export async function removePartnerService(actor: Actor, partnerServiceId: string) {
  const partner = await requirePartner(actor)
  const existing = await prisma.partnerService.findUnique({ where: { id: partnerServiceId } })
  if (!existing || existing.partnerId !== partner.id) throw new OpsError('Servicio no encontrado', 404)
  await prisma.partnerService.delete({ where: { id: partnerServiceId } })
  return { success: true as const }
}

// ─── Bank accounts ──────────────────────────────────────────────────────────

export type AddBankAccountInput = BankAccountInput & {
  city?: string | null
  branchCode?: string | null
  mercadoPagoRecipientId?: string | null
}

/** Registers a payout account. The first active one becomes the default. 409 when the number is already registered. */
export async function addBankAccount(actor: Actor, input: AddBankAccountInput, origin: Origin) {
  const partner = await requirePartner(actor)

  const bank = await findColombiaBankByName(input.bankName || '')
  const problem = validateColombianBankAccount(input, bank)
  if (problem) throw new OpsError(problem, 400)

  const accountNumber = normalizeAccountNumber(input.accountNumber)
  const holderDocumentNumber = normalizeHolderDocumentNumber(input.holderDocumentType, input.holderDocumentNumber)

  const duplicate = await prisma.partnerBankAccount.findFirst({ where: { partnerId: partner.id, accountNumber, isActive: true }, select: { id: true } })
  if (duplicate) throw new OpsError('Esta cuenta ya está registrada', 409)

  const hasDefault = await prisma.partnerBankAccount.findFirst({ where: { partnerId: partner.id, isDefault: true, isActive: true }, select: { id: true } })

  const account = await prisma.partnerBankAccount.create({
    data: {
      partnerId: partner.id,
      bankName: bank!.name,
      accountType: input.accountType,
      accountNumber,
      accountHolderName: input.accountHolderName.trim(),
      holderDocumentType: input.holderDocumentType,
      holderDocumentNumber,
      city: input.city?.trim() || null,
      branchCode: input.branchCode?.trim() || null,
      mercadoPagoRecipientId: input.mercadoPagoRecipientId?.trim() || null,
      isDefault: !hasDefault,
      isActive: true,
      ...originColumns(origin),
    },
  })
  logger.info('Partner bank account added', { partnerId: partner.id, accountId: account.id, via: origin.via })
  return account
}

// ─── Verification documents ─────────────────────────────────────────────────

export type UploadDocumentInput = {
  type: DocumentType | string
  file: { buffer: Buffer; mime: string; name: string }
  partnerServiceId?: string | null
}

export function parseDocumentType(value: string | null | undefined): DocumentType | null {
  if (!value) return null
  const key = value.trim().toUpperCase()
  return key in DocumentType ? (key as DocumentType) : null
}

/** Uploads a verification document to Cloudinary and records it as PENDING; the partner gets a notification. */
/** Review queue path the admin notification opens. */
export const DOCUMENT_REVIEW_PATH = '/admin/documents'

/** Tells every active admin there is a document to review (in-app + push). Never fails the upload. */
async function notifyAdminsOfNewDocument(partnerId: string, documentId: string) {
  try {
    const [admins, profile] = await Promise.all([
      prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
      prisma.partnerProfile.findUnique({ where: { id: partnerId }, select: { user: { select: { name: true } } } }),
    ])
    const name = profile?.user.name?.trim() || 'socio'
    await Promise.all(admins.map((a) => createNotification({
      userId: a.id,
      type: 'DOCUMENT_APPROVED',
      title: `Nuevo documento para revisar · ${name}`,
      message: `${name} subió un documento de verificación. Revísalo en la cola de documentos.`,
      data: { url: DOCUMENT_REVIEW_PATH, partnerId, documentId, kind: 'DOCUMENT_REVIEW_ADMIN_ALERT' },
      channels: ['PUSH'],
    }).catch(() => null)))
  } catch (err) {
    logger.warn('Admin document alert failed (non-fatal)', { partnerId, documentId, err })
  }
}

export async function uploadDocument(actor: Actor, input: UploadDocumentInput, origin: Origin) {
  const partner = await requirePartner(actor)

  const type = parseDocumentType(String(input.type))
  if (!type) throw new OpsError(`Tipo de documento inválido. Opciones: ${Object.values(DocumentType).join(', ')}`, 400)
  if (!input.file?.buffer?.length) throw new OpsError('Archivo y tipo son requeridos', 400)

  const file = new File([new Uint8Array(input.file.buffer)], input.file.name || 'documento', { type: input.file.mime || 'application/octet-stream' })
  const check = await validateUploadedFile(file)
  if (!check.ok) throw new OpsError(check.error, 400)

  if (input.partnerServiceId) {
    const ps = await prisma.partnerService.findFirst({ where: { id: input.partnerServiceId, partnerId: partner.id }, select: { id: true } })
    if (!ps) throw new OpsError('Servicio inválido', 400)
  }

  // Image resource type for everything (PDFs too) so pg_1.jpg transformations can serve PDFs as images
  const { url, publicId } = await cloudinaryService.upload(file, 'lohaggo/documents', 'image')

  const document = await prisma.verificationDocument.create({
    data: {
      partnerId: partner.id,
      type,
      documentUrl: url,
      publicId,
      ...(input.partnerServiceId ? { partnerServiceId: input.partnerServiceId } : {}),
      ...originColumns(origin),
    },
  })

  const { waDocumentUploaded } = await import('@/lib/messaging/wa-events')
  await waDocumentUploaded(document.id, origin)
  await createNotification({
    userId: partner.userId,
    type: 'DOCUMENT_APPROVED',
    title: 'Documento subido',
    message: `Tu documento ${type} ha sido subido y está en revisión`,
  })
  await notifyAdminsOfNewDocument(partner.id, document.id)
  logger.info('Verification document uploaded', { partnerId: partner.id, documentId: document.id, type, via: origin.via })
  return document
}

export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024
const ATTACHMENT_MIMES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

function isTwilioMediaUrl(url: string) {
  return url.startsWith('https://api.twilio.com/') || url.startsWith('https://media.twiliocdn.com/')
}

function isMetaMediaUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com)$/i.test(hostname)
  } catch {
    return false
  }
}

/**
 * Downloads an attachment a person sent in the inbox so it can be uploaded as a document. Twilio media
 * needs basic auth (account SID : auth token); Meta's CDN and our own storage go without. Only images and
 * PDFs up to 8 MB.
 */
export async function fetchAttachmentForDocument(url: string): Promise<{ buffer: Buffer; mime: string; name: string }> {
  const twilio = isTwilioMediaUrl(url)
  if (!twilio && !isMetaMediaUrl(url) && !isTrustedAttachmentUrl(url)) throw new OpsError('El adjunto no viene de un origen conocido', 400)

  const headers: Record<string, string> = {}
  if (twilio) {
    const conf = (await getMessagingProviderRuntimeConfig()).twilio?.config
    const sid = conf?.accountSid || process.env.TWILIO_ACCOUNT_SID
    const token = conf?.authToken || process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) throw new OpsError('Twilio no está configurado para descargar adjuntos', 500)
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
  }

  const res = await fetch(url, { headers })
  if (!res.ok) throw new OpsError(`No se pudo descargar el adjunto (${res.status})`, 502)

  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > ATTACHMENT_MAX_BYTES) throw new OpsError('El adjunto supera 8 MB', 400)
  const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const ext = ATTACHMENT_MIMES[mime]
  if (!ext) throw new OpsError('Solo se aceptan imágenes (JPG, PNG, WebP) o PDF', 400)

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > ATTACHMENT_MAX_BYTES) throw new OpsError('El adjunto supera 8 MB', 400)
  if (!buffer.length) throw new OpsError('El adjunto está vacío', 400)

  let name = `adjunto.${ext}`
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) name = last.slice(0, 120)
  } catch {
    // keep the default name
  }
  return { buffer, mime, name }
}
