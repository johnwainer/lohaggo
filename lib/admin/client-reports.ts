import type { AdminSeverity } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { CLIENT_REPORT_REASONS, type ClientReportReason } from '@/lib/admin/client-report-reasons'

/**
 * A partner reports a client who is not serious (backed out, does not answer, wants to pay outside…). It
 * becomes an AdminSupportCase in the RISK queue, signed by the partner (userId/role), tied to the request
 * and/or the booking, and the admins are told. One report per partner and request/booking.
 */

const logger = createLogger('client-reports')

export { CLIENT_REPORT_REASONS, type ClientReportReason }

/** Marks every case made here (the dedupe and the partner's «ya reportado» read it). */
export const CLIENT_REPORT_SUBJECT_PREFIX = 'Reporte de cliente'

export type ClientReportInput = { requestId?: string | null; bookingId?: string | null; reason: string; details?: string | null }

export function isClientReportReason(r: unknown): r is ClientReportReason {
  return typeof r === 'string' && r in CLIENT_REPORT_REASONS
}

/** Pure: validates the input; returns the cleaned values or the Spanish error. */
export function validateClientReport(input: ClientReportInput): { ok: true; reason: ClientReportReason; details: string; requestId: string | null; bookingId: string | null } | { ok: false; error: string } {
  const requestId = typeof input.requestId === 'string' && input.requestId.trim() ? input.requestId.trim() : null
  const bookingId = typeof input.bookingId === 'string' && input.bookingId.trim() ? input.bookingId.trim() : null
  if (!requestId && !bookingId) return { ok: false, error: 'Indica la solicitud o la reserva que reportas' }
  if (!isClientReportReason(input.reason)) return { ok: false, error: 'Elige un motivo' }
  const details = typeof input.details === 'string' ? input.details.trim() : ''
  if (details.length > 1000) return { ok: false, error: 'El detalle es demasiado largo (máximo 1.000 caracteres)' }
  if (input.reason === 'OTHER' && details.length < 5) return { ok: false, error: 'Cuéntanos qué pasó' }
  return { ok: true, reason: input.reason, details, requestId, bookingId }
}

/** Asking to pay outside the platform is a fraud risk: the team looks at it first. */
export function clientReportPriority(reason: ClientReportReason): AdminSeverity {
  return reason === 'PAY_OUTSIDE' ? 'HIGH' : 'MEDIUM'
}

const short = (id: string) => id.slice(-6).toUpperCase()

export function clientReportSubject(reason: ClientReportReason, ref: { requestId: string | null; bookingId: string | null }) {
  const where = ref.bookingId ? `reserva #${short(ref.bookingId)}` : `solicitud #${short(ref.requestId!)}`
  return `${CLIENT_REPORT_SUBJECT_PREFIX}: ${CLIENT_REPORT_REASONS[reason].toLowerCase()} · ${where}`
}

export function clientReportDescription(p: { reason: ClientReportReason; details: string; partnerName: string | null; clientName: string | null; clientId: string; service: string; via: string }) {
  return [
    `El socio ${p.partnerName || 'sin nombre'} reporta al cliente ${p.clientName || 'sin nombre'} (id ${p.clientId}).`,
    `Servicio: ${p.service}.`,
    `Motivo: ${CLIENT_REPORT_REASONS[p.reason]}.`,
    p.details ? `Detalle del socio: ${p.details}` : null,
    `Enviado desde: ${p.via === 'chat' ? 'chat' : 'panel del socio'}.`,
  ].filter(Boolean).join('\n')
}

const SLA_MS = 24 * 3600_000

/** The partner's reports (request and booking ids), so the panel shows «Reportado» instead of the button. */
export async function listClientReportsBy(userId: string) {
  const rows = await prisma.adminSupportCase.findMany({
    where: { userId, role: 'PARTNER', subject: { startsWith: CLIENT_REPORT_SUBJECT_PREFIX } },
    select: { requestId: true, bookingId: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  })
  return {
    requestIds: Array.from(new Set(rows.map((r) => r.requestId).filter((x): x is string => !!x))),
    bookingIds: Array.from(new Set(rows.map((r) => r.bookingId).filter((x): x is string => !!x))),
  }
}

export async function reportClient(actor: Actor, input: ClientReportInput, origin: Origin) {
  if (actor.role !== 'PARTNER') throw new OpsError('Solo los socios pueden reportar clientes', 403)
  const v = validateClientReport(input)
  if (!v.ok) throw new OpsError(v.error, 400)

  const partner = await prisma.partnerProfile.findUnique({ where: { userId: actor.userId }, select: { id: true, user: { select: { name: true } } } })
  if (!partner) throw new OpsError('Perfil de socio no encontrado', 403)

  let requestId = v.requestId
  let bookingId: string | null = null
  let client: { id: string; name: string | null }
  let service: string

  if (v.bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: v.bookingId },
      select: { id: true, partnerId: true, user: { select: { id: true, name: true } }, service: { select: { name: true } }, proposal: { select: { serviceRequestId: true } } },
    })
    if (!b || b.partnerId !== partner.id) throw new OpsError('Reserva no encontrada', 404)
    bookingId = b.id
    requestId = b.proposal?.serviceRequestId ?? requestId
    client = b.user
    service = b.service.name
  } else {
    const sr = await prisma.serviceRequest.findUnique({
      where: { id: v.requestId! },
      select: {
        id: true, partnerId: true, serviceId: true, city: true,
        user: { select: { id: true, name: true } },
        service: { select: { name: true } },
        proposals: { where: { partnerId: partner.id }, select: { id: true }, take: 1 },
      },
    })
    if (!sr) throw new OpsError('Solicitud no encontrada', 404)
    // Only a request the partner could see: addressed to them, one they bid on, or of a service they offer
    const related = sr.partnerId === partner.id || sr.proposals.length > 0
      || !!(await prisma.partnerService.findFirst({ where: { partnerId: partner.id, serviceId: sr.serviceId }, select: { id: true } }))
    if (!related) throw new OpsError('Solicitud no encontrada', 404)
    client = sr.user
    service = sr.service.name
  }

  const refs = [requestId ? { requestId } : null, bookingId ? { bookingId } : null].filter(Boolean) as Array<{ requestId: string } | { bookingId: string }>
  const already = await prisma.adminSupportCase.findFirst({
    where: { userId: actor.userId, role: 'PARTNER', subject: { startsWith: CLIENT_REPORT_SUBJECT_PREFIX }, OR: refs },
    select: { id: true },
  })
  if (already) throw new OpsError('Ya reportaste a este cliente por este servicio. El equipo lo está revisando.', 409)

  const supportCase = await prisma.adminSupportCase.create({
    data: {
      userId: actor.userId,
      role: 'PARTNER',
      requestId,
      bookingId,
      priority: clientReportPriority(v.reason),
      status: 'OPEN',
      queue: 'RISK',
      subject: clientReportSubject(v.reason, { requestId, bookingId }),
      description: clientReportDescription({ reason: v.reason, details: v.details, partnerName: partner.user.name, clientName: client.name, clientId: client.id, service, via: origin.via }),
      slaDueAt: new Date(Date.now() + SLA_MS),
    },
    select: { id: true, subject: true, priority: true },
  })

  try {
    const { createNotification } = await import('@/lib/notifications/notificationService')
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
    await Promise.all(admins.map((a) => createNotification({
      userId: a.id,
      type: 'BOOKING_CANCELLED',
      title: 'Un socio reportó a un cliente',
      message: `${partner.user.name || 'Un socio'} reportó a ${client.name || 'un cliente'} (${service}): ${CLIENT_REPORT_REASONS[v.reason].toLowerCase()}.`,
      data: { supportCaseId: supportCase.id, requestId, bookingId, recipient: 'ADMIN', url: '/admin/operations' },
      // WhatsApp free text would miss the 24 h window; the case waits in Operaciones
      channels: ['PUSH', 'EMAIL'],
    }).catch(() => null)))
  } catch (err) {
    logger.warn('notify admins of client report failed (non-fatal)', { supportCaseId: supportCase.id, err })
  }

  return supportCase
}
