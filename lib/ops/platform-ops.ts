import type { AdminIncidentStatus, AdminSeverity } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'

/**
 * Platform operations shared by admin routes and Haggo. No permission checks nor audit here: the caller
 * does both.
 */

export class PlatformOpsError extends Error {}

const SEVERITIES: AdminSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUSES: AdminIncidentStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED']

// ─── Incidents ──────────────────────────────────────────────────────────────

export async function openIncident(input: { type: string; title: string; description?: string | null; severity?: string; source?: string; route?: string | null }) {
  const severity = SEVERITIES.includes(input.severity as AdminSeverity) ? (input.severity as AdminSeverity) : 'MEDIUM'
  return prisma.adminIncident.create({ data: { type: input.type.slice(0, 80), title: input.title.slice(0, 200), description: input.description?.slice(0, 2000) ?? null, severity, source: input.source ?? 'manual', route: input.route ?? null } })
}

/** Changes an incident's status; reopening clears who resolved it. Returns the previous status. */
export async function setIncidentStatus(id: string, status: string, by: string) {
  if (!STATUSES.includes(status as AdminIncidentStatus)) throw new PlatformOpsError('Estado de incidente inválido')
  const current = await prisma.adminIncident.findUnique({ where: { id }, select: { status: true } })
  if (!current) throw new PlatformOpsError('Incidente no encontrado')
  const next = status as AdminIncidentStatus
  await prisma.adminIncident.update({
    where: { id },
    data: {
      status: next,
      ...(next === 'ACKNOWLEDGED' ? { acknowledgedBy: by, acknowledgedAt: new Date() } : {}),
      ...(next === 'RESOLVED' ? { resolvedBy: by, resolvedAt: new Date() } : {}),
      ...(next === 'OPEN' ? { resolvedBy: null, resolvedAt: null } : {}),
    },
  })
  return { previous: current.status }
}

// ─── Partners ───────────────────────────────────────────────────────────────

/** Available partners get new requests; unavailable ones do not. Returns the previous value. */
export async function setPartnerAvailability(partnerId: string, isAvailable: boolean) {
  const p = await prisma.partnerProfile.findUnique({ where: { id: partnerId }, select: { isAvailable: true } })
  if (!p) throw new PlatformOpsError('Socio no encontrado')
  if (p.isAvailable !== isAvailable) await prisma.partnerProfile.update({ where: { id: partnerId }, data: { isAvailable } })
  return { previous: p.isAvailable }
}

// ─── Cash payments ──────────────────────────────────────────────────────────

export const REMINDER_INTERVAL_HOURS = 24
export const MAX_REMINDERS = 5

type ReminderPayment = { id: string; bookingId: string; clientReportedMethod: string | null; partnerUserId: string | null }

/** The reminder the payment-reminders cron sends: to the partner, who must confirm what the client reported. */
export async function sendPaymentReminder(p: ReminderPayment) {
  if (!p.partnerUserId) return false
  await createNotification({
    userId: p.partnerUserId,
    type: 'PAYMENT_PENDING_REMINDER',
    title: 'Recordatorio: confirma el pago del cliente',
    message: `El cliente reporto haber pagado en ${p.clientReportedMethod === 'CASH' ? 'efectivo' : 'transferencia'}. Confirma o rechaza desde tu panel.`,
    data: { bookingId: p.bookingId, kind: 'PAYMENT_REMINDER' },
  })
  await prisma.payment.update({ where: { id: p.id }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } } })
  return true
}

/** One payment, on demand, with the cron's own limits (24 h between reminders, at most 5). */
export async function remindCashPayment(paymentId: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: { include: { partner: { include: { user: { select: { id: true } } } } } } } })
  if (!p) throw new PlatformOpsError('Pago no encontrado')
  if (p.confirmationStatus !== 'CLIENT_REPORTED') throw new PlatformOpsError('Ese pago no espera confirmación del socio')
  if (p.reminderCount >= MAX_REMINDERS) throw new PlatformOpsError(`Ya se enviaron ${MAX_REMINDERS} recordatorios`)
  const last = p.lastReminderAt ?? p.clientReportedAt
  if (last && Date.now() - last.getTime() < REMINDER_INTERVAL_HOURS * 3600_000) throw new PlatformOpsError('Ya se le recordó en las últimas 24 horas')
  const sent = await sendPaymentReminder({ id: p.id, bookingId: p.bookingId, clientReportedMethod: p.clientReportedMethod, partnerUserId: p.booking.partner?.user?.id ?? null })
  if (!sent) throw new PlatformOpsError('La reserva no tiene socio al que recordarle')
}

// ─── Feature flags ──────────────────────────────────────────────────────────

/** Turns a platform feature on or off, keeping its other settings (texts, phone of the buttons). */
export async function setFeatureFlag(key: string, enabled: boolean) {
  const flag = await prisma.featureFlag.findUnique({ where: { key } })
  if (!flag) throw new PlatformOpsError('Función no encontrada')
  if (flag.enabled !== enabled) await prisma.featureFlag.update({ where: { key }, data: { enabled } })
  return { previous: flag.enabled, name: flag.name }
}
