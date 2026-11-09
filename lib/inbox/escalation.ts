/**
 * «Nadie le contestó»: the ladder that runs every minute (cron copilot) for contacts waiting for a person —
 * after an AI handoff, or a message in «Por responder» that no AI covers. Rules and times in
 * lib/inbox/escalation-core.ts; what was done for each wait lives in customFields.inbox.escalation.
 */
import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { createNotification } from '@/lib/notifications/notificationService'
import { patchInboxState, readInboxState } from '@/lib/inbox/state'
import {
  ESCALATION_SETTINGS, teamHours, holdingCaseOf, holdingMessage, insideReplyWindow, isTrivialAck, nextEscalationState, planEscalation, waitingAnchor,
  type EscalationPlan,
} from '@/lib/inbox/escalation-core'
import { autopilotCandidates } from '@/lib/ai/runtime-core'

const logger = createLogger('inbox-escalation')

const MIN = 60_000
const HOUR = 60 * MIN
const COMMENT_CHANNELS = ['FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT'] as const
export const LADDER_INCIDENT_HIGH = 'inbox:sin-respuesta'
export const LADDER_INCIDENT_CRITICAL = 'inbox:sin-respuesta-critica'
const ACTOR = { actorType: 'system', actorId: null, actorName: 'Escalamiento de la bandeja' }

const inboxPath = (conversationId: string) => `/admin/inbox?c=${conversationId}`
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')

/** Active admins who see this workspace (its members and the superadmins). */
export async function workspaceAdminIds(workspaceId: string) {
  const rows = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, OR: [{ isSuperAdmin: true }, { workspaceMemberships: { some: { workspaceId } } }] },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** In-app (and push) to each admin; WhatsApp goes by its own template. */
export async function notifyAdminsInApp(userIds: string[], n: { title: string; message: string; conversationId?: string; url?: string; kind: string }) {
  await Promise.all(userIds.map((userId) => createNotification({
    userId, type: 'NEW_MESSAGE', title: n.title, message: n.message, channels: ['PUSH'],
    data: { url: n.url ?? (n.conversationId ? inboxPath(n.conversationId) : '/admin/inbox'), conversationId: n.conversationId ?? null, kind: n.kind },
  }).catch(() => null)))
}

/** The admin who has it, when it is an active admin; otherwise nobody (the alert goes to everyone). */
async function assignedAdmin(assignedToId: string | null) {
  if (!assignedToId) return null
  const u = await prisma.user.findFirst({ where: { id: assignedToId, role: 'ADMIN', isActive: true }, select: { id: true, name: true } })
  return u
}

/** One open incident per conversation and type; a repeat only counts one more occurrence. */
async function ladderIncident(type: string, severity: 'HIGH' | 'CRITICAL', conversationId: string, title: string, description: string) {
  const route = inboxPath(conversationId)
  const open = await prisma.adminIncident.findFirst({ where: { type, route, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) {
    await prisma.adminIncident.update({ where: { id: open.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date() } })
    return
  }
  const { openIncident } = await import('@/lib/ops/platform-ops')
  await openIncident({ type, severity, source: 'inbox-escalation', route, title, description })
}

/** The agent that talks to the contact for the holding message: the one that handed off, the copilot or the autopilot of the channel. */
async function holdingAgent(conversation: Conversation): Promise<AiAgent | null> {
  if (conversation.aiAgentId) {
    const own = await prisma.aiAgent.findFirst({ where: { id: conversation.aiAgentId, status: 'active' } })
    if (own) return own
  }
  const { copilotAgentForConversation } = await import('@/lib/ai/copilot')
  const copilot = await copilotAgentForConversation(conversation).catch(() => null)
  if (copilot) return copilot
  const agents = await prisma.aiAgent.findMany({ where: { workspaceId: conversation.workspaceId, status: 'active' } })
  return autopilotCandidates(agents, conversation.channel)[0] ?? null
}

async function holdingCase(userId: string | null) {
  if (!userId) return holdingCaseOf({ role: null, activeBookings: 0, activeRequests: 0 })
  const [user, activeBookings, activeRequests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } }),
    prisma.booking.count({ where: { userId, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } } }),
    prisma.serviceRequest.count({ where: { userId, status: 'ACTIVE' } }),
  ])
  return holdingCaseOf({ role: user?.isActive ? user.role : null, activeBookings, activeRequests })
}

/** Sends the holding message as the agent; the conversation stays in «Por responder» (a person still owes the answer). */
async function sendHolding(conversation: Conversation, agent: AiAgent, now: Date) {
  const { sendToConversation } = await import('@/lib/inbox/send')
  const { applySignature, formatForChannel } = await import('@/lib/ai/format')
  const kind = await holdingCase(conversation.userId)
  const text = holdingMessage({ firstName: conversation.contactName, kind, now, appUrl: appUrl() })
  const result = await sendToConversation({
    conversation,
    message: applySignature(formatForChannel(text, conversation.channel), agent.signatureMode, agent.signatureText, false),
    sender: { type: 'AI', agentId: agent.id, agentName: agent.name },
  })
  if (!result.ok) {
    logger.warn('Holding message not sent', { conversationId: conversation.id, error: result.error })
    return null
  }
  await patchInboxState(conversation.id, { awaitingReply: true })
  await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'escalation_holding', actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: `Mensaje de espera (${kind})` } })
  return result.saved.id
}

async function lastHandoffReason(conversationId: string) {
  const e = await prisma.conversationEvent.findFirst({ where: { conversationId, type: 'ai_handoff' }, orderBy: { createdAt: 'desc' }, select: { detail: true } })
  return e?.detail ?? null
}

const waitText = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`)

async function runSteps(conversation: Conversation, plan: EscalationPlan, anchor: Date, now: Date) {
  const { CHANNEL_TEXT } = await import('@/lib/messaging/wa-specs')
  const { waUnanswered } = await import('@/lib/messaging/wa-events')
  const channel = CHANNEL_TEXT[conversation.channel] ?? conversation.channel
  const who = conversation.contactName || conversation.contactPhone || 'Un contacto'
  const handoff = conversation.aiHandoffAt && conversation.aiHandoffAt.getTime() === anchor.getTime() ? await lastHandoffReason(conversation.id) : null
  const wait = waitText(plan.elapsedMinutes)
  const reason = `${wait} sin respuesta${handoff ? ` tras el traspaso (${handoff})` : ''}`.slice(0, 160)
  const step = (name: string) => `${name}:${anchor.getTime()}`
  const notes: string[] = []

  if (plan.alert) {
    const assignee = plan.alert === 'notify' ? await assignedAdmin(conversation.assignedToId) : null
    const recipients = assignee ? [assignee.id] : await workspaceAdminIds(conversation.workspaceId)
    await notifyAdminsInApp(recipients, {
      title: plan.alert === 'escalate' ? `Urgente: ${who} sigue sin respuesta` : `${who} espera respuesta`,
      message: `${channel}: ${reason}.`,
      conversationId: conversation.id,
      kind: 'INBOX_UNANSWERED',
    })
    // WhatsApp to the team only in its hours; at night the in-app alert waits for them
    if (!conversation.isTest && teamHours(new Date()).open) await waUnanswered({ conversationId: conversation.id, workspaceId: conversation.workspaceId, channel: conversation.channel, reason, step: step(plan.alert), adminUserId: assignee?.id ?? null })
    notes.push(assignee ? `Avisamos a ${assignee.name || 'la persona asignada'}` : 'Avisamos a todo el equipo')
    if (plan.alert === 'escalate') {
      await ladderIncident(LADDER_INCIDENT_HIGH, 'HIGH', conversation.id, `${who} lleva ${wait} sin respuesta (${channel})`, `Nadie del equipo ha respondido. ${reason}. Abrir: ${inboxPath(conversation.id)}`)
      notes.push('incidente alto')
    }
  }
  if (plan.critical) {
    await ladderIncident(LADDER_INCIDENT_CRITICAL, 'CRITICAL', conversation.id, `${who} lleva ${wait} sin respuesta (${channel})`, `Nadie del equipo ha respondido en ${wait}. ${reason}. Abrir: ${inboxPath(conversation.id)}`)
    notes.push('incidente crítico')
  }

  let holding: { at: Date; messageId: string | null } | null = null
  if (plan.holding) {
    const agent = await holdingAgent(conversation)
    const messageId = agent ? await sendHolding(conversation, agent, now) : null
    if (messageId) {
      holding = { at: now, messageId }
      notes.push('la IA le dijo al cliente que una persona le responderá')
    }
  }

  if (notes.length) {
    await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'escalation', ...ACTOR, detail: `${reason}: ${notes.join(', ')}`.slice(0, 900) } })
    await prisma.conversationMessage.create({
      data: { conversationId: conversation.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AUTOMATION', body: `⏰ El cliente lleva ${wait} esperando a una persona. ${notes.join(', ')}.` },
    })
  }
  if (conversation.priority !== 'high') await prisma.conversation.update({ where: { id: conversation.id }, data: { priority: 'high' } })
  return holding
}

/**
 * Could the AI send the holding message now? Automations on, inside the channel window, and — when it was not
 * a handoff — no person owns the conversation or wrote in it lately (the AI never speaks over a person).
 */
async function holdingPossible(conversation: Conversation, now: Date, handedOff: boolean) {
  if (conversation.automationsPaused || conversation.threadOwner) return false
  if (!handedOff) {
    if (conversation.assignedToId) return false
    const { humanActiveRecently } = await import('@/lib/ai/autopilot')
    if (await humanActiveRecently(conversation.id, now)) return false
  }
  const lastIn = await prisma.conversationMessage.findFirst({ where: { conversationId: conversation.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
  return Boolean(lastIn && insideReplyWindow(conversation.channel, lastIn.sentAt, now))
}

/**
 * Every minute: open conversations not handled by the AI whose contact waits for a person. Stops as soon as a
 * person answers, it is closed or snoozed, or the AI takes it (copilot takeover).
 */
export async function runEscalationLadder(opts: { limit?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date()
  const s = ESCALATION_SETTINGS
  const since = new Date(now.getTime() - s.maxAgeHours * HOUR - 10 * MIN)
  const convs = await prisma.conversation.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] }, isTest: false, aiSpam: false, aiHandled: false, threadOwner: null,
      channel: { notIn: [...COMMENT_CHANNELS] },
      OR: [
        { aiHandoffAt: { gte: since, lte: new Date(now.getTime() - s.notifyMinutes * MIN) } },
        { customFields: { path: ['inbox', 'awaitingReply'], equals: true }, lastMessageAt: { gte: since } },
      ],
    },
    // Newest first: old waits the loop keeps skipping must never crowd out new ones
    orderBy: { lastMessageAt: 'desc' },
    take: opts.limit ?? 200,
  })
  const deadline = Date.now() + 40_000
  const counts = { checked: convs.length, alerted: 0, escalated: 0, critical: 0, holding: 0 }
  const { hit } = await import('@/lib/rate-limit-store')

  for (const conversation of convs) {
    if (Date.now() > deadline) break
    try {
      const inbox = readInboxState(conversation.customFields)
      if (inbox.automatedOnly || (inbox.snoozedUntil && inbox.snoozedUntil > now.toISOString())) continue
      const recent = await prisma.conversationMessage.findMany({
        where: { conversationId: conversation.id, isInternal: false },
        orderBy: { sentAt: 'desc' },
        take: 60,
        select: { id: true, direction: true, isInternal: true, sentById: true, senderType: true, sentAt: true, body: true, mediaUrl: true },
      })
      const state = inbox.escalation ?? null
      const anchor = waitingAnchor({ aiHandoffAt: conversation.aiHandoffAt, messages: recent, ignoreIds: state?.holdingMessageId ? [state.holdingMessageId] : [] })
      if (!anchor) continue

      // Not a handoff: when the copilot is going to take it over, the AI covers it
      const handedOff = Boolean(conversation.aiHandoffAt && conversation.aiHandoffAt.getTime() === anchor.getTime())
      if (!handedOff) {
        // «ok», «gracias», 👍: nothing to answer
        const pending = recent.filter((m) => m.direction === 'INBOUND' && m.sentAt.getTime() >= anchor.getTime())
        if (pending.length && pending.every((m) => !m.mediaUrl && isTrivialAck(m.body))) continue
        const { copilotState } = await import('@/lib/ai/copilot')
        const { timer } = await copilotState(conversation).catch(() => ({ timer: { action: 'none' as const, reason: 'error' } }))
        if (timer.action !== 'none' && timer.mode === 'takeover') continue
        // The autopilot covers it: the AI answers, nobody tells the client «una persona te responderá»
        const { shouldTakeOver } = await import('@/lib/ai/autopilot')
        if ((await shouldTakeOver(conversation).catch(() => ({ take: false }))).take) continue
      }

      let plan = planEscalation({ anchor, now, state, holdingPossible: true })
      if (!plan.mark.length) continue
      if (plan.holding && !(await holdingPossible(conversation, now, handedOff))) plan = { ...plan, holding: false }

      // Two runs at once: only one acts on this wait and these steps
      if ((await hit(`escalation:${conversation.id}:${anchor.getTime()}:${plan.mark.join(',')}`, 6 * HOUR, now.getTime())).count > 1) continue
      await patchInboxState(conversation.id, { escalation: nextEscalationState(state, anchor, plan) })

      const holding = await runSteps(conversation, plan, anchor, now)
      if (holding) await patchInboxState(conversation.id, { escalation: nextEscalationState(state, anchor, plan, holding) })

      if (plan.alert === 'notify') counts.alerted++
      if (plan.alert === 'escalate') counts.escalated++
      if (plan.critical) counts.critical++
      if (holding) counts.holding++
      emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
    } catch (err) {
      logger.warn('Escalation step failed', { conversationId: conversation.id, err: err instanceof Error ? err.message : err })
    }
  }
  const resolved = await resolveAnsweredIncidents(now).catch(() => 0)
  return { ...counts, resolved }
}

/** The ladder's incidents close by themselves once a person answered, the case was closed, snoozed or given back to the AI. */
export async function resolveAnsweredIncidents(now = new Date()) {
  const open = await prisma.adminIncident.findMany({
    where: { type: { in: [LADDER_INCIDENT_HIGH, LADDER_INCIDENT_CRITICAL] }, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    select: { id: true, route: true, firstSeenAt: true },
    take: 50,
  })
  if (!open.length) return 0
  const { isHumanMessage } = await import('@/lib/ai/runtime-core')
  const { setIncidentStatus } = await import('@/lib/ops/platform-ops')
  let resolved = 0
  for (const inc of open) {
    const id = inc.route?.split('?c=')[1]
    if (!id) continue
    const conv = await prisma.conversation.findUnique({ where: { id }, select: { status: true, aiHandled: true, customFields: true } })
    let done = !conv || conv.status === 'RESOLVED' || conv.status === 'CLOSED' || conv.aiHandled
    if (!done && conv) {
      const snoozed = readInboxState(conv.customFields).snoozedUntil
      done = Boolean(snoozed && snoozed > now.toISOString())
    }
    if (!done) {
      const replies = await prisma.conversationMessage.findMany({
        where: { conversationId: id, direction: 'OUTBOUND', isInternal: false, sentAt: { gte: inc.firstSeenAt } },
        select: { direction: true, isInternal: true, sentById: true, senderType: true, sentAt: true },
        take: 20,
      })
      done = replies.some(isHumanMessage)
    }
    if (!done) continue
    await setIncidentStatus(inc.id, 'RESOLVED', 'sistema').catch(() => null)
    resolved++
  }
  return resolved
}
