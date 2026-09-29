/**
 * What the team can do on a service request from «Solicitud 360» (and Haggo, with approval): write in the
 * client–partner chat as LoHaggo support, tell the partners again, reactivate, change / reschedule /
 * cancel the booking (optionally reopening it to other partners) and open a support case. Each one goes
 * through the same shared functions the app uses, with actor ADMIN and origin admin, and leaves an audit row.
 */
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { ADMIN_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'
import { transitionBooking, rescheduleBooking } from '@/lib/bookings/ops'
import { reactivateServiceRequest } from '@/lib/service-requests/ops'
import { createNotification, notifyNewServiceRequest } from '@/lib/notifications/notificationService'
import { SUPPORT_PREFIX } from '@/lib/admin/request-360'
import type { BookingStatus } from '@prisma/client'

export const RENOTIFY_MAX = 3
export const SUPPORT_MESSAGE_MAX = 1000

export type AdminActor = Actor & { email?: string | null }

async function audit(admin: AdminActor, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  await auditAdminAction({ actorId: admin.userId, actorEmail: admin.email ?? 'admin', action, entityType, entityId, route: `/admin/service-requests/${details.requestId ?? ''}`, details: JSON.stringify(details).slice(0, 2000) }).catch(() => null)
}

/** A message from LoHaggo support inside the chat of one proposal, told to one side or both (app + WhatsApp). */
export async function postSupportMessage(admin: AdminActor, p: { requestId: string; proposalId: string; text: string; to: 'client' | 'partner' | 'both' }) {
  const text = p.text.trim()
  if (text.length < 2) throw new OpsError('Escribe el mensaje', 400)
  if (text.length > SUPPORT_MESSAGE_MAX) throw new OpsError(`Máximo ${SUPPORT_MESSAGE_MAX} caracteres`, 400)
  const proposal = await prisma.proposal.findUnique({
    where: { id: p.proposalId },
    select: { id: true, serviceRequestId: true, partnerId: true, partner: { select: { userId: true, user: { select: { name: true } } } }, serviceRequest: { select: { userId: true, service: { select: { name: true } } } } },
  })
  if (!proposal || proposal.serviceRequestId !== p.requestId) throw new OpsError('Esa propuesta no es de esta solicitud', 404)
  const chat = await prisma.chat.upsert({
    where: { proposalId: proposal.id },
    create: { proposalId: proposal.id, serviceRequestId: proposal.serviceRequestId, clientId: proposal.serviceRequest.userId, partnerId: proposal.partnerId },
    update: { updatedAt: new Date() },
  })
  const who = p.to === 'client' ? 'para el cliente' : p.to === 'partner' ? 'para el socio' : null
  const message = await prisma.chatMessage.create({
    data: { chatId: chat.id, senderId: 'SYSTEM', content: `${SUPPORT_PREFIX}${who ? ` (${who})` : ''}: ${text}`, origin: 'admin' },
  })
  const recipients = [
    ...(p.to !== 'partner' ? [{ userId: proposal.serviceRequest.userId, side: 'CLIENT' as const, url: '/dashboard?tab=requests' }] : []),
    ...(p.to !== 'client' ? [{ userId: proposal.partner.userId, side: 'PARTNER' as const, url: '/partner' }] : []),
  ]
  const { waSupportMessage } = await import('@/lib/messaging/wa-events')
  for (const r of recipients) {
    await createNotification({ userId: r.userId, type: 'NEW_MESSAGE', title: 'Mensaje de Soporte LoHaggo', message: text.slice(0, 160), data: { chatId: chat.id, targetUrl: r.url } }).catch(() => null)
    await waSupportMessage({ messageId: message.id, recipientUserId: r.userId, recipientSide: r.side, service: proposal.serviceRequest.service.name, ref: proposal.id.slice(-6) })
  }
  await audit(admin, 'ADMIN_CHAT_MESSAGE', 'Chat', chat.id, { requestId: p.requestId, proposalId: proposal.id, to: p.to, text: text.slice(0, 300) })
  return { messageId: message.id, chatId: chat.id }
}

/** Tells the matching partners about the request again (at most RENOTIFY_MAX times from the admin). */
export async function renotifyPartners(admin: AdminActor, requestId: string) {
  const sr = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { status: true } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  if (sr.status !== 'ACTIVE') throw new OpsError('Solo se avisa de nuevo en solicitudes activas', 400)
  const done = await prisma.adminAuditLog.count({ where: { action: 'ADMIN_REQUEST_RENOTIFY', entityType: 'ServiceRequest', entityId: requestId } })
  if (done >= RENOTIFY_MAX) throw new OpsError(`Ya se avisó de nuevo ${RENOTIFY_MAX} veces`, 400)
  const n = await notifyNewServiceRequest(requestId, { partnersOnly: true, round: 30 + done })
  await audit(admin, 'ADMIN_REQUEST_RENOTIFY', 'ServiceRequest', requestId, { requestId, partners: n })
  return { partners: n }
}

export async function adminReactivate(admin: AdminActor, requestId: string) {
  const r = await reactivateServiceRequest(admin, requestId, ADMIN_ORIGIN)
  await audit(admin, 'ADMIN_REQUEST_REACTIVATE', 'ServiceRequest', requestId, { requestId, until: r.expiresAt })
  return r
}

async function bookingOfRequest(requestId: string, bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, proposal: { select: { serviceRequestId: true } } } })
  if (!b || b.proposal?.serviceRequestId !== requestId) throw new OpsError('Esa reserva no es de esta solicitud', 404)
  return b
}

export async function adminBookingStatus(admin: AdminActor, p: { requestId: string; bookingId: string; status: BookingStatus; reason?: string; reopen?: boolean }) {
  await bookingOfRequest(p.requestId, p.bookingId)
  if (p.status === 'CANCELLED' && (p.reason ?? '').trim().length < 5) throw new OpsError('Escribe el motivo de la cancelación (lo verán el cliente y el socio)', 400)
  const updated = await transitionBooking(admin, p.bookingId, p.status, ADMIN_ORIGIN, { reason: p.reason?.trim(), reopen: p.reopen })
  await audit(admin, p.reopen ? 'ADMIN_BOOKING_REOPEN' : 'ADMIN_BOOKING_STATUS', 'Booking', p.bookingId, { requestId: p.requestId, status: p.status, reason: p.reason ?? null })
  return { status: updated.status }
}

export async function adminReschedule(admin: AdminActor, p: { requestId: string; bookingId: string; date: string; time: string }) {
  await bookingOfRequest(p.requestId, p.bookingId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) throw new OpsError('Fecha (AAAA-MM-DD) y hora (HH:mm) inválidas', 400)
  const r = await rescheduleBooking(admin, p.bookingId, { scheduledDate: new Date(`${p.date}T12:00:00Z`), scheduledTime: p.time }, ADMIN_ORIGIN)
  await audit(admin, 'ADMIN_BOOKING_RESCHEDULE', 'Booking', p.bookingId, { requestId: p.requestId, date: p.date, time: p.time })
  return r
}

export async function openSupportCase(admin: AdminActor, p: { requestId: string; subject: string; description: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const subject = p.subject.trim().slice(0, 200)
  if (subject.length < 3) throw new OpsError('Escribe el asunto del caso', 400)
  const sr = await prisma.serviceRequest.findUnique({ where: { id: p.requestId }, select: { userId: true, proposals: { select: { bookings: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 } } } } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  const bookingId = sr.proposals.flatMap((x) => x.bookings)[0]?.id ?? null
  const c = await prisma.adminSupportCase.create({
    data: { userId: sr.userId, role: 'CLIENT', requestId: p.requestId, bookingId, subject, description: p.description.trim().slice(0, 4000) || subject, priority: p.priority ?? 'MEDIUM', slaDueAt: new Date(Date.now() + 24 * 3600_000), assignedTo: admin.email ?? null },
  })
  await audit(admin, 'ADMIN_SUPPORT_CASE_OPEN', 'AdminSupportCase', c.id, { requestId: p.requestId, subject })
  return { caseId: c.id }
}
