import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendToConversation } from '@/lib/inbox/send'
import { patchInboxState, readInboxState } from '@/lib/inbox/state'
import { CSAT_COOLDOWN_MS, CSAT_QUESTION, CSAT_SENDER, CSAT_THANKS, csatSkipReason } from '@/lib/inbox/csat-core'

const logger = createLogger('inbox-csat')

/**
 * Sends the survey after a conversation was closed as handled. Best effort and never throws: closing must
 * not depend on it. The mark (csatAskedAt) is claimed in SQL first so two closes never send it twice.
 */
export async function askCsatOnClose(conversationId: string, reason: string): Promise<boolean> {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) return false
    const state = readInboxState(conv.customFields)
    let lastInboundAt: string | Date | null = state.lastInboundAt ?? null
    if (!lastInboundAt) {
      const last = await prisma.conversationMessage.findFirst({ where: { conversationId, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
      lastInboundAt = last?.sentAt ?? null
    }
    const optedOut = Boolean(await prisma.messagingOptOut.findFirst({ where: { channel: conv.channel, destination: conv.contactPhone, isActive: true }, select: { id: true } }).catch(() => null))
    const replied = Boolean(state.lastReplyAt) || Boolean(await prisma.conversationMessage.findFirst({
      where: { conversationId, direction: 'OUTBOUND', senderType: { in: ['HUMAN', 'AI'] }, NOT: { aiAgentId: { in: ['csat', 'booking-followup'] } } },
      select: { id: true },
    }).catch(() => null))
    const skip = csatSkipReason({
      channel: conv.channel, status: conv.status, reason, automatedOnly: Boolean(state.automatedOnly), aiSpam: conv.aiSpam, isTest: conv.isTest,
      optedOut, csatAskedAt: state.csatAskedAt, lastInboundAt, replied,
    })
    if (skip) return false

    const now = new Date()
    const cutoff = new Date(now.getTime() - CSAT_COOLDOWN_MS).toISOString()
    const claimed = await prisma.$executeRaw`
      UPDATE "Conversation"
      SET "customFields" = (CASE WHEN jsonb_typeof("customFields") = 'object' THEN "customFields" ELSE '{}'::jsonb END)
        || jsonb_build_object('inbox', (CASE WHEN jsonb_typeof("customFields"->'inbox') = 'object' THEN "customFields"->'inbox' ELSE '{}'::jsonb END) || jsonb_build_object('csatAskedAt', ${now.toISOString()}::text))
      WHERE "id" = ${conversationId} AND "status" IN ('RESOLVED', 'CLOSED')
        AND COALESCE("customFields"->'inbox'->>'csatAskedAt', '') < ${cutoff}`
    if (!claimed) return false

    const sent = await sendToConversation({ conversation: conv, message: CSAT_QUESTION, sender: CSAT_SENDER, keepStatus: true })
    if (!sent.ok) {
      await patchInboxState(conversationId, { csatAskedAt: state.csatAskedAt ?? null })
      logger.warn('Survey not sent', { conversationId, error: sent.error })
      return false
    }
    await prisma.conversationEvent.create({ data: { conversationId, type: 'csat_asked', actorType: 'system', actorName: CSAT_SENDER.agentName } }).catch(() => null)
    return true
  } catch (err) {
    logger.warn('Survey failed', { conversationId, err: err instanceof Error ? err.message : err })
    return false
  }
}

/**
 * The contact answered the survey: the score is kept in customFields.inbox, a thank-you goes out and the
 * conversation stays closed (it does not go back to «Por responder» and the AI agent is not woken up).
 */
export async function recordCsatReply(conversationId: string, score: number, at: Date = new Date()) {
  await patchInboxState(conversationId, { csat: { score, at: at.toISOString() }, lastInboundAt: at.toISOString(), awaitingReply: false })
  await prisma.conversationEvent.create({ data: { conversationId, type: 'csat_answered', actorType: 'contact', detail: `${score}/5` } }).catch(() => null)
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (conv) {
    const sent = await sendToConversation({ conversation: conv, message: CSAT_THANKS, sender: CSAT_SENDER, keepStatus: true }).catch((err) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }))
    if (!sent.ok) logger.warn('Survey thanks not sent', { conversationId, error: sent.error })
    emitInboxEvent({ type: 'status-update', conversationId, workspaceId: conv.workspaceId })
  }
}
