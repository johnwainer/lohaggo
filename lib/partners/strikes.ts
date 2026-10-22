/**
 * Operational strikes of a partner: what they did to a booking without a guarantee claim (did not confirm in
 * time, cancelled a confirmed booking less than 24 h before). Stored as BookingEvents of type «followup»
 * whose text starts with STRIKE_PREFIX (only the team sees them) and counted together with the guarantee
 * strikes: the same window and consequences (pause at STRIKES_TO_PAUSE, review at STRIKES_TO_REVIEW_SUSPENSION).
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications/notificationService'
import { setPartnerAvailability } from '@/lib/ops/platform-ops'
import { APP_ORIGIN, originColumns } from '@/lib/ops/origin'
import { STRIKE_WINDOW_DAYS, STRIKES_TO_PAUSE, strikeConsequence } from '@/lib/guarantee/policy'

const logger = createLogger('partner-strikes')
const DAY = 24 * 3600_000

export const STRIKE_PREFIX = 'Falta del socio: '

export const OPERATIONAL_STRIKE = {
  unconfirmed: 'no confirmó la reserva antes de la hora del servicio',
  late_cancel: 'canceló una reserva confirmada con menos de 24 horas',
} as const
export type OperationalStrike = keyof typeof OPERATIONAL_STRIKE

/** Hours before the service under which a partner's cancellation of a confirmed booking is a strike. */
export const LATE_CANCEL_HOURS = 24

/** Operational strikes per partner since `since`. */
export async function operationalStrikes(partnerIds: string[] | null, since: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (partnerIds && !partnerIds.length) return out
  // A failed count never blocks a guarantee decision: it only adds the operational strikes it can read
  let rows: Array<{ booking: { partnerId: string | null } }> = []
  try {
    rows = await prisma.bookingEvent.findMany({
      where: { type: 'followup', detail: { startsWith: STRIKE_PREFIX }, createdAt: { gte: since }, booking: partnerIds ? { partnerId: { in: partnerIds } } : { partnerId: { not: null } } },
      select: { booking: { select: { partnerId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })
    if (rows.length === 5000) logger.warn('Operational strikes capped at 5000 rows', { since })
  } catch (err) {
    logger.warn('Operational strikes not read', { err: err instanceof Error ? err.message : err })
  }
  for (const r of rows) {
    const id = r.booking.partnerId
    if (id) out.set(id, (out.get(id) ?? 0) + 1)
  }
  return out
}

/**
 * Records one operational strike (at most one per booking) and applies the consequence of the partner's
 * total in the window. Never throws: the booking change already happened.
 */
export async function recordOperationalStrike(b: { id: string; partnerId: string | null; partnerUserId: string | null; service: string }, kind: OperationalStrike, now = new Date()) {
  try {
    if (!b.partnerId) return null
    const already = await prisma.bookingEvent.findFirst({ where: { bookingId: b.id, type: 'followup', detail: { startsWith: STRIKE_PREFIX } }, select: { id: true } })
    if (already) return null
    await prisma.bookingEvent.create({ data: { bookingId: b.id, type: 'followup', actorType: 'system', ...originColumns(APP_ORIGIN), detail: `${STRIKE_PREFIX}${OPERATIONAL_STRIKE[kind]}` } })

    const { partnerStrikes } = await import('@/lib/guarantee/ops')
    const strikes = await partnerStrikes(b.partnerId, now)
    const consequence = strikeConsequence(strikes)
    if (consequence !== 'none') {
      await setPartnerAvailability(b.partnerId, false)
      await prisma.adminSupportCase.create({
        data: {
          userId: b.partnerUserId, role: 'PARTNER', bookingId: b.id, priority: consequence === 'review_suspension' ? 'CRITICAL' : 'HIGH', status: 'OPEN', queue: 'GUARANTEE',
          subject: consequence === 'review_suspension' ? `Decidir suspensión del socio (${strikes} faltas en ${STRIKE_WINDOW_DAYS} días)` : `Revisión del socio: ${strikes} faltas en ${STRIKE_WINDOW_DAYS} días (pausado)`,
          description: `Última falta: ${OPERATIONAL_STRIKE[kind]} (reserva #${b.id.slice(-6)}). Se pausó su disponibilidad automáticamente. ${consequence === 'review_suspension' ? 'El equipo decide si suspende la cuenta (no es automático).' : 'Revisar el caso antes de reactivarlo.'}`,
          slaDueAt: new Date(now.getTime() + DAY),
        },
      }).catch(() => null)
    }
    if (b.partnerUserId) {
      await createNotification({
        userId: b.partnerUserId,
        type: 'BOOKING_CANCELLED',
        title: consequence === 'none' ? 'Se registró una falta en tu cuenta' : 'Tu disponibilidad quedó en pausa',
        message: consequence === 'none'
          ? `Reserva #${b.id.slice(-6)} de ${b.service}: ${OPERATIONAL_STRIKE[kind]}. Con ${STRIKES_TO_PAUSE} faltas en ${STRIKE_WINDOW_DAYS} días tu cuenta se pausa.`
          : `Acumulas ${strikes} faltas en ${STRIKE_WINDOW_DAYS} días: pausamos tu disponibilidad mientras el equipo revisa tu caso.`,
        data: { bookingId: b.id, kind: 'OPERATIONAL_STRIKE' },
      }).catch(() => null)
    }
    return { strikes, consequence }
  } catch (err) {
    logger.warn('Operational strike not recorded', { bookingId: b.id, err: err instanceof Error ? err.message : err })
    return null
  }
}
