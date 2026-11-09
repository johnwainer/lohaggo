import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  bogotaDateKey, holdingCaseOf, holdingMessage, insideReplyWindow, isSweepHour, isTrivialAck, nextEscalationState, planEscalation, readEscalation,
  staleLeadDecision, teamHours, waitingAnchor, type EscalationMessage, type StaleLeadRow,
} from '@/lib/inbox/escalation-core'
import { readInboxState } from '@/lib/inbox/state'

const MIN = 60_000
const HOUR = 60 * MIN
// 15:00 UTC = 10:00 in Bogotá (UTC-5)
const now = new Date('2026-11-09T15:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

const msg = (over: Partial<EscalationMessage> & { direction: string; sentAt: Date }): EscalationMessage => ({
  id: Math.random().toString(36).slice(2), isInternal: false, sentById: null, senderType: null, ...over,
})

describe('waitingAnchor', () => {
  it('a handoff without a later human message counts from the handoff (the AI handoff text is not an answer)', () => {
    const handoff = ago(40 * MIN)
    const messages = [
      msg({ direction: 'INBOUND', sentAt: ago(41 * MIN) }),
      msg({ direction: 'OUTBOUND', senderType: 'AI', sentAt: ago(40 * MIN) }),
      msg({ direction: 'INBOUND', sentAt: ago(5 * MIN) }),
    ]
    expect(waitingAnchor({ aiHandoffAt: handoff, messages })).toEqual(handoff)
  })

  it('a person answered after the handoff: only a new message of the contact opens a new wait', () => {
    const messages = [
      msg({ direction: 'OUTBOUND', senderType: 'HUMAN', sentById: 'u1', sentAt: ago(30 * MIN) }),
    ]
    expect(waitingAnchor({ aiHandoffAt: ago(60 * MIN), messages })).toBeNull()
    const again = [...messages, msg({ direction: 'INBOUND', sentAt: ago(12 * MIN) }), msg({ direction: 'INBOUND', sentAt: ago(2 * MIN) })]
    expect(waitingAnchor({ aiHandoffAt: ago(60 * MIN), messages: again })).toEqual(ago(12 * MIN))
  })

  it('without handoff: the first unanswered message; internal notes, templates and our holding message do not answer', () => {
    const holding = msg({ direction: 'OUTBOUND', senderType: 'AI', sentAt: ago(10 * MIN) })
    const messages = [
      msg({ direction: 'OUTBOUND', senderType: 'HUMAN', sentById: 'u1', sentAt: ago(3 * HOUR) }),
      msg({ direction: 'INBOUND', sentAt: ago(50 * MIN) }),
      msg({ direction: 'OUTBOUND', isInternal: true, sentAt: ago(45 * MIN) }),
      msg({ direction: 'OUTBOUND', senderType: 'AUTOMATION', sentAt: ago(20 * MIN) }),
      holding,
    ]
    expect(waitingAnchor({ aiHandoffAt: null, messages, ignoreIds: [holding.id] })).toEqual(ago(50 * MIN))
  })

  it('answered (last message is ours) → nobody waits', () => {
    const messages = [msg({ direction: 'INBOUND', sentAt: ago(20 * MIN) }), msg({ direction: 'OUTBOUND', senderType: 'HUMAN', sentById: 'u1', sentAt: ago(5 * MIN) })]
    expect(waitingAnchor({ aiHandoffAt: null, messages })).toBeNull()
  })
})

describe('isTrivialAck', () => {
  it('acknowledgements need no answer; questions and problems do', () => {
    for (const t of ['ok', 'Gracias!!', 'muchas gracias 🙏', '👍', 'Listo, gracias', 'STOP']) expect(isTrivialAck(t)).toBe(true)
    for (const t of ['No me deja cargar los pdf', 'hola', '¿cuánto cuesta una manicure?', '', 'ok pero el socio no llegó']) expect(isTrivialAck(t)).toBe(false)
  })
})

describe('planEscalation (ladder timing and dedupe)', () => {
  it('before 10 min nothing; at 10 min the assigned admin', () => {
    expect(planEscalation({ anchor: ago(9 * MIN), now, state: null, holdingPossible: true }).mark).toEqual([])
    const p = planEscalation({ anchor: ago(10 * MIN), now, state: null, holdingPossible: true })
    expect(p).toMatchObject({ alert: 'notify', critical: false, holding: false, mark: ['notify'] })
  })

  it('at 30 min: everyone + HIGH incident + holding message, once', () => {
    const anchor = ago(31 * MIN)
    const afterNotify = { anchor: anchor.toISOString(), steps: ['notify' as const] }
    const p = planEscalation({ anchor, now, state: afterNotify, holdingPossible: true })
    expect(p).toMatchObject({ alert: 'escalate', critical: false, holding: true, mark: ['notify', 'escalate', 'holding'] })
    const stored = nextEscalationState(afterNotify, anchor, p, { at: now, messageId: 'm1' })
    expect(stored.steps.sort()).toEqual(['escalate', 'holding', 'notify'])
    expect(planEscalation({ anchor, now: new Date(now.getTime() + MIN), state: stored, holdingPossible: true }).mark).toEqual([])
  })

  it('a missed run: 30 min covers 10 min (one alert, the highest)', () => {
    const p = planEscalation({ anchor: ago(35 * MIN), now, state: null, holdingPossible: true })
    expect(p.alert).toBe('escalate')
    expect(p.mark).toContain('notify')
  })

  it('at 2 h: CRITICAL only (earlier steps already done)', () => {
    const anchor = ago(2 * HOUR)
    const state = { anchor: anchor.toISOString(), steps: ['notify', 'escalate', 'holding'] as Array<'notify' | 'escalate' | 'holding'> }
    expect(planEscalation({ anchor, now, state, holdingPossible: true })).toMatchObject({ alert: null, critical: true, holding: false, mark: ['critical'] })
  })

  it('a new wait resets the steps, but the holding message respects its 24 h cooldown', () => {
    const anchor = ago(40 * MIN)
    const old = { anchor: ago(5 * HOUR).toISOString(), steps: ['notify', 'escalate', 'critical', 'holding'] as Array<'notify' | 'escalate' | 'critical' | 'holding'>, holdingAt: ago(4 * HOUR).toISOString() }
    const p = planEscalation({ anchor, now, state: old, holdingPossible: true })
    expect(p.reset).toBe(true)
    expect(p.alert).toBe('escalate')
    expect(p.holding).toBe(false)
    expect(p.mark).toContain('holding')
    const later = { ...old, holdingAt: ago(25 * HOUR).toISOString() }
    expect(planEscalation({ anchor, now, state: later, holdingPossible: true }).holding).toBe(true)
  })

  it('holding not possible (window closed, paused, no agent) → marked done, not sent', () => {
    const p = planEscalation({ anchor: ago(31 * MIN), now, state: null, holdingPossible: false })
    expect(p.holding).toBe(false)
    expect(p.mark).toContain('holding')
  })

  it('past 24 h the ladder stops (the daily sweep takes it)', () => {
    expect(planEscalation({ anchor: ago(25 * HOUR), now, state: null, holdingPossible: true }).mark).toEqual([])
  })

  it('custom thresholds', () => {
    const settings = { notifyMinutes: 5, escalateMinutes: 15, criticalMinutes: 60, holdingMinutes: 15, holdingCooldownHours: 24, maxAgeHours: 24 }
    expect(planEscalation({ anchor: ago(6 * MIN), now, state: null, holdingPossible: true, settings }).alert).toBe('notify')
  })
})

describe('escalation state in customFields.inbox', () => {
  it('reads and ignores junk', () => {
    expect(readEscalation(null)).toBeNull()
    expect(readEscalation({ anchor: 'x', steps: ['notify', 'nope'] })).toEqual({ anchor: 'x', steps: ['notify'], holdingAt: null, holdingMessageId: null })
    expect(readInboxState({ inbox: { escalation: { anchor: 'a', steps: ['critical'] } } }).escalation?.steps).toEqual(['critical'])
  })
})

describe('team hours (7–21 Bogotá)', () => {
  it('open at 10:00, closed at 22:00 (answers «mañana») and at 5:00 (answers «hoy»)', () => {
    expect(teamHours(now)).toEqual({ open: true, reopens: null })
    expect(teamHours(new Date('2026-11-10T03:00:00.000Z'))).toEqual({ open: false, reopens: 'mañana' })
    expect(teamHours(new Date('2026-11-09T10:00:00.000Z'))).toEqual({ open: false, reopens: 'hoy' })
    expect(teamHours(new Date('2026-11-09T12:00:00.000Z')).open).toBe(true)
    expect(teamHours(new Date('2026-11-10T02:00:00.000Z')).open).toBe(false)
  })

  it('daily key and sweep hour in Bogotá', () => {
    expect(bogotaDateKey(new Date('2026-11-10T03:00:00.000Z'))).toBe('2026-11-09')
    expect(isSweepHour(new Date('2026-11-09T13:10:00.000Z'))).toBe(true)
    expect(isSweepHour(now)).toBe(false)
  })
})

describe('holding message', () => {
  it('picks the case', () => {
    expect(holdingCaseOf({ role: 'CLIENT', activeBookings: 1, activeRequests: 1 })).toBe('booking')
    expect(holdingCaseOf({ role: 'CLIENT', activeBookings: 0, activeRequests: 1 })).toBe('request')
    expect(holdingCaseOf({ role: 'CLIENT', activeBookings: 0, activeRequests: 0 })).toBe('unlinked')
    expect(holdingCaseOf({ role: 'PARTNER', activeBookings: 0, activeRequests: 0 })).toBe('partner')
    expect(holdingCaseOf({ role: null, activeBookings: 0, activeRequests: 0 })).toBe('unlinked')
  })

  it('inside hours: a person answers, no time promised; offers what can be done now', () => {
    const t = holdingMessage({ firstName: 'Ana María', kind: 'booking', now, appUrl: 'https://www.lohaggo.com/' })
    expect(t).toMatch(/^Hola Ana, una persona/)
    expect(t).toContain('https://www.lohaggo.com/dashboard?tab=bookings')
    expect(t).toMatch(/otro socio/)
    expect(t).not.toMatch(/\d+ ?min|minutos|en breve|enseguida/)
  })

  it('outside hours: says when the team answers', () => {
    const night = holdingMessage({ kind: 'partner', now: new Date('2026-11-10T03:00:00.000Z'), appUrl: 'https://x.co' })
    expect(night).toContain('mañana desde las 7:00 a. m.')
    expect(night).toContain('https://x.co/partner/verification')
    expect(holdingMessage({ kind: 'unlinked', now: new Date('2026-11-09T10:00:00.000Z'), appUrl: 'https://x.co' })).toContain('hoy desde las 7:00 a. m.')
  })
})

describe('stale leads sweep', () => {
  const row = (over: Partial<StaleLeadRow> = {}): StaleLeadRow => ({
    channel: 'WHATSAPP', status: 'OPEN', isTest: false, aiSpam: false, automatedOnly: false, snoozed: false, unanswered: true, lastInboundAt: ago(3 * HOUR), ...over,
  })

  it('reply window: 24 h on WhatsApp / Meta (30 min margin), none on SMS', () => {
    expect(insideReplyWindow('WHATSAPP', ago(23 * HOUR), now)).toBe(true)
    expect(insideReplyWindow('INSTAGRAM', ago(23.7 * HOUR), now)).toBe(false)
    expect(insideReplyWindow('SMS', ago(30 * 24 * HOUR), now)).toBe(true)
  })

  it('inside the window and the AI covers it → the AI answers now', () => {
    expect(staleLeadDecision(row(), { now, aiCovers: true })).toEqual({ action: 'ai_reply' })
  })

  it('outside the window (never a free message) or the AI does not cover it → back to «Por responder»', () => {
    expect(staleLeadDecision(row({ lastInboundAt: ago(6 * 24 * HOUR) }), { now, aiCovers: true })).toEqual({ action: 'reopen' })
    expect(staleLeadDecision(row({ channel: 'INSTAGRAM', lastInboundAt: ago(50 * 24 * HOUR) }), { now, aiCovers: true })).toEqual({ action: 'reopen' })
    expect(staleLeadDecision(row(), { now, aiCovers: false })).toEqual({ action: 'reopen' })
  })

  it('exclusions', () => {
    expect(staleLeadDecision(row({ status: 'CLOSED' }), { now, aiCovers: true })).toMatchObject({ action: 'skip', reason: 'closed' })
    expect(staleLeadDecision(row({ isTest: true }), { now, aiCovers: true })).toMatchObject({ reason: 'test' })
    expect(staleLeadDecision(row({ aiSpam: true }), { now, aiCovers: true })).toMatchObject({ reason: 'spam' })
    expect(staleLeadDecision(row({ automatedOnly: true }), { now, aiCovers: true })).toMatchObject({ reason: 'automated' })
    expect(staleLeadDecision(row({ snoozed: true }), { now, aiCovers: true })).toMatchObject({ reason: 'snoozed' })
    expect(staleLeadDecision(row({ unanswered: false }), { now, aiCovers: true })).toMatchObject({ reason: 'answered' })
    expect(staleLeadDecision(row({ lastInboundAt: ago(HOUR) }), { now, aiCovers: true })).toMatchObject({ reason: 'recent' })
    expect(staleLeadDecision(row({ lastInboundAt: ago(61 * 24 * HOUR) }), { now, aiCovers: true })).toMatchObject({ reason: 'too_old' })
  })
})
