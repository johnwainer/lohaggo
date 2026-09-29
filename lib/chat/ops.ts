/**
 * The client↔partner chat of a proposal / booking, shared by the app route and the inbox AI agents: a
 * message written over WhatsApp lands in the same chat, with the same checks (participants only, open
 * chat, no contact details), and reaches the other party wherever they are: straight into their
 * WhatsApp thread when it is open (they answered in the last 24 h), otherwise by template and the app.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications/notificationService'
import { emitProposalBroadcast } from '@/lib/supabase-admin'
import { computeChatState } from '@/lib/chat-status'
import { detectHelpQuery, formatHelpSystemMessage } from '@/lib/chat/help-responses'
import { detectContactInfo } from '@/lib/chat/contact-guard'
import { cloudinaryService } from '@/lib/cloudinary'
import { OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'

const logger = createLogger('chat-ops')

const DAY_MS = 24 * 3600_000
export const CHAT_MESSAGE_MAX = 5000
export { PHOTO_ONLY_TEXT } from '@/lib/chat/constants'
import { PHOTO_ONLY_TEXT } from '@/lib/chat/constants'

const chatInclude = {
  serviceRequest: { select: { status: true, service: { select: { name: true } } } },
  proposal: { select: { id: true, status: true, bookings: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, status: true, updatedAt: true } } } },
  client: { select: { id: true, name: true, isActive: true } },
  partner: { select: { id: true, isActive: true, userId: true, user: { select: { name: true } } } },
}

type LoadedChat = NonNullable<Awaited<ReturnType<typeof loadChat>>>

function loadChat(chatId: string) {
  return prisma.chat.findUnique({ where: { id: chatId }, include: chatInclude })
}

/** «#abc123»: the booking's short ref when there is one, else the proposal's. */
export function chatRef(chat: { proposal: { id: string; bookings: Array<{ id: string }> } }) {
  return (chat.proposal.bookings[0]?.id ?? chat.proposal.id).slice(-6)
}

function sideOf(chat: LoadedChat, actor: Actor): 'CLIENT' | 'PARTNER' | null {
  if (chat.clientId === actor.userId) return 'CLIENT'
  if (actor.partnerId && chat.partnerId === actor.partnerId) return 'PARTNER'
  return null
}

/**
 * The chat of one of the actor's proposals, found by the short ref of the booking, the proposal or the
 * request (a request with several proposals is ambiguous for the client). Created if nobody opened it yet.
 */
export async function resolveChatByRef(actor: Actor, ref: string) {
  const r = ref.trim().replace(/^#/, '').toLowerCase()
  if (!/^[a-z0-9]{4,30}$/i.test(r)) throw new OpsError('Esa referencia no es válida.', 400)
  const where = actor.role === 'PARTNER' && actor.partnerId ? { partnerId: actor.partnerId } : { serviceRequest: { userId: actor.userId } }
  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, serviceRequestId: true, partnerId: true, serviceRequest: { select: { userId: true } }, bookings: { select: { id: true } } },
  })
  const exact = proposals.filter((p) => p.id.endsWith(r) || p.bookings.some((b) => b.id.endsWith(r)))
  const byRequest = proposals.filter((p) => p.serviceRequestId.endsWith(r))
  const hits = exact.length ? exact : byRequest
  if (!hits.length) throw new OpsError('Esa referencia no corresponde a ninguna propuesta ni reserva de esta persona.', 404)
  if (hits.length > 1) throw new OpsError('Esa solicitud tiene varias propuestas: usa la referencia de la reserva o de la propuesta para saber a quién escribirle.', 409)
  const p = hits[0]
  const chat = await prisma.chat.upsert({
    where: { proposalId: p.id },
    update: {},
    create: { proposalId: p.id, serviceRequestId: p.serviceRequestId, clientId: p.serviceRequest.userId, partnerId: p.partnerId },
    select: { id: true },
  })
  const loaded = await loadChat(chat.id)
  if (!loaded) throw new OpsError('Chat no encontrado', 404)
  return loaded
}

/** Only photos in LoHaggo's own Cloudinary cloud (res.cloudinary.com is shared by every Cloudinary customer). */
function isOwnPhotoUrl(url: string) {
  const cloud = cloudinaryService.cloudName()
  if (!cloud) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cloud}/image/upload/`)
  } catch {
    return false
  }
}

/** Links never travel into someone's WhatsApp from the other party: a phishing «pay here» would read as ours. */
export function withoutLinks(text: string) {
  return text.replace(/\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co|net|org|io|me|app|link|ly|info|biz|xyz|site|online|store|shop)(?:\/\S*)?/gi, '[enlace oculto, míralo en la app]')
}

export type SendChatResult =
  | { blocked: false; message: { id: string }; helpReply: { id: string } | null; delivery: DeliveryResult }
  | { blocked: true; reason: string; systemMessage: { id: string } }

/**
 * Sends a message (text and/or photo) as the actor. Participants only, open chats only, no contact
 * details (those are blocked and the other party is warned, as in the app).
 */
export async function sendChatMessage(actor: Actor, chatId: string, input: { content: string; imageUrl?: string | null }, origin: Origin): Promise<SendChatResult> {
  const imageUrl = input.imageUrl?.trim() || null
  if (imageUrl && !isOwnPhotoUrl(imageUrl)) throw new OpsError('La foto no viene de un origen permitido.', 400)
  const content = input.content.trim() || (imageUrl ? PHOTO_ONLY_TEXT : '')
  if (!content) throw new OpsError('El mensaje está vacío.', 400)
  if (content.length > CHAT_MESSAGE_MAX) throw new OpsError(`El mensaje supera ${CHAT_MESSAGE_MAX} caracteres.`, 400)

  const chat = await loadChat(chatId)
  if (!chat) throw new OpsError('Chat no encontrado', 404)
  const side = sideOf(chat, actor)
  if (!side) throw new OpsError('No autorizado', 403)
  if (side === 'CLIENT' && !chat.client.isActive) throw new OpsError('Tu cuenta está inactiva. Contacta al administrador.', 403)
  if (side === 'PARTNER' && !chat.partner.isActive) throw new OpsError('Tu cuenta está inactiva. Contacta al administrador.', 403)
  const recipientUserId = side === 'CLIENT' ? chat.partner.userId : chat.clientId

  const state = computeChatState({
    serviceRequestStatus: chat.serviceRequest?.status ?? null,
    proposalStatus: chat.proposal?.status ?? null,
    bookingStatus: chat.proposal.bookings[0]?.status ?? null,
    bookingUpdatedAt: chat.proposal.bookings[0]?.updatedAt ?? null,
  })
  if (!state.isActive) throw new OpsError(`Esta conversación está cerrada (${state.statusLabel.toLowerCase()}). Ya no se pueden enviar mensajes.`, 403)

  const contact = detectContactInfo(content)
  if (!contact.isValid) {
    const systemMessage = await prisma.chatMessage.create({
      data: {
        chatId,
        senderId: 'SYSTEM',
        content: `⚠️ MENSAJE BLOQUEADO\n\nSe intentó compartir ${contact.reason}. Por seguridad, no se permite compartir información de contacto.\n\nMantén la comunicación dentro de la plataforma.`,
      },
    })
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } })
    // The team sees who tried and what (the chat only shows the warning): Solicitud 360 and Haggo read it
    await prisma.adminAuditLog.create({
      data: { action: 'CHAT_CONTACT_BLOCKED', entityType: 'Chat', entityId: chatId, actorId: actor.userId, actorEmail: side === 'CLIENT' ? 'cliente' : 'socio', details: JSON.stringify({ side, reason: contact.reason ?? null, text: content.slice(0, 300), origin: origin.via }).slice(0, 1000) },
    }).catch(() => null)
    void emitProposalBroadcast(chat.proposalId)
    await createNotification({
      userId: recipientUserId,
      type: 'NEW_MESSAGE',
      title: 'Alerta de seguridad',
      message: 'Se bloqueó un intento de compartir información de contacto en el chat',
      data: { chatId, targetUrl: side === 'PARTNER' ? '/dashboard' : '/partner' },
    })
    return { blocked: true, reason: contact.reason ?? 'información de contacto', systemMessage }
  }

  const message = await prisma.chatMessage.create({
    data: { chatId, senderId: actor.userId, content, imageUrl, ...originColumns(origin) },
  })
  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } })

  let helpReply: { id: string } | null = null
  const help = detectHelpQuery(content, side)
  if (help) {
    const recentHelp = await prisma.chatMessage.findFirst({
      where: { chatId, senderId: 'SYSTEM', content: { startsWith: 'ℹ️ Info de LoHaggo' }, createdAt: { gte: new Date(Date.now() - 5 * 60_000) } },
      select: { id: true },
    })
    if (!recentHelp) helpReply = await prisma.chatMessage.create({ data: { chatId, senderId: 'SYSTEM', content: formatHelpSystemMessage(help) } })
  }

  void emitProposalBroadcast(chat.proposalId)

  const senderName = side === 'CLIENT' ? chat.client.name : chat.partner.user.name
  const delivery = await deliverChatMessage({ chat, messageId: message.id, recipientUserId, recipientSide: side === 'CLIENT' ? 'PARTNER' : 'CLIENT', senderName, content, imageUrl, origin })
  return { blocked: false, message, helpReply, delivery }
}

export type DeliveryResult = 'whatsapp' | 'template' | 'app'

/**
 * Gets the message to the other party. Their WhatsApp thread open (they wrote in the last 24 h): the
 * text and photo go there, stored in the thread, and they can answer right there. Otherwise the
 * WhatsApp template «you have a message» (until Meta approves it, the regular notification).
 */
async function deliverChatMessage(p: {
  chat: LoadedChat
  messageId: string
  recipientUserId: string
  recipientSide: 'CLIENT' | 'PARTNER'
  senderName: string
  content: string
  imageUrl: string | null
  origin: Origin
}): Promise<DeliveryResult> {
  const service = p.chat.serviceRequest?.service?.name ?? 'tu servicio'
  const ref = chatRef(p.chat)
  const senderFirst = p.senderName.trim().split(/\s+/)[0] || (p.recipientSide === 'CLIENT' ? 'Tu socio' : 'Tu cliente')
  const targetUrl = p.recipientSide === 'CLIENT' ? '/dashboard' : '/partner'
  const notify = (withWhatsapp: boolean) =>
    createNotification({
      userId: p.recipientUserId,
      type: 'NEW_MESSAGE',
      title: 'Nuevo mensaje',
      message: `${p.senderName} te ha enviado un mensaje`,
      data: { chatId: p.chat.id, targetUrl },
      ...(withWhatsapp ? {} : { channels: ['PUSH', 'EMAIL', 'SMS'] }),
    })

  try {
    const recipient = await prisma.user.findUnique({ where: { id: p.recipientUserId }, select: { isActive: true, notificationsWhatsappEnabled: true } })
    const conversation = recipient?.isActive && recipient.notificationsWhatsappEnabled !== false ? await openWhatsappThread(p.recipientUserId) : null
    if (conversation && conversation.id !== p.origin.conversationId) {
      const { sendToConversation } = await import('@/lib/inbox/send')
      const who = p.recipientSide === 'CLIENT' ? 'tu socio' : 'tu cliente'
      const text = `💬 ${senderFirst} (${who}) te escribió sobre ${service} · ref ${ref}:\n\n${p.content === PHOTO_ONLY_TEXT ? '(te envió una foto)' : `«${withoutLinks(p.content)}»`}\n\nEs un mensaje de ${who}, no de LoHaggo: nunca te pediremos pagos ni datos por un enlace suyo. Si quieres responderle, escríbelo aquí y se lo hago llegar.`
      const sent = await sendToConversation({
        conversation,
        message: text,
        attachment: p.imageUrl ? { url: p.imageUrl, mediaType: 'image/jpeg', mediaName: null, kind: 'image' } : null,
        sender: { type: 'AI', agentId: 'chat-relay', agentName: 'Chat de la reserva' },
      })
      if (sent.ok) {
        await prisma.chatMessage.update({ where: { id: p.messageId }, data: { read: true } })
        await notify(false)
        return 'whatsapp'
      }
      logger.warn('Chat relay to WhatsApp failed, falling back', { chatId: p.chat.id, error: sent.error })
    }

    const { waChatMessage } = await import('@/lib/messaging/wa-events')
    const wa = await waChatMessage({ chatId: p.chat.id, recipientUserId: p.recipientUserId, recipientSide: p.recipientSide, senderName: p.senderName, service, ref })
    await notify(!wa?.ok)
    return wa?.ok ? 'template' : 'app'
  } catch (err) {
    logger.error('Chat message delivery failed', { chatId: p.chat.id, error: err instanceof Error ? err.message : String(err) })
    await notify(true).catch(() => null)
    return 'app'
  }
}

/** The person's WhatsApp conversation, if they wrote in the last 24 h (free text is allowed only then). */
async function openWhatsappThread(userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { channel: 'WHATSAPP', userId },
    orderBy: { lastMessageAt: 'desc' },
  })
  if (!conversation) return null
  const lastInbound = await prisma.conversationMessage.findFirst({
    where: { conversationId: conversation.id, direction: 'INBOUND' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  if (!lastInbound || Date.now() - lastInbound.sentAt.getTime() > DAY_MS) return null
  return conversation
}

/** Messages the actor has not read yet (optionally of one chat), oldest first; they are marked read. */
export async function takeUnreadMessages(actor: Actor, opts: { chatId?: string; take?: number } = {}) {
  const chatWhere = actor.role === 'PARTNER' && actor.partnerId ? { partnerId: actor.partnerId } : { clientId: actor.userId }
  const rows = await prisma.chatMessage.findMany({
    // Messages from the other side, and notes from the LoHaggo team (system messages written from the admin)
    where: { read: false, senderId: { not: actor.userId }, OR: [{ senderId: { not: 'SYSTEM' } }, { origin: 'admin' }], chat: { ...chatWhere, ...(opts.chatId ? { id: opts.chatId } : {}) } },
    orderBy: { createdAt: 'asc' },
    take: opts.take ?? 20,
    include: { chat: { include: chatInclude } },
  })
  if (rows.length) {
    await prisma.chatMessage.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { read: true } })
    for (const proposalId of Array.from(new Set(rows.map((r) => r.chat.proposalId)))) void import('@/lib/supabase-admin').then((m) => m.emitProposalReadBroadcast(proposalId))
  }
  return rows.map((r) => ({
    ref: chatRef(r.chat),
    service: r.chat.serviceRequest?.service?.name ?? '',
    from: r.senderId === 'SYSTEM' ? 'Equipo de LoHaggo' : r.senderId === r.chat.clientId ? r.chat.client.name : r.chat.partner.user.name,
    content: r.content,
    imageUrl: r.imageUrl,
    at: r.createdAt,
  }))
}

/** How many messages wait for the actor, for the agent's context. */
export async function unreadCount(actor: Actor) {
  const chatWhere = actor.role === 'PARTNER' && actor.partnerId ? { partnerId: actor.partnerId } : { clientId: actor.userId }
  return prisma.chatMessage.count({ where: { read: false, senderId: { notIn: [actor.userId, 'SYSTEM'] }, chat: chatWhere } })
}

/** Unread count for a platform user (client or partner), for the AI agent's context. */
export async function unreadCountForUser(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, partnerProfile: { select: { id: true } } } })
  if (!u) return 0
  return unreadCount({ userId, role: u.partnerProfile ? 'PARTNER' : 'CLIENT', partnerId: u.partnerProfile?.id ?? null })
}
