/**
 * The team closes requests that should not be there (spam, not serious, duplicated, outside the catalog):
 * cancel with a reason (and optionally delete for good), tell the client why, and tell every partner who
 * was told about it that it is gone. Also a plain message to the client about their request.
 */
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { OpsError } from '@/lib/ops/origin'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'
import type { AdminActor } from '@/lib/admin/interventions'

const logger = createLogger('request-moderation')

export const CLOSE_REASONS = {
  spam: 'parece spam o una prueba',
  not_serious: 'no parece una solicitud seria',
  duplicate: 'está duplicada con otra solicitud tuya',
  out_of_scope: 'no es un servicio que ofrezcamos por ahora',
  incomplete: 'le faltan datos para que un socio pueda cotizar',
  other: 'otro motivo',
} as const
export type CloseReason = keyof typeof CLOSE_REASONS

/** What partners read: they do not need the client's details, only that it is gone */
const PARTNER_REASON = 'la cerró el equipo de LoHaggo'

/**
 * Partners told about the request (their «nueva solicitud» notice) and those who proposed: each one hears
 * once that it is no longer available (WhatsApp C34 + app). `except` skips partners told some other way.
 */
export async function notifyPartnersRequestGone(requestId: string, reason: string, opts: { exceptPartnerIds?: string[] } = {}) {
  const sr = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, service: { select: { name: true } }, proposals: { select: { partner: { select: { id: true, userId: true } } } } } })
  if (!sr) return 0
  const notices = await prisma.notification.findMany({ where: { type: 'NEW_SERVICE_REQUEST', data: { contains: requestId }, NOT: { userId: sr.userId } }, select: { userId: true } })
  const except = new Set(opts.exceptPartnerIds ?? [])
  const proposerUsers = new Set(sr.proposals.filter((p) => !except.has(p.partner.id)).map((p) => p.partner.userId))
  const exceptUsers = new Set(sr.proposals.filter((p) => except.has(p.partner.id)).map((p) => p.partner.userId))
  const userIds = Array.from(new Set([...notices.map((n) => n.userId), ...Array.from(proposerUsers)])).filter((u) => !exceptUsers.has(u))
  if (!userIds.length) return 0
  const partners = await prisma.user.findMany({ where: { id: { in: userIds }, role: 'PARTNER' }, select: { id: true, name: true } })
  const { sendWaToUser } = await import('@/lib/messaging/wa-send')
  const { WA } = await import('@/lib/messaging/wa-specs')
  for (const u of partners) {
    await sendWaToUser(u.id, WA.C34({ requestId, partnerName: u.name, service: sr.service.name, reason })).catch((err) => logger.warn('C34 failed', { requestId, err: err instanceof Error ? err.message : err }))
    await createNotification({ userId: u.id, type: 'PROPOSAL_REJECTED', title: 'Solicitud cancelada', message: `La solicitud de ${sr.service.name} ya no está disponible: ${reason}.`, data: { serviceRequestId: requestId, targetUrl: '/partner?tab=my-requests' } }).catch(() => null)
  }
  return partners.length
}

async function loadForClose(requestId: string) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, status: true, userId: true, address: true, createdAt: true,
      service: { select: { name: true } }, user: { select: { id: true, name: true } },
      proposals: { select: { id: true, status: true, bookings: { select: { id: true, status: true } } } },
    },
  })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  return sr
}

/**
 * Cancels the request with a reason (pending proposals are closed), tells the partners who knew about it
 * and, if chosen, the client with the reason. With `deleteForGood` the request, its proposals, photos and
 * chats are then removed (never when it has a booking that is not cancelled).
 */
export async function adminCloseRequest(admin: AdminActor, requestId: string, p: { reason: CloseReason; note?: string; notifyClient: boolean; notifyPartners: boolean; deleteForGood: boolean }) {
  const sr = await loadForClose(requestId)
  const liveBooking = sr.proposals.flatMap((x) => x.bookings).find((b) => b.status !== 'CANCELLED')
  if (liveBooking) throw new OpsError('Tiene una reserva en curso: cancélala primero desde la sección Reserva', 400)
  const note = (p.note ?? '').trim().slice(0, 300)
  const reasonText = p.reason === 'other' ? (note || CLOSE_REASONS.other) : CLOSE_REASONS[p.reason]

  if (sr.status !== 'CANCELLED') {
    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.updateMany({ where: { id: requestId, status: { not: 'CANCELLED' } }, data: { status: 'CANCELLED' } })
      await tx.proposal.updateMany({ where: { serviceRequestId: requestId, status: 'PENDING' }, data: { status: 'REJECTED' } })
    })
  }

  let partners = 0
  if (p.notifyPartners) partners = await notifyPartnersRequestGone(requestId, PARTNER_REASON)

  let clientTold = false
  if (p.notifyClient) {
    const { sendWaToUser } = await import('@/lib/messaging/wa-send')
    const { WA } = await import('@/lib/messaging/wa-specs')
    const wa = await sendWaToUser(sr.userId, WA.B29({ requestId, clientName: sr.user.name, service: sr.service.name, reason: reasonText })).catch(() => null)
    await createNotification({ userId: sr.userId, type: 'REQUEST_EXPIRING_SOON', title: 'Cerramos tu solicitud', message: `Cerramos tu solicitud de ${sr.service.name}: ${reasonText}. Si fue un error, escríbenos y te ayudamos.`, data: { serviceRequestId: requestId, targetUrl: '/dashboard?tab=requests' } }).catch(() => null)
    clientTold = Boolean(wa && 'ok' in wa && wa.ok)
  }

  await auditAdminAction({
    actorId: admin.userId, actorEmail: admin.email ?? 'admin', action: 'ADMIN_REQUEST_CLOSE', entityType: 'ServiceRequest', entityId: requestId,
    route: `/admin/service-requests/${requestId}`,
    details: JSON.stringify({ requestId, reason: p.reason, reasonText, notifyClient: p.notifyClient, clientWhatsApp: clientTold, partners, deleteForGood: p.deleteForGood }).slice(0, 2000),
  }).catch(() => null)

  if (p.deleteForGood) {
    // What is erased stays readable in the audit log
    await auditAdminAction({
      actorId: admin.userId, actorEmail: admin.email ?? 'admin', action: 'ADMIN_REQUEST_DELETE', entityType: 'ServiceRequest', entityId: requestId,
      route: '/admin/service-requests',
      details: JSON.stringify({ service: sr.service.name, client: sr.user.name, clientId: sr.userId, address: sr.address?.slice(0, 120) ?? null, createdAt: sr.createdAt, proposals: sr.proposals.length, reason: reasonText }).slice(0, 2000),
    }).catch(() => null)
    await prisma.$transaction(async (tx) => {
      await tx.chat.deleteMany({ where: { serviceRequestId: requestId } })
      await tx.serviceRequest.delete({ where: { id: requestId } })
    })
  }
  return { cancelled: true, deleted: p.deleteForGood, partners, clientTold }
}

/**
 * A message from the team to the client about their request: straight into their WhatsApp/Messenger/
 * Instagram chat when it is open (last message under 24 h), otherwise in the app with a WhatsApp notice.
 */
export async function adminMessageClient(admin: AdminActor, requestId: string, text: string) {
  const body = text.trim()
  if (body.length < 2) throw new OpsError('Escribe el mensaje', 400)
  if (body.length > 1000) throw new OpsError('Máximo 1000 caracteres', 400)
  const sr = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, originConversationId: true, service: { select: { name: true } }, user: { select: { name: true } } } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)

  const since = new Date(Date.now() - 23.5 * 3600_000)
  const conversation = await prisma.conversation.findFirst({
    where: {
      OR: [...(sr.originConversationId ? [{ id: sr.originConversationId }] : []), { userId: sr.userId }],
      channel: { in: ['WHATSAPP', 'MESSENGER', 'INSTAGRAM'] },
      messages: { some: { direction: 'INBOUND', sentAt: { gte: since } } },
    },
    orderBy: { lastMessageAt: 'desc' },
  })
  let via: 'chat' | 'app' = 'app'
  if (conversation) {
    const { sendToConversation } = await import('@/lib/inbox/send')
    const r = await sendToConversation({ conversation, message: body, sender: { type: 'HUMAN', userId: admin.userId } } as never)
    if (r.ok) via = 'chat'
  }
  // In the chat it already reached them; otherwise the WhatsApp notice first (then the app's own WhatsApp text is skipped) and the message in the app
  if (via === 'app') {
    const { sendWaToUser } = await import('@/lib/messaging/wa-send')
    const { WA } = await import('@/lib/messaging/wa-specs')
    await sendWaToUser(sr.userId, WA.B27({ messageId: `req-${requestId}-${Date.now()}`, name: sr.user.name, side: 'CLIENT', service: sr.service.name, ref: requestId.slice(-6), url: 'dashboard?tab=requests' })).catch(() => null)
    await createNotification({ userId: sr.userId, type: 'NEW_MESSAGE', title: 'Mensaje del equipo de LoHaggo', message: body.slice(0, 500), data: { serviceRequestId: requestId, targetUrl: '/dashboard?tab=requests' } }).catch(() => null)
  }
  await auditAdminAction({
    actorId: admin.userId, actorEmail: admin.email ?? 'admin', action: 'ADMIN_REQUEST_MESSAGE_CLIENT', entityType: 'ServiceRequest', entityId: requestId,
    route: `/admin/service-requests/${requestId}`, details: JSON.stringify({ requestId, via, text: body.slice(0, 300) }),
  }).catch(() => null)
  return { via, conversationId: via === 'chat' ? conversation!.id : null }
}
