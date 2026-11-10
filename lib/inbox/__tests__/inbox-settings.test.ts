import { describe, expect, it } from 'vitest'
import { DEFAULT_INBOX_CONFIG, sanitizeInboxConfig, waitingRuleOf } from '@/lib/inbox/settings-core'
import { planEscalation, staleLeadDecision, teamHours, type StaleLeadRow } from '@/lib/inbox/escalation-core'
import { DEFAULT_WAITING_RULE, waitingState, whatsappWindowError, WA_WINDOW_CLOSED_ERROR } from '@/lib/inbox/waiting'
import { csatSkipReason, type CsatAskInput } from '@/lib/inbox/csat-core'
import { inactivityCloseDecision, type InactivityInput } from '@/lib/ai/conversation-core'

const MIN = 60_000
const HOUR = 60 * MIN
// 15:00 UTC = 10:00 in Bogotá
const now = new Date('2026-11-09T15:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('sanitizeInboxConfig', () => {
  it('fills a missing row with the defaults', () => {
    expect(sanitizeInboxConfig(null)).toEqual(DEFAULT_INBOX_CONFIG)
  })

  it('clamps values and keeps the ladder in order', () => {
    const c = sanitizeInboxConfig({ escalation: { notifyMinutes: 20, escalateMinutes: 5, criticalMinutes: '3' }, overdueMinutes: 9999, csat: { cooldownDays: 0 } })
    expect(c.escalation.notifyMinutes).toBe(20)
    expect(c.escalation.escalateMinutes).toBe(21)
    expect(c.escalation.criticalMinutes).toBe(22)
    expect(c.overdueMinutes).toBe(240)
    expect(c.csat.cooldownDays).toBe(1)
  })

  it('a blank number falls back to the default', () => {
    expect(sanitizeInboxConfig({ overdueMinutes: '' }).overdueMinutes).toBe(DEFAULT_INBOX_CONFIG.overdueMinutes)
  })
})

describe('escalation with custom settings', () => {
  const s = sanitizeInboxConfig({ escalation: { notifyMinutes: 5, escalateMinutes: 15, criticalMinutes: 45, holdingMinutes: 20 } }).escalation

  it('notifies earlier than the default', () => {
    const plan = planEscalation({ anchor: ago(6 * MIN), now, state: null, holdingPossible: true, settings: s })
    expect(plan.alert).toBe('notify')
    expect(planEscalation({ anchor: ago(6 * MIN), now, state: null, holdingPossible: true }).alert).toBeNull()
  })

  it('goes critical at the configured minute', () => {
    const plan = planEscalation({ anchor: ago(46 * MIN), now, state: null, holdingPossible: true, settings: s })
    expect(plan.critical).toBe(true)
    expect(plan.alert).toBe('escalate')
  })

  it('holding off: the step is marked done but nothing is sent', () => {
    const plan = planEscalation({ anchor: ago(25 * MIN), now, state: null, holdingPossible: false, settings: s })
    expect(plan.mark).toContain('holding')
    expect(plan.holding).toBe(false)
  })

  it('team hours from settings', () => {
    const late = sanitizeInboxConfig({ escalation: { teamOpenHour: 11, teamCloseHour: 20 } }).escalation
    expect(teamHours(now, late).open).toBe(false)
    expect(teamHours(now).open).toBe(true)
  })

  it('stale sweep honors staleAfterHours', () => {
    const row: StaleLeadRow = { channel: 'SMS', status: 'OPEN', isTest: false, aiSpam: false, automatedOnly: false, snoozed: false, unanswered: true, lastInboundAt: ago(3 * HOUR) }
    expect(staleLeadDecision(row, { now, aiCovers: false }).action).toBe('reopen')
    const slow = sanitizeInboxConfig({ escalation: { staleAfterHours: 6 } }).escalation
    expect(staleLeadDecision(row, { now, aiCovers: false, settings: slow })).toEqual({ action: 'skip', reason: 'recent' })
  })
})

describe('waiting rule', () => {
  it('overdue with custom minutes', () => {
    const rule = waitingRuleOf(sanitizeInboxConfig({ overdueMinutes: 5 }))
    expect(waitingState(ago(8 * MIN).toISOString(), now.getTime(), rule)?.level).toBe('overdue')
    expect(waitingState(ago(8 * MIN).toISOString(), now.getTime(), DEFAULT_WAITING_RULE)?.level).toBe('waiting')
  })

  it('critical uses the ladder minutes', () => {
    const rule = waitingRuleOf(sanitizeInboxConfig({ escalation: { criticalMinutes: 60 } }))
    expect(waitingState(ago(61 * MIN).toISOString(), now.getTime(), rule)?.level).toBe('critical')
    expect(waitingState(ago(61 * MIN).toISOString(), now.getTime())?.level).toBe('overdue')
  })

  it('outside team hours nothing turns red', () => {
    const rule = waitingRuleOf(sanitizeInboxConfig({ escalation: { teamOpenHour: 12, teamCloseHour: 20 } }))
    const w = waitingState(ago(300 * MIN).toISOString(), now.getTime(), rule)
    expect(w?.overdue).toBe(false)
    expect(w?.level).toBe('waiting')
  })
})

describe('WhatsApp 24 h window on the server', () => {
  it('blocks free text outside the window', () => {
    expect(whatsappWindowError({ channel: 'WHATSAPP', template: false, lastInboundAt: ago(25 * HOUR) }, now.getTime())).toBe(WA_WINDOW_CLOSED_ERROR)
    expect(whatsappWindowError({ channel: 'WHATSAPP', template: false, lastInboundAt: null }, now.getTime())).toBe(WA_WINDOW_CLOSED_ERROR)
  })

  it('allows free text inside the window, templates always, and other channels', () => {
    expect(whatsappWindowError({ channel: 'WHATSAPP', template: false, lastInboundAt: ago(2 * HOUR) }, now.getTime())).toBeNull()
    expect(whatsappWindowError({ channel: 'WHATSAPP', template: true, lastInboundAt: ago(30 * HOUR) }, now.getTime())).toBeNull()
    expect(whatsappWindowError({ channel: 'SMS', template: false, lastInboundAt: null }, now.getTime())).toBeNull()
  })
})

describe('csat and auto-close from settings', () => {
  const ask: CsatAskInput = {
    channel: 'WHATSAPP', status: 'RESOLVED', reason: 'gestionada', automatedOnly: false, aiSpam: false, isTest: false, optedOut: false,
    csatAskedAt: ago(3 * 24 * HOUR).toISOString(), lastInboundAt: ago(HOUR), replied: true,
  }

  it('disabled survey is never sent', () => {
    expect(csatSkipReason(ask, now.getTime(), { enabled: false })).toBe('disabled')
  })

  it('cooldown in days from settings', () => {
    expect(csatSkipReason(ask, now.getTime())).toBe('recent')
    expect(csatSkipReason(ask, now.getTime(), { cooldownMs: 2 * 24 * HOUR })).toBeNull()
  })

  it('inactivity hours from settings', () => {
    const c: InactivityInput = {
      status: 'OPEN', aiHandled: true, assignedToId: null, aiHandoffAt: null, isTest: false, pendingActions: 0, waitingAfterHours: false,
      lastMessage: { direction: 'OUTBOUND', senderType: 'AI', sentAt: ago(10 * HOUR) },
    }
    expect(inactivityCloseDecision(c, now)).toEqual({ close: false, why: 'too_recent' })
    expect(inactivityCloseDecision(c, now, 8 * HOUR)).toEqual({ close: true })
  })
})
