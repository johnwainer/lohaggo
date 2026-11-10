/**
 * Escalation when a contact waits for a person (after an AI handoff, or a message in «Por responder» that no
 * AI covers), and the daily sweep of leads nobody answered. Pure rules here; wiring in lib/inbox/escalation.ts
 * and lib/inbox/stale-leads.ts.
 */
import { isHumanMessage, type OutboundLike } from '@/lib/ai/runtime-core'

/** Times of the ladder and of the sweep. These are the defaults; the admin edits them in InboxSettings (lib/inbox/settings.ts). */
export type EscalationSettings = {
  notifyMinutes: number
  escalateMinutes: number
  criticalMinutes: number
  holdingMinutes: number
  holdingCooldownHours: number
  maxAgeHours: number
  teamOpenHour: number
  teamCloseHour: number
  teamTimezone: string
  staleAfterHours: number
  staleLookbackDays: number
  staleSweepHour: number
}

export const ESCALATION_SETTINGS: Readonly<EscalationSettings> = {
  /** In-app + WhatsApp (D1) to the assigned admin, or to every admin if nobody has it */
  notifyMinutes: 10,
  /** In-app + WhatsApp (D1) to every admin and a HIGH incident */
  escalateMinutes: 30,
  /** CRITICAL incident (D9 by WhatsApp to every admin) */
  criticalMinutes: 120,
  /** The AI tells the contact that a person will answer and what can be done meanwhile (once) */
  holdingMinutes: 30,
  /** A holding message at most once in this period, even if the contact starts waiting again */
  holdingCooldownHours: 24,
  /** Past this wait the ladder stops: the daily sweep of stale leads takes it */
  maxAgeHours: 24,
  /** Team hours in Bogotá: outside them the holding message says when the team answers */
  teamOpenHour: 7,
  teamCloseHour: 21,
  teamTimezone: 'America/Bogota',
  /** Sweep: the contact's last message is older than this and nobody answered */
  staleAfterHours: 2,
  /** Sweep: older conversations are not looked at */
  staleLookbackDays: 60,
  /** Sweep: the hour (Bogotá) of the daily run and of the summary to the admins */
  staleSweepHour: 8,
}

export const ESCALATION_STEPS = ['notify', 'escalate', 'critical', 'holding'] as const
export type EscalationStep = (typeof ESCALATION_STEPS)[number]

/** Stored in customFields.inbox.escalation: what was already done for the current wait. */
export type EscalationState = {
  /** ISO time the contact started waiting for a person */
  anchor: string
  steps: EscalationStep[]
  holdingAt?: string | null
  holdingMessageId?: string | null
}

export const STALE_LEAD_TAG = 'lead-sin-respuesta'

const MIN = 60_000
const HOUR = 60 * MIN

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function readEscalation(raw: unknown): EscalationState | null {
  const o = asObject(raw)
  if (typeof o.anchor !== 'string') return null
  const steps = Array.isArray(o.steps) ? o.steps.filter((s): s is EscalationStep => (ESCALATION_STEPS as readonly string[]).includes(s as string)) : []
  return {
    anchor: o.anchor,
    steps,
    holdingAt: typeof o.holdingAt === 'string' ? o.holdingAt : null,
    holdingMessageId: typeof o.holdingMessageId === 'string' ? o.holdingMessageId : null,
  }
}

export type EscalationMessage = OutboundLike & { id: string }

/**
 * Since when the contact waits for a person, or null if nobody is owed an answer.
 * A handoff not followed by a human message counts from the handoff (the AI's handoff text is not an answer).
 * Otherwise: the first message of the contact after our last real reply (our own holding message aside).
 */
export function waitingAnchor(input: { aiHandoffAt: Date | null; messages: EscalationMessage[]; ignoreIds?: string[] }): Date | null {
  const ignore = new Set(input.ignoreIds ?? [])
  const msgs = input.messages.filter((m) => !m.isInternal).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
  const lastHuman = msgs.filter(isHumanMessage).pop()
  if (input.aiHandoffAt && (!lastHuman || lastHuman.sentAt.getTime() < input.aiHandoffAt.getTime())) return input.aiHandoffAt
  const lastOut = msgs.filter((m) => m.direction === 'OUTBOUND' && m.senderType !== 'AUTOMATION' && !ignore.has(m.id)).pop()
  const firstIn = msgs.find((m) => m.direction === 'INBOUND' && (!lastOut || m.sentAt.getTime() > lastOut.sentAt.getTime()))
  return firstIn?.sentAt ?? null
}

const ACKS = new Set(['ok', 'okay', 'oki', 'listo', 'vale', 'dale', 'gracias', 'muchas gracias', 'mil gracias', 'ok gracias', 'listo gracias', 'perfecto', 'perfecto gracias', 'bueno', 'bien', 'de una', 'genial', 'excelente', 'entendido', 'stop', 'baja'])

/** «ok», «gracias», a thumbs up, a single emoji: nothing a person must answer. Pure. */
export function isTrivialAck(body: string | null | undefined) {
  const t = (body ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  return t === '' ? Boolean(body?.trim()) : ACKS.has(t)
}

export type EscalationPlan = {
  /** The wait changed: the stored steps belong to an older one */
  reset: boolean
  elapsedMinutes: number
  /** Steps that become done in this run (also those skipped because a later one covers them) */
  mark: EscalationStep[]
  /** The alert to send now: the highest due one ('escalate' covers 'notify' if both are due) */
  alert: 'notify' | 'escalate' | null
  critical: boolean
  holding: boolean
}

const NOTHING = (reset: boolean, elapsedMinutes: number): EscalationPlan => ({ reset, elapsedMinutes, mark: [], alert: null, critical: false, holding: false })

/**
 * What to do now for one wait. Each step at most once per wait; the holding message at most once per
 * holdingCooldownHours. `holdingPossible` false (no agent, window closed, automations paused) marks it as done.
 */
export function planEscalation(input: {
  anchor: Date
  now: Date
  state: EscalationState | null
  holdingPossible: boolean
  settings?: Pick<EscalationSettings, 'notifyMinutes' | 'escalateMinutes' | 'criticalMinutes' | 'holdingMinutes' | 'holdingCooldownHours' | 'maxAgeHours'>
}): EscalationPlan {
  const s = input.settings ?? ESCALATION_SETTINGS
  const elapsed = input.now.getTime() - input.anchor.getTime()
  const elapsedMinutes = Math.max(0, Math.floor(elapsed / MIN))
  const reset = !input.state || input.state.anchor !== input.anchor.toISOString()
  if (elapsed < 0 || elapsed > s.maxAgeHours * HOUR) return NOTHING(reset, elapsedMinutes)
  const done = new Set(reset ? [] : input.state!.steps)
  const due = (step: EscalationStep, minutes: number) => !done.has(step) && elapsed >= minutes * MIN
  const notify = due('notify', s.notifyMinutes)
  const escalate = due('escalate', s.escalateMinutes)
  const critical = due('critical', s.criticalMinutes)
  const holdingDue = due('holding', s.holdingMinutes)
  const lastHolding = input.state?.holdingAt ? new Date(input.state.holdingAt).getTime() : null
  const cooled = lastHolding === null || input.now.getTime() - lastHolding >= s.holdingCooldownHours * HOUR
  const mark: EscalationStep[] = []
  if (notify || escalate) mark.push('notify')
  if (escalate) mark.push('escalate')
  if (critical) mark.push('critical')
  if (holdingDue) mark.push('holding')
  return {
    reset,
    elapsedMinutes,
    mark,
    alert: escalate ? 'escalate' : notify ? 'notify' : null,
    critical,
    holding: holdingDue && cooled && input.holdingPossible,
  }
}

/** Steps stored after a run. Pure. */
export function nextEscalationState(prev: EscalationState | null, anchor: Date, plan: EscalationPlan, holding?: { at: Date; messageId: string | null } | null): EscalationState {
  const base = plan.reset || !prev ? [] : prev.steps
  return {
    anchor: anchor.toISOString(),
    steps: Array.from(new Set([...base, ...plan.mark])),
    holdingAt: holding ? holding.at.toISOString() : prev?.holdingAt ?? null,
    holdingMessageId: holding ? holding.messageId : plan.reset ? null : prev?.holdingMessageId ?? null,
  }
}

// ─── Team hours ─────────────────────────────────────────────────────────────

function localHour(now: Date, timeZone: string) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now))
  return Number.isFinite(h) ? h % 24 : now.getUTCHours()
}

/** Is the team working now (7–21 Bogotá by default)? Outside, when it answers: «hoy» before 7, «mañana» after 21. */
export function teamHours(now: Date, s: Pick<EscalationSettings, 'teamOpenHour' | 'teamCloseHour' | 'teamTimezone'> = ESCALATION_SETTINGS) {
  const h = localHour(now, s.teamTimezone)
  if (h >= s.teamOpenHour && h < s.teamCloseHour) return { open: true as const, reopens: null }
  return { open: false as const, reopens: h < s.teamOpenHour ? ('hoy' as const) : ('mañana' as const) }
}

/** «7:00 a. m.» */
export function hourText(h: number) {
  const suffix = h < 12 ? 'a. m.' : 'p. m.'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve}:00 ${suffix}`
}

// ─── Holding message ────────────────────────────────────────────────────────

/** What the contact has going on, to offer something useful while a person answers. */
export type HoldingCase = 'booking' | 'request' | 'partner' | 'unlinked'

export function holdingCaseOf(input: { role: string | null; activeBookings: number; activeRequests: number }): HoldingCase {
  if (input.role === 'PARTNER') return 'partner'
  if (input.role === 'CLIENT' && input.activeBookings > 0) return 'booking'
  if (input.role === 'CLIENT' && input.activeRequests > 0) return 'request'
  return 'unlinked'
}

/**
 * The holding message: a person will answer (never a time inside hours), what the contact can do now, and
 * outside team hours when the team answers. Plain text; the caller formats it for the channel.
 */
export function holdingMessage(input: { firstName?: string | null; kind: HoldingCase; now: Date; appUrl: string; settings?: Pick<EscalationSettings, 'teamOpenHour' | 'teamCloseHour' | 'teamTimezone'> }) {
  const s = input.settings ?? ESCALATION_SETTINGS
  const name = input.firstName?.trim().split(/\s+/)[0]
  const url = input.appUrl.replace(/\/+$/, '')
  const hours = teamHours(input.now, s)
  const greeting = name ? `Hola ${name}, ` : 'Hola, '
  const who = hours.open
    ? `${greeting}una persona de nuestro equipo ya tiene tu caso y te va a responder por aquí.`
    : `${greeting}una persona de nuestro equipo te va a responder por aquí. Atendemos de ${hourText(s.teamOpenHour)} a ${hourText(s.teamCloseHour)}, así que te escribimos ${hours.reopens} desde las ${hourText(s.teamOpenHour)}.`
  const meanwhile: Record<HoldingCase, string> = {
    booking: `Mientras tanto, en tu reserva puedes avisar que el socio no llegó, pedir otro socio o cancelarla: ${url}/dashboard?tab=bookings. Y si me cuentas aquí qué pasó, se lo dejo anotado a quien te va a atender.`,
    request: `Mientras tanto, en tu panel puedes ver las propuestas de los socios o volver a publicar tu solicitud: ${url}/dashboard?tab=requests. Si me cuentas aquí los detalles, se los dejo anotados a quien te va a atender.`,
    partner: `Mientras tanto, desde tu panel puedes revisar y volver a subir tus documentos: ${url}/partner/verification. Si algo no carga, cuéntame aquí qué archivo es y qué te sale, y se lo dejo anotado a quien te va a atender.`,
    unlinked: `Mientras tanto, cuéntame aquí qué servicio necesitas, en qué barrio y para cuándo, y se lo dejo anotado a quien te va a atender. También puedes pedirlo directamente en ${url}.`,
  }
  return `${who}\n\n${meanwhile[input.kind]}`
}

// ─── Stale leads sweep ──────────────────────────────────────────────────────

/** Channels with a 24 h customer-service window (outside it nothing free can be sent). */
const WINDOW_CHANNELS = new Set(['WHATSAPP', 'MESSENGER', 'INSTAGRAM'])
const CHANNEL_WINDOW_MS = 24 * HOUR

/** Can we still answer freely? SMS has no window; WhatsApp and Meta 24 h since the contact's last message. A margin of 30 min. */
export function insideReplyWindow(channel: string, lastInboundAt: Date, now: Date) {
  if (!WINDOW_CHANNELS.has(channel)) return true
  return now.getTime() - lastInboundAt.getTime() < CHANNEL_WINDOW_MS - 30 * MIN
}

export type StaleLeadRow = {
  channel: string
  status: string
  isTest: boolean
  aiSpam: boolean
  automatedOnly: boolean
  snoozed: boolean
  /** Nobody answered the contact's last message (an AI handoff text or holding message is not an answer) */
  unanswered: boolean
  lastInboundAt: Date | null
}

export type StaleLeadDecision =
  | { action: 'skip'; reason: 'closed' | 'test' | 'spam' | 'automated' | 'snoozed' | 'answered' | 'recent' | 'too_old' }
  | { action: 'ai_reply' | 'reopen' }

/**
 * One conversation in the daily sweep: answered now by the AI (inside the window and an agent covers it) or
 * put back in «Por responder» with the tag. Never a message outside the window.
 */
export function staleLeadDecision(row: StaleLeadRow, ctx: { now: Date; aiCovers: boolean; settings?: Pick<EscalationSettings, 'staleAfterHours' | 'staleLookbackDays'> }): StaleLeadDecision {
  const s = ctx.settings ?? ESCALATION_SETTINGS
  if (row.status === 'RESOLVED' || row.status === 'CLOSED') return { action: 'skip', reason: 'closed' }
  if (row.isTest) return { action: 'skip', reason: 'test' }
  if (row.aiSpam) return { action: 'skip', reason: 'spam' }
  if (row.automatedOnly) return { action: 'skip', reason: 'automated' }
  if (row.snoozed) return { action: 'skip', reason: 'snoozed' }
  if (!row.unanswered || !row.lastInboundAt) return { action: 'skip', reason: 'answered' }
  const age = ctx.now.getTime() - row.lastInboundAt.getTime()
  if (age < s.staleAfterHours * HOUR) return { action: 'skip', reason: 'recent' }
  if (age > s.staleLookbackDays * 24 * HOUR) return { action: 'skip', reason: 'too_old' }
  if (ctx.aiCovers && insideReplyWindow(row.channel, row.lastInboundAt, ctx.now)) return { action: 'ai_reply' }
  return { action: 'reopen' }
}

/** «2026-11-09» in Bogotá: one sweep and one summary per day. */
export function bogotaDateKey(now: Date, timeZone: string = ESCALATION_SETTINGS.teamTimezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Is it the sweep's hour (Bogotá)? */
export function isSweepHour(now: Date, s: Pick<EscalationSettings, 'staleSweepHour' | 'teamTimezone'> = ESCALATION_SETTINGS) {
  return localHour(now, s.teamTimezone) === s.staleSweepHour
}
