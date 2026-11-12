import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createRateLimiter } from '@/lib/rate-limit'
import { cityAcceptsWaitlist, parseWaitlist } from '@/lib/waitlist/schema'
import { normalizePhone } from '@/lib/phone'
import { toE164 } from '@/lib/inbox/contacts'
import { placeholderEmail } from '@/lib/accounts/phone-login-core'

const logger = createLogger('public-waitlist')

const waitlistRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos. Por favor, intenta de nuevo en unos minutos.',
})

async function handlePOST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const parsed = parseWaitlist(body)
  // Bots get the same answer as people; nothing is stored
  if (!parsed.ok && parsed.reason === 'honeypot') return NextResponse.json({ ok: true })
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Revisa tu WhatsApp o correo y acepta el aviso de privacidad' }, { status: 400 })
  }

  const { citySlug, name, role, serviceSlug } = parsed.data
  const phone = parsed.data.phone ? toE164(normalizePhone(parsed.data.phone)) : null
  if (parsed.data.phone && !phone) return NextResponse.json({ error: 'Revisa el número de WhatsApp' }, { status: 400 })
  // WhatsApp only: an internal address that never receives mail keeps the (city, email) key unique per number
  const email = parsed.data.email || (phone ? placeholderEmail(phone) : null)
  if (!email) return NextResponse.json({ error: 'Escribe tu correo o tu WhatsApp' }, { status: 400 })
  const source = serviceSlug ? `service:${serviceSlug}` : 'city_page'
  try {
    const city = await prisma.cityConfig.findUnique({ where: { slug: citySlug }, select: { status: true, partnerRegistry: true } })
    if (!city || !cityAcceptsWaitlist(city.status, city.partnerRegistry, Boolean(serviceSlug))) {
      return NextResponse.json({ error: 'Esta ciudad no tiene lista de espera' }, { status: 400 })
    }

    const now = new Date()
    await prisma.cityWaitlist.upsert({
      where: { citySlug_email: { citySlug, email } },
      create: { citySlug, email, name, role, consentAt: now, source, ...(phone ? { phone, phoneConsentAt: now } : {}) },
      update: { ...(name ? { name } : {}), role, consentAt: now, ...(serviceSlug ? { source } : {}), ...(phone ? { phone, phoneConsentAt: now } : {}) },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error saving waitlist entry', error || undefined)
    return NextResponse.json({ error: 'No pudimos guardar tu registro. Intenta de nuevo.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return waitlistRateLimiter(request, handlePOST)
}
