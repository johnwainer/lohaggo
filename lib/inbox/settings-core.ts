/**
 * Inbox settings: what the admin can tune without a deploy. Pure (no DB): defaults, types and the sanitizer
 * every value goes through. Missing or invalid keys fall back to the defaults, so an old or partial row (or
 * no row at all) always yields a complete, safe config.
 */
import { ESCALATION_SETTINGS, type EscalationSettings } from '@/lib/inbox/escalation-core'
import type { WaitingRule } from '@/lib/inbox/waiting'

export type InboxConfig = {
  /** Escalation ladder and the daily sweep of unanswered leads (lib/inbox/escalation-core.ts) */
  escalation: EscalationSettings & { holdingEnabled: boolean; staleSweepEnabled: boolean }
  /** The «overdue» badge of the list: minutes a contact may wait inside team hours */
  overdueMinutes: number
  /** Close AI conversations whose contact stopped answering */
  autoClose: { enabled: boolean; inactivityHours: number }
  /** Satisfaction question when a conversation is closed as handled */
  csat: { enabled: boolean; cooldownDays: number }
  /** When the AI fails to answer a contact: back to «Por responder» and a critical incident */
  aiFailure: { backToQueue: boolean; incident: boolean }
  /** The AI looks at the photos the contact sends (describes the job, adds them to the request) */
  vision: { enabled: boolean; maxImages: number }
  /** A contact who left a request half-way gets one reminder after this many hours (0 = never) */
  funnel: { nudgeEnabled: boolean; nudgeAfterHours: number }
}

export const DEFAULT_INBOX_CONFIG: Readonly<InboxConfig> = {
  escalation: { ...ESCALATION_SETTINGS, holdingEnabled: true, staleSweepEnabled: true },
  overdueMinutes: 15,
  autoClose: { enabled: true, inactivityHours: 24 },
  csat: { enabled: true, cooldownDays: 7 },
  aiFailure: { backToQueue: true, incident: true },
  vision: { enabled: true, maxImages: 4 },
  funnel: { nudgeEnabled: true, nudgeAfterHours: 3 },
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def
}
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)

/** Any stored or submitted value → a complete, valid config. Ladder steps stay in order (notify < escalate < critical). */
export function sanitizeInboxConfig(raw: unknown): InboxConfig {
  const r = obj(raw)
  const d = DEFAULT_INBOX_CONFIG
  const e = obj(r.escalation)
  const notifyMinutes = int(e.notifyMinutes, d.escalation.notifyMinutes, 1, 240)
  const escalateMinutes = int(e.escalateMinutes, d.escalation.escalateMinutes, notifyMinutes + 1, 480)
  const criticalMinutes = int(e.criticalMinutes, d.escalation.criticalMinutes, escalateMinutes + 1, 1440)
  const teamOpenHour = int(e.teamOpenHour, d.escalation.teamOpenHour, 0, 23)
  const teamCloseHour = int(e.teamCloseHour, d.escalation.teamCloseHour, teamOpenHour + 1, 24)
  const tz = typeof e.teamTimezone === 'string' && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(e.teamTimezone) ? e.teamTimezone : d.escalation.teamTimezone
  const a = obj(r.autoClose)
  const c = obj(r.csat)
  const f = obj(r.aiFailure)
  const v = obj(r.vision)
  const n = obj(r.funnel)
  return {
    escalation: {
      notifyMinutes, escalateMinutes, criticalMinutes,
      holdingMinutes: int(e.holdingMinutes, d.escalation.holdingMinutes, 1, 480),
      holdingCooldownHours: int(e.holdingCooldownHours, d.escalation.holdingCooldownHours, 1, 168),
      maxAgeHours: int(e.maxAgeHours, d.escalation.maxAgeHours, 1, 168),
      teamOpenHour, teamCloseHour, teamTimezone: tz,
      staleAfterHours: int(e.staleAfterHours, d.escalation.staleAfterHours, 1, 72),
      staleLookbackDays: int(e.staleLookbackDays, d.escalation.staleLookbackDays, 1, 365),
      staleSweepHour: int(e.staleSweepHour, d.escalation.staleSweepHour, 0, 23),
      holdingEnabled: bool(e.holdingEnabled, d.escalation.holdingEnabled),
      staleSweepEnabled: bool(e.staleSweepEnabled, d.escalation.staleSweepEnabled),
    },
    overdueMinutes: int(r.overdueMinutes, d.overdueMinutes, 1, 240),
    autoClose: { enabled: bool(a.enabled, d.autoClose.enabled), inactivityHours: int(a.inactivityHours, d.autoClose.inactivityHours, 2, 168) },
    csat: { enabled: bool(c.enabled, d.csat.enabled), cooldownDays: int(c.cooldownDays, d.csat.cooldownDays, 1, 90) },
    // Always on: an AI failure with a contact must reach the team (CLAUDE.md, incident of 2026-10-13)
    aiFailure: { backToQueue: bool(f.backToQueue, d.aiFailure.backToQueue), incident: true },
    vision: { enabled: bool(v.enabled, d.vision.enabled), maxImages: int(v.maxImages, d.vision.maxImages, 1, 8) },
    funnel: { nudgeEnabled: bool(n.nudgeEnabled, d.funnel.nudgeEnabled), nudgeAfterHours: int(n.nudgeAfterHours, d.funnel.nudgeAfterHours, 1, 48) },
  }
}

/** What the inbox list needs to color «espera hace…» with the same numbers the ladder uses. */
export function waitingRuleOf(c: InboxConfig): WaitingRule {
  return {
    overdueMinutes: c.overdueMinutes,
    criticalMinutes: c.escalation.criticalMinutes,
    openHour: c.escalation.teamOpenHour,
    closeHour: c.escalation.teamCloseHour,
    timezone: c.escalation.teamTimezone,
  }
}
