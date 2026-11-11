/**
 * The partner said in the booking chat that they cannot come / are in another city / will be late
 * (lib/bookings/partner-unavailable-core.ts detects it). Right away: (a) the client hears it in their open
 * chat (or in the app) with what they can do, (b) a task on the conversation and an in-app alert for the
 * admins, so a person follows it before the service time. Once per booking and kind every 12 h. Never throws.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { bookingWhen, formatBookingWhen } from '@/lib/bookings/when'
import { originColumns, APP_ORIGIN } from '@/lib/ops/origin'
import { UNAVAILABLE_DEDUPE_MS, UNAVAILABLE_LABEL, UNAVAILABLE_MARK, unavailableClientText, type UnavailableKind } from '@/lib/bookings/partner-unavailable-core'

const logger = createLogger('partner-unavailable')

export async function handlePartnerUnavailable(p: { bookingId: string; kind: UnavailableKind; partnerName: string | null; now?: Date }): Promise<boolean> {
  const now = p.now ?? new Date()
  try {
    const b = await prisma.booking.findUnique({
      where: { id: p.bookingId },
      select: {
        id: true, userId: true, status: true, scheduledDate: true, scheduledTime: true, originConversationId: true, proposalId: true,
        service: { select: { name: true } },
        proposal: { select: { serviceRequestId: true, serviceRequest: { select: { originConversationId: true } } } },
      },
    })
    if (!b || (b.status !== 'PENDING' && b.status !== 'CONFIRMED')) return false
    const mark = `${UNAVAILABLE_MARK}:${p.kind}`
    const recent = await prisma.bookingEvent.findFirst({ where: { bookingId: b.id, type: 'followup', detail: mark, createdAt: { gte: new Date(now.getTime() - UNAVAILABLE_DEDUPE_MS) } }, select: { id: true } })
    if (recent) return false
    await prisma.bookingEvent.create({ data: { bookingId: b.id, type: 'followup', actorType: 'partner', ...originColumns(APP_ORIGIN), detail: mark } })

    const service = b.service?.name ?? 'tu servicio'
    const when = formatBookingWhen(b)
    // The proposals the client did not choose (they come back if the booking is cancelled and the request reopens)
    const others = b.proposal
      ? await prisma.proposal.findMany({ where: { serviceRequestId: b.proposal.serviceRequestId, id: { not: b.proposalId ?? undefined }, status: { in: ['PENDING', 'REJECTED'] } }, select: { price: true } })
      : []
    const minPrice = others.length ? Math.min(...others.map((o) => Number(o.price))) : null
    const text = unavailableClientText({ kind: p.kind, partnerName: p.partnerName, service, when, others: { count: others.length, minPrice } })

    // (a) The client: their open chat (the one the request or the booking came from, else their latest), else the app
    const { openClientChat } = await import('@/lib/proposals/chat-digest')
    const latest = await prisma.conversation.findFirst({ where: { userId: b.userId, channel: { in: ['WHATSAPP', 'MESSENGER', 'INSTAGRAM'] } }, orderBy: { lastMessageAt: 'desc' }, select: { id: true } })
    const chat = await openClientChat([b.proposal?.serviceRequest.originConversationId, b.originConversationId, latest?.id], now)
    let toChat = false
    if (chat && chat.userId === b.userId) {
      const { sendToConversation } = await import('@/lib/inbox/send')
      const sent = await sendToConversation({ conversation: chat, message: text, sender: { type: 'AI', agentId: 'booking-followup', agentName: 'Seguimiento de reservas' } })
      toChat = sent.ok
    }
    const { createNotification } = await import('@/lib/notifications/notificationService')
    await createNotification({
      userId: b.userId, type: 'NEW_MESSAGE', title: p.kind === 'late' ? 'Tu socio llegará tarde' : 'Tu socio no podrá ir', message: text,
      data: { bookingId: b.id, kind: 'PARTNER_UNAVAILABLE', url: '/dashboard?tab=bookings' },
      ...(toChat ? { channels: ['PUSH' as const] } : {}),
    }).catch(() => null)

    // (b) The team: a task on the client's conversation and an in-app alert
    const who = p.partnerName?.trim() || 'El socio'
    const title = `${who} ${UNAVAILABLE_LABEL[p.kind]} la reserva #${b.id.slice(-6)} de ${service} (${when}): ${p.kind === 'late' ? 'confirma con el cliente si le sirve la nueva hora' : 'llama al cliente y ofrécele otra propuesta, reprogramar o reabrir la solicitud'}`.slice(0, 200)
    const taskConv = chat ?? (latest ? await prisma.conversation.findUnique({ where: { id: latest.id }, select: { id: true, workspaceId: true } }) : null)
    if (taskConv) {
      const due = Math.min(bookingWhen(b).getTime() - 30 * 60_000, now.getTime() + 60 * 60_000)
      await prisma.conversationTask.create({
        data: { conversationId: taskConv.id, workspaceId: taskConv.workspaceId, source: 'automation', agentName: 'Seguimiento de reservas', title, dueAt: new Date(Math.max(due, now.getTime() + 10 * 60_000)) },
      }).catch((err) => logger.warn('Task not created', { bookingId: b.id, err: err instanceof Error ? err.message : err }))
    }
    const { notifyAdminsInApp, workspaceAdminIds } = await import('@/lib/inbox/escalation')
    const admins = taskConv
      ? await workspaceAdminIds(taskConv.workspaceId)
      : (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 50 })).map((u) => u.id)
    await notifyAdminsInApp(admins, { title: p.kind === 'late' ? 'Socio llegará tarde' : 'Socio no podrá ir', message: title, conversationId: taskConv?.id, kind: 'booking:partner-unavailable' })
    return true
  } catch (err) {
    logger.warn('Partner unavailable handling failed', { bookingId: p.bookingId, err: err instanceof Error ? err.message : err })
    return false
  }
}
