import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createRateLimiter } from '@/lib/rate-limit'
import { cityAcceptsWaitlist, parseWaitlist } from '@/lib/waitlist/schema'

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
    return NextResponse.json({ error: 'Revisa el correo y acepta el aviso de privacidad' }, { status: 400 })
  }

  const { citySlug, email, name, role } = parsed.data
  try {
    const city = await prisma.cityConfig.findUnique({ where: { slug: citySlug }, select: { status: true } })
    if (!city || !cityAcceptsWaitlist(city.status)) {
      return NextResponse.json({ error: 'Esta ciudad no tiene lista de espera' }, { status: 400 })
    }

    const now = new Date()
    await prisma.cityWaitlist.upsert({
      where: { citySlug_email: { citySlug, email } },
      create: { citySlug, email, name, role, consentAt: now, source: 'city_page' },
      update: { ...(name ? { name } : {}), role, consentAt: now },
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
