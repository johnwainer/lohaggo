/**
 * Proposals told in the client's open chat (lib/proposals/chat-digest-core.ts has the rules and the text).
 * A request created from a chat whose 24 h window is still open gets ONE consolidated, ranked message in
 * that chat instead of a «nueva propuesta» template per proposal; proposals arriving right after it wait for
 * the next run of the ai-maintenance cron, which sends one updated message (or, if the window closed, the
 * regular template for each one not told yet). Never throws: on any failure the caller sends the template.
 */
import type { Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { readInboxState } from '@/lib/inbox/state'
import { formatCalendarDay } from '@/lib/bookings/when'
import { PROPOSAL_OPTIONS_KEY } from '@/lib/proposals/chat-compare'
import { DIGEST_KEY, buildDigest, chatWindowOpen, digestDecision, readDigestState, type DigestKind, type DigestProposal } from '@/lib/proposals/chat-digest-core'

const logger = createLogger('proposal-digest')
export const DIGEST_SENDER = { type: 'AI' as const, agentId: 'proposal-digest', agentName: 'Propuestas' }

/** The client's chat for this request: the one it was created from (or a fallback, e.g. the booking's), window open and no STOP. */
export async function openClientChat(conversationIds: Array<string | null | undefined>, now = new Date()): Promise<Conversation | null> {
  for (const id of conversationIds) {
    if (!id) continue
    const conv = await prisma.conversation.findUnique({ where: { id } })
    if (!conv || conv.isTest || conv.aiSpam) continue
    let lastInbound: string | Date | null = readInboxState(conv.customFields).lastInboundAt ?? null
    if (!lastInbound) {
      const m = await prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
      lastInbound = m?.sentAt ?? null
    }
    if (!chatWindowOpen(conv.channel, lastInbound, now)) continue
    const optOut = await prisma.messagingOptOut.findFirst({
      where: { channel: conv.channel, isActive: true, OR: [{ destination: conv.contactPhone }, ...(conv.userId ? [{ userId: conv.userId }] : [])] },
      select: { id: true },
    })
    if (optOut) continue
    return conv
  }
  return null
}

async function loadRequest(requestId: string) {
  return prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, userId: true, status: true, origin: true, originConversationId: true,
      service: { select: { name: true } },
      proposals: {
        where: { status: 'PENDING' },
        select: {
          id: true, price: true, status: true, createdAt: true, proposedDate: true, proposedTime: true,
          partner: { select: { rating: true, totalReviews: true, completedServicesCount: true, user: { select: { name: true } } } },
        },
      },
    },
  })
}

type LoadedRequest = NonNullable<Awaited<ReturnType<typeof loadRequest>>>

function toDigestProposals(r: LoadedRequest): DigestProposal[] {
  return r.proposals.map((p) => ({
    id: p.id, price: Number(p.price), status: p.status, createdAt: p.createdAt,
    partner: { rating: p.partner.rating, totalReviews: p.partner.totalReviews, completedServicesCount: p.partner.completedServicesCount },
    partnerName: p.partner.user?.name?.trim().split(/\s+/)[0] || 'Socio',
    when: p.proposedDate ? `${formatCalendarDay(p.proposedDate, { weekday: 'short', day: 'numeric', month: 'short' })}${p.proposedTime ? ` ${p.proposedTime}` : ''}` : null,
  }))
}

async function clientFeePct() {
  const { loadEffectiveRates } = await import('@/lib/payments/commission')
  return (await loadEffectiveRates().catch(() => ({ client: 0 }))).client
}

/** Sends the digest and keeps what it showed: the ids (next digest) and the numbering («2» = that proposal). */
async function sendDigest(conv: Conversation, r: LoadedRequest, kind: DigestKind, partnerName: string | null, now: Date) {
  const { text, options } = buildDigest({ kind, service: r.service.name, requestId: r.id, partnerName, proposals: toDigestProposals(r), clientFeePct: await clientFeePct() })
  const { sendToConversation } = await import('@/lib/inbox/send')
  const sent = await sendToConversation({ conversation: conv, message: text, sender: DIGEST_SENDER })
  if (!sent.ok) {
    logger.warn('Proposal digest not sent', { conversationId: conv.id, requestId: r.id, error: sent.error })
    return false
  }
  const fresh = await prisma.conversation.findUnique({ where: { id: conv.id }, select: { customFields: true } })
  const fields = fresh?.customFields && typeof fresh.customFields === 'object' ? { ...(fresh.customFields as Record<string, unknown>) } : {}
  fields[DIGEST_KEY] = { ...readDigestState(fields), [r.id]: { at: now.toISOString(), ids: r.proposals.map((p) => p.id) } }
  if (options.length) fields[PROPOSAL_OPTIONS_KEY] = { at: now.toISOString(), items: options, reasonAskedAt: null }
  await prisma.conversation.update({ where: { id: conv.id }, data: { customFields: fields as object } }).catch(() => null)
  emitInboxEvent({ type: 'new-message', conversationId: conv.id, workspaceId: conv.workspaceId })
  return true
}

/**
 * A proposal arrived: true when the client's chat takes care of it (digest sent now, or queued for the next
 * run because one went out a moment ago); false → the caller sends the regular template.
 */
export async function proposalArrivedInChat(requestId: string, now = new Date()): Promise<boolean> {
  try {
    const r = await loadRequest(requestId)
    if (!r || r.origin !== 'chat' || !r.originConversationId || r.status !== 'ACTIVE') return false
    const conv = await openClientChat([r.originConversationId], now)
    if (!conv) return false
    const decision = digestDecision(readDigestState(conv.customFields)[r.id], r.proposals.map((p) => p.id), now)
    if (decision !== 'send') return true
    // Two proposals at the same instant: only one of them writes the digest
    const { hit } = await import('@/lib/rate-limit-store')
    if ((await hit(`proposal-digest:${r.id}`, 60_000, now.getTime())).count > 1) return true
    return await sendDigest(conv, r, 'new', null, now)
  } catch (err) {
    logger.warn('Proposal digest failed (template instead)', { requestId, err: err instanceof Error ? err.message : err })
    return false
  }
}

/**
 * The partner cancelled and the request reopened: the client hears it in their open chat with the proposals
 * that are still there (numbered, «responde 1 o 2»). False when there is no open chat (the template goes).
 */
export async function partnerCancelledInChat(p: { requestId: string; bookingConversationId?: string | null; partnerName: string | null }, now = new Date()): Promise<boolean> {
  try {
    const r = await loadRequest(p.requestId)
    if (!r) return false
    const conv = await openClientChat([r.originConversationId, p.bookingConversationId], now)
    if (!conv || conv.userId !== r.userId) return false
    return await sendDigest(conv, r, 'partner_cancelled', p.partnerName, now)
  } catch (err) {
    logger.warn('Partner-cancel chat notice failed (template instead)', { requestId: p.requestId, err: err instanceof Error ? err.message : err })
    return false
  }
}

/**
 * Cron (ai-maintenance): the proposals that waited for an update. Window open → one updated digest; window
 * closed → the regular template for each proposal the chat never showed.
 */
export async function flushProposalDigests(now = new Date(), limit = 30) {
  const requests = await prisma.serviceRequest.findMany({
    where: { origin: 'chat', status: 'ACTIVE', originConversationId: { not: null }, proposals: { some: { status: 'PENDING', createdAt: { gte: new Date(now.getTime() - 26 * 3600_000) } } } },
    select: { id: true, originConversationId: true },
    take: 100,
  })
  let sent = 0
  let templates = 0
  for (const req of requests) {
    if (sent + templates >= limit) break
    try {
      const conv = await prisma.conversation.findUnique({ where: { id: req.originConversationId! }, select: { customFields: true } })
      const last = readDigestState(conv?.customFields)[req.id]
      // Only requests the chat already took care of: the rest got their templates when each proposal arrived
      if (!last) continue
      const r = await loadRequest(req.id)
      if (!r) continue
      const decision = digestDecision(last, r.proposals.map((p) => p.id), now)
      if (decision !== 'send') continue
      const open = await openClientChat([r.originConversationId], now)
      if (open && (await sendDigest(open, r, 'new', null, now))) {
        sent++
        continue
      }
      const { waNewProposal } = await import('@/lib/messaging/wa-events')
      for (const p of r.proposals.filter((x) => !last.ids.includes(x.id))) {
        const res = await waNewProposal(p.id)
        if (res?.ok) templates++
      }
      // Remembered as told, so the template is not sent again on the next run
      if (conv) {
        const fields = conv.customFields && typeof conv.customFields === 'object' ? { ...(conv.customFields as Record<string, unknown>) } : {}
        fields[DIGEST_KEY] = { ...readDigestState(fields), [r.id]: { at: last.at, ids: r.proposals.map((p) => p.id) } }
        await prisma.conversation.update({ where: { id: req.originConversationId! }, data: { customFields: fields as object } }).catch(() => null)
      }
    } catch (err) {
      logger.warn('Proposal digest flush failed', { requestId: req.id, err: err instanceof Error ? err.message : err })
    }
  }
  return { sent, templates }
}
