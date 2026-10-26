import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createRateLimiter } from '@/lib/rate-limit'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'
import { formatBookingWhen } from '@/lib/bookings/when'
import { readAppointmentToken } from '@/lib/bookings/appointment-token'
import { applyFollowup, followupViews } from '@/lib/bookings/followups'

export const dynamic = 'force-dynamic'

const logger = createLogger('public-appointment')
const limiter = createRateLimiter({ windowMs: 60_000, max: 20, message: 'Demasiados intentos, espera un minuto.' })

/** What the link's page shows and which answer it sends: the client of the token, nothing else. */
async function load(token: string) {
  const t = readAppointmentToken(token)
  if (!t) throw new OpsError('El enlace venció o no es válido. Entra a LoHaggo para confirmar tu cita.', 404)
  const b = await prisma.booking.findUnique({
    where: { id: t.bookingId },
    select: { id: true, userId: true, status: true, scheduledDate: true, scheduledTime: true, service: { select: { name: true } }, partner: { select: { user: { select: { name: true } } } }, user: { select: { email: true, role: true, isActive: true } } },
  })
  if (!b || b.userId !== t.userId || !b.user?.isActive) throw new OpsError('No encontramos esta cita', 404)
  const actor: Actor = { userId: b.userId, role: 'CLIENT', email: b.user?.email ?? null }
  const view = (await followupViews(actor, [b.id]))[b.id]
  const action: 'here_yes' | 'reconfirm_yes' | null = view?.actions.includes('here_yes') ? 'here_yes' : view?.actions.includes('reconfirm_yes') ? 'reconfirm_yes' : null
  return { b, actor, action, view }
}

/** GET ?token=: the booking summary for the page (no change). */
async function handleGET(request: NextRequest) {
  try {
    const { b, action, view } = await load(request.nextUrl.searchParams.get('token') ?? '')
    return NextResponse.json({
      service: b.service?.name ?? 'Servicio',
      partner: b.partner?.user?.name?.split(' ')[0] ?? 'Tu socio',
      when: formatBookingWhen(b),
      status: b.status,
      action,
      confirmed: view?.info.appointment?.state === 'confirmed' || view?.info.appointment?.departure?.answer === 'waiting',
    })
  } catch (err) {
    if (err instanceof OpsError) return NextResponse.json({ error: err.message }, { status: err.status })
    logger.error('Appointment link failed', err)
    return NextResponse.json({ error: 'No pudimos abrir tu cita' }, { status: 500 })
  }
}

/** POST { token }: the client confirms (or says «aquí estaré» when the partner is leaving). */
async function handlePOST(request: NextRequest) {
  try {
    const parsed = z.object({ token: z.string().min(10).max(600) }).safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 })
    const { b, actor, action } = await load(parsed.data.token)
    if (!action) return NextResponse.json({ message: b.status === 'CONFIRMED' ? 'Tu cita ya está confirmada.' : 'Esta cita ya no necesita confirmación.' })
    return NextResponse.json(await applyFollowup(actor, b.id, action, APP_ORIGIN))
  } catch (err) {
    if (err instanceof OpsError) return NextResponse.json({ error: err.message }, { status: err.status })
    logger.error('Appointment confirm failed', err)
    return NextResponse.json({ error: 'No pudimos confirmar tu cita' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return limiter(request, handleGET)
}

export async function POST(request: NextRequest) {
  return limiter(request, handlePOST)
}
