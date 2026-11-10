/**
 * Partner reactivation campaign: the pure part (no DB). Segments, config (defaults + sanitizer), the steps of
 * each sequence, the stop rules, the control group, the template fallback while Meta has not approved a
 * template, the sending window and the lift report. lib/partners/reactivation.ts loads the data and sends.
 *
 * Segments (mutually exclusive, checked in this order):
 * - A: not verified, no documents, no active service · B: not verified, no documents, ≥1 active service
 * - D: not verified, a document waiting for review (we owe them the review: nothing is sent)
 * - E: not verified, a document rejected and not replaced · C: not verified, documents incomplete
 *   (C and E get a follow-up task for a person, never an automatic sequence)
 * - G: verified, a proposal or booking in the last 30 days (active: excluded)
 * - F: verified, never sent a proposal · H: verified, had proposals but none in 30 days
 */

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
export const CAMPAIGN_SEGMENTS = ['A', 'B', 'F', 'H'] as const
export type CampaignSegment = (typeof CAMPAIGN_SEGMENTS)[number]
export const FOLLOWUP_SEGMENTS: ReadonlySet<Segment> = new Set<Segment>(['C', 'E'])
export const isCampaignSegment = (s: Segment | null | undefined): s is CampaignSegment => s === 'A' || s === 'B' || s === 'F' || s === 'H'

export const SEGMENT_LABEL: Record<Segment, string> = {
  A: 'Sin documentos ni servicios',
  B: 'Sin documentos, con servicios',
  C: 'Documentos incompletos',
  D: 'Documentos por revisar',
  E: 'Documento rechazado',
  F: 'Verificado sin propuestas',
  G: 'Activo (últimos 30 días)',
  H: 'Verificado inactivo 30 días',
}

const H = 3600_000
const DAY = 24 * H
/** Minimum time between two sends of different days to the same partner (a long pause never sends a burst) */
export const MIN_STEP_GAP_MS = 20 * H
export const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

// ─── Config ─────────────────────────────────────────────────────────────────

export type StepDays = {
  /** A/B: WhatsApp «te falta un paso» (C46) */
  docsWa: number
  /** A/B: email with the 3 steps */
  docsEmail: number
  /** A/B: WhatsApp antecedentes guide (C47) */
  guideWa: number
  /** A/B: SMS */
  sms: number
  /** A/B: WhatsApp last notice (C48) */
  lastWa: number
  /** F/H: WhatsApp «ya estás verificado» (C49) */
  activateWa: number
  /** F/H: WhatsApp demand (C29), only with real recent demand */
  demandWa: number
  /** F: email with tips to win the first booking */
  tipsEmail: number
}

export type ReactivationConfig = {
  enabled: boolean
  /** Quick switch: nothing is sent while true (the config stays) */
  paused: boolean
  segments: Record<CampaignSegment, boolean>
  days: StepDays
  /** % of eligible partners who never receive anything (the lift report compares against them) */
  controlPct: number
  /** WhatsApp + SMS per Bogotá day */
  dailyLimit: number
  /** WhatsApp + SMS (and new enrollments) per hourly run */
  perRunLimit: number
  /** Days a WhatsApp step waits for Meta to approve its template before using the fallback */
  waitForApprovalDays: number
  /** Bogotá hours, Monday to Saturday */
  startHour: number
  endHour: number
  smsEnabled: boolean
  emailEnabled: boolean
  /** A document pending review longer than this opens an incident and notifies the admins */
  reviewSlaHours: number
  /** Marketing WhatsApp per partner in 14 days (all templates, not only this campaign) */
  maxMarketingWaPer14Days: number
  /** A partner who wrote to us pauses the sequence; it resumes after this many silent days */
  resumeAfterSilentDays: number
  /** Window of «real recent demand» for the C29 step */
  demandLookbackDays: number
  /** Window after enrollment counted as a conversion in the report */
  conversionWindowDays: number
}

export const DEFAULT_REACTIVATION_CONFIG: Readonly<ReactivationConfig> = {
  enabled: true,
  paused: false,
  segments: { A: true, B: true, F: true, H: true },
  days: { docsWa: 0, docsEmail: 0, guideWa: 3, sms: 7, lastWa: 10, activateWa: 0, demandWa: 5, tipsEmail: 12 },
  controlPct: 20,
  dailyLimit: 60,
  perRunLimit: 20,
  waitForApprovalDays: 3,
  startHour: 9,
  endHour: 19,
  smsEnabled: true,
  emailEnabled: true,
  reviewSlaHours: 12,
  maxMarketingWaPer14Days: 3,
  resumeAfterSilentDays: 5,
  demandLookbackDays: 14,
  conversionWindowDays: 14,
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def
}
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)

/** Any stored or submitted value → a complete, valid config (missing keys take the defaults). */
export function sanitizeReactivationConfig(raw: unknown): ReactivationConfig {
  const r = obj(raw)
  const d = DEFAULT_REACTIVATION_CONFIG
  const s = obj(r.segments)
  const dd = obj(r.days)
  const day = (k: keyof StepDays) => int(dd[k], d.days[k], 0, 60)
  const startHour = int(r.startHour, d.startHour, 6, 20)
  const endHour = int(r.endHour, d.endHour, startHour + 1, 21)
  return {
    enabled: bool(r.enabled, d.enabled),
    paused: bool(r.paused, d.paused),
    segments: { A: bool(s.A, d.segments.A), B: bool(s.B, d.segments.B), F: bool(s.F, d.segments.F), H: bool(s.H, d.segments.H) },
    days: {
      docsWa: day('docsWa'), docsEmail: day('docsEmail'), guideWa: day('guideWa'), sms: day('sms'), lastWa: day('lastWa'),
      activateWa: day('activateWa'), demandWa: day('demandWa'), tipsEmail: day('tipsEmail'),
    },
    controlPct: int(r.controlPct, d.controlPct, 0, 50),
    dailyLimit: int(r.dailyLimit, d.dailyLimit, 1, 300),
    perRunLimit: int(r.perRunLimit, d.perRunLimit, 1, 60),
    waitForApprovalDays: int(r.waitForApprovalDays, d.waitForApprovalDays, 0, 30),
    startHour,
    endHour,
    smsEnabled: bool(r.smsEnabled, d.smsEnabled),
    emailEnabled: bool(r.emailEnabled, d.emailEnabled),
    reviewSlaHours: int(r.reviewSlaHours, d.reviewSlaHours, 1, 168),
    maxMarketingWaPer14Days: int(r.maxMarketingWaPer14Days, d.maxMarketingWaPer14Days, 1, 10),
    resumeAfterSilentDays: int(r.resumeAfterSilentDays, d.resumeAfterSilentDays, 1, 30),
    demandLookbackDays: int(r.demandLookbackDays, d.demandLookbackDays, 1, 60),
    conversionWindowDays: int(r.conversionWindowDays, d.conversionWindowDays, 1, 60),
  }
}

// ─── Partner snapshot and segment ───────────────────────────────────────────

export type SnapshotDoc = { type: string; status: string; createdAt: Date }
export type SnapshotService = { serviceId: string; name: string; active: boolean; city: string; createdAt: Date }

export type PartnerSnapshot = {
  userId: string
  partnerId: string
  name: string
  email: string | null
  phone: string | null
  city: string
  slug: string | null
  verified: boolean
  /** User and partner profile both active */
  active: boolean
  excludedFromMarketing: boolean
  createdAt: Date
  docs: SnapshotDoc[]
  services: SnapshotService[]
  proposals: number
  lastProposalAt: Date | null
  lastBookingAt: Date | null
}

export function segmentOf(p: Pick<PartnerSnapshot, 'active' | 'verified' | 'docs' | 'services' | 'proposals' | 'lastProposalAt' | 'lastBookingAt'>, now: Date): Segment | null {
  if (!p.active) return null
  if (!p.verified) {
    if (!p.docs.length) return p.services.some((s) => s.active) ? 'B' : 'A'
    if (p.docs.some((d) => d.status === 'PENDING')) return 'D'
    const kinds = (types: string[]) => p.docs.filter((d) => types.includes(d.type))
    const rejectedOnly = [IDENTITY_TYPES, ['ANTECEDENTES']].some((types) => {
      const list = kinds(types)
      return list.length > 0 && list.every((d) => d.status === 'REJECTED')
    })
    return rejectedOnly ? 'E' : 'C'
  }
  const recent = now.getTime() - 30 * DAY
  if ((p.lastProposalAt && p.lastProposalAt.getTime() >= recent) || (p.lastBookingAt && p.lastBookingAt.getTime() >= recent)) return 'G'
  return p.proposals > 0 ? 'H' : 'F'
}

// ─── Control group ──────────────────────────────────────────────────────────

/** FNV-1a of the user id: the same partner always lands in the same group. */
export function controlBucket(userId: string): number {
  let h = 0x811c9dc5
  const s = `rx:${userId}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 100
}
export const isControl = (userId: string, pct: number) => controlBucket(userId) < pct

// ─── Sequences ──────────────────────────────────────────────────────────────

export type StepKey = 'docs_wa' | 'docs_email' | 'guide_wa' | 'sms' | 'last_wa' | 'activate_wa' | 'demand_wa' | 'tips_email'
export type StepChannel = 'whatsapp' | 'email' | 'sms'
/** Catalog codes used by the campaign */
export type WaCode = 'C46' | 'C47' | 'C48' | 'C49' | 'C3' | 'C33' | 'C29'
export type StepDef = { key: StepKey; day: number; channel: StepChannel; template?: WaCode; fallback?: WaCode | null }
export const TEMPLATE_NAME: Record<WaCode, string> = {
  C46: 'lh_socio_reactivar_documentos',
  C47: 'lh_socio_antecedentes_guia',
  C48: 'lh_socio_ultimo_aviso_v2',
  C49: 'lh_socio_verificado_activar',
  C3: 'lh_socio_falta_documento',
  C33: 'lh_socio_compartir_perfil',
  C29: 'lh_socio_hay_demanda',
}

export const STEP_LABEL: Record<StepKey, string> = {
  docs_wa: 'WhatsApp «te falta un paso»',
  docs_email: 'Correo «tu perfil está a un paso»',
  guide_wa: 'WhatsApp guía de antecedentes',
  sms: 'SMS recordatorio',
  last_wa: 'WhatsApp último aviso',
  activate_wa: 'WhatsApp «ya estás verificado»',
  demand_wa: 'WhatsApp «hay demanda»',
  tips_email: 'Correo «tu primera reserva»',
}

/** Steps of a segment's sequence in day order (same day: the listed order). */
export function sequenceFor(segment: CampaignSegment, cfg: ReactivationConfig): StepDef[] {
  const d = cfg.days
  const steps: StepDef[] = segment === 'A' || segment === 'B'
    ? [
      { key: 'docs_wa', day: d.docsWa, channel: 'whatsapp', template: 'C46', fallback: 'C3' },
      { key: 'docs_email', day: d.docsEmail, channel: 'email' },
      { key: 'guide_wa', day: d.guideWa, channel: 'whatsapp', template: 'C47', fallback: null },
      { key: 'sms', day: d.sms, channel: 'sms' },
      { key: 'last_wa', day: d.lastWa, channel: 'whatsapp', template: 'C48', fallback: 'C3' },
    ]
    : [
      { key: 'activate_wa', day: d.activateWa, channel: 'whatsapp', template: 'C49', fallback: 'C33' },
      { key: 'demand_wa', day: d.demandWa, channel: 'whatsapp', template: 'C29', fallback: null },
      ...(segment === 'F' ? [{ key: 'tips_email', day: d.tipsEmail, channel: 'email' } as StepDef] : []),
    ]
  return steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.day - b.s.day || a.i - b.i).map((x) => x.s)
}

/**
 * Template to use for a WhatsApp step: its own once Meta approved it; while not, wait up to
 * `waitDays` from when the step became due, then the fallback (if approved), else skip the step.
 */
export function resolveTemplate(step: StepDef, approved: (code: WaCode) => boolean, dueSinceMs: number, waitDays: number):
  | { kind: 'use'; template: WaCode; fallback: boolean }
  | { kind: 'wait' }
  | { kind: 'skip' } {
  if (!step.template) return { kind: 'skip' }
  if (approved(step.template)) return { kind: 'use', template: step.template, fallback: false }
  if (dueSinceMs < waitDays * DAY) return { kind: 'wait' }
  if (step.fallback && approved(step.fallback)) return { kind: 'use', template: step.fallback, fallback: true }
  return { kind: 'skip' }
}

// ─── History (AdminAuditLog PARTNER_REACTIVATION_STEP rows) ─────────────────

export const RX_ACTION = 'PARTNER_REACTIVATION_STEP'
export type RxStatus = 'enrolled' | 'sent' | 'skipped' | 'exit' | 'task'
export type RxRow = {
  step: StepKey | 'enroll' | 'exit' | 'followup'
  status: RxStatus
  at: Date
  segment: Segment
  control?: boolean
  channel?: StepChannel | null
  template?: string | null
  reason?: string | null
  /** Active services when enrolled (report: «activó servicios») */
  activeServices?: number
}

/** A stored details string → row fields, or null if it is not ours. */
export function parseRxDetails(details: string | null | undefined, at: Date): RxRow | null {
  try {
    const d = JSON.parse(details ?? '') as Partial<RxRow>
    if (!d || typeof d.step !== 'string' || typeof d.status !== 'string' || typeof d.segment !== 'string') return null
    return { ...d, at } as RxRow
  } catch {
    return null
  }
}

export type Enrollment = { at: Date; segment: CampaignSegment; control: boolean; activeServices: number }
export function enrollmentOf(rows: RxRow[]): Enrollment | null {
  const e = rows.find((r) => r.step === 'enroll')
  if (!e || !isCampaignSegment(e.segment)) return null
  return { at: e.at, segment: e.segment, control: Boolean(e.control), activeServices: e.activeServices ?? 0 }
}

// ─── Planner ────────────────────────────────────────────────────────────────

export type PlanInput = {
  snapshot: PartnerSnapshot
  segmentNow: Segment | null
  rows: RxRow[]
  cfg: ReactivationConfig
  now: Date
  /** Last message the partner wrote to us (any channel) */
  lastInboundAt: Date | null
  /** Marketing WhatsApp templates received in the last 14 days */
  marketingWa14d: number
  /** WhatsApp STOP, «no más avisos» (sin-marketing) or excludedFromMarketing */
  optedOut: boolean
  approved: (code: WaCode) => boolean
}

export type ExitReason = 'inactive' | 'opted_out' | 'verified' | 'uploaded_docs' | 'activated_service' | 'proposal' | 'segment_changed' | 'completed' | 'no_phone'
export const EXIT_LABEL: Record<ExitReason, string> = {
  inactive: 'cuenta inactiva', opted_out: 'pidió no recibir mensajes', verified: 'quedó verificado', uploaded_docs: 'subió documentos',
  activated_service: 'activó un servicio', proposal: 'envió una propuesta', segment_changed: 'cambió de segmento', completed: 'terminó la secuencia',
  no_phone: 'sin celular',
}

export type Plan =
  | { kind: 'ignore' }
  | { kind: 'followup'; segment: Segment }
  | { kind: 'enroll'; segment: CampaignSegment; control: boolean }
  | { kind: 'control' }
  | { kind: 'exited' }
  | { kind: 'exit'; reason: ExitReason }
  | { kind: 'paused'; until: Date }
  | { kind: 'wait'; reason: 'not_due' | 'approval' | 'cap'; step?: StepDef; at?: Date }
  | { kind: 'skip'; step: StepDef; reason: 'disabled' | 'not_approved' }
  | { kind: 'send'; step: StepDef; template?: WaCode; fallback: boolean; segment: CampaignSegment }

/** Why an enrolled partner leaves the sequence now (null = keep going). */
export function stopReason(e: Enrollment, p: PlanInput): ExitReason | null {
  const s = p.snapshot
  if (!s.active) return 'inactive'
  if (p.optedOut || s.excludedFromMarketing) return 'opted_out'
  if (e.segment === 'A' || e.segment === 'B') {
    if (s.verified) return 'verified'
    if (s.docs.some((d) => d.createdAt.getTime() >= e.at.getTime())) return 'uploaded_docs'
    if (e.segment === 'A' && s.services.some((x) => x.active)) return 'activated_service'
  } else if (s.lastProposalAt && s.lastProposalAt.getTime() >= e.at.getTime()) return 'proposal'
  return null
}

export function planPartner(p: PlanInput): Plan {
  const { rows, cfg, now, snapshot } = p
  const enrolled = enrollmentOf(rows)

  if (!enrolled) {
    const seg = p.segmentNow
    if (!seg) return { kind: 'ignore' }
    if (FOLLOWUP_SEGMENTS.has(seg)) return rows.some((r) => r.step === 'followup') ? { kind: 'ignore' } : { kind: 'followup', segment: seg }
    if (!isCampaignSegment(seg) || !cfg.segments[seg]) return { kind: 'ignore' }
    if (!snapshot.phone || p.optedOut || snapshot.excludedFromMarketing) return { kind: 'ignore' }
    return { kind: 'enroll', segment: seg, control: isControl(snapshot.userId, cfg.controlPct) }
  }

  if (enrolled.control) return { kind: 'control' }
  if (rows.some((r) => r.step === 'exit')) return { kind: 'exited' }

  const reason = stopReason(enrolled, p)
  if (reason) return { kind: 'exit', reason }

  // The partner wrote to us: the bot (or a person) is handling it; resume only after a silence
  if (p.lastInboundAt && p.lastInboundAt.getTime() > enrolled.at.getTime()) {
    const until = new Date(p.lastInboundAt.getTime() + cfg.resumeAfterSilentDays * DAY)
    if (now.getTime() < until.getTime()) return { kind: 'paused', until }
    if (p.segmentNow !== enrolled.segment) return { kind: 'exit', reason: 'segment_changed' }
  }

  const done = new Set(rows.filter((r) => r.status === 'sent' || r.status === 'skipped').map((r) => r.step))
  const steps = sequenceFor(enrolled.segment, cfg)
  const pending = steps.filter((s) => !done.has(s.key))
  if (!pending.length) return { kind: 'exit', reason: 'completed' }

  // A WhatsApp step held (template not approved yet, or the 14-day cap) never holds an email or SMS step,
  // but later WhatsApp steps keep their order behind it
  let held: Extract<Plan, { kind: 'wait' }> | null = null
  for (const next of pending) {
    if (held && next.channel === 'whatsapp') continue
    if ((next.channel === 'sms' && !cfg.smsEnabled) || (next.channel === 'email' && !cfg.emailEnabled)) return { kind: 'skip', step: next, reason: 'disabled' }

    const base = enrolled.at.getTime() + next.day * DAY
    let due = base
    const prev = steps.filter((s) => done.has(s.key) && s.day < next.day).map((s) => s.key as string)
    if (prev.length) {
      const lastAt = Math.max(0, ...rows.filter((r) => prev.includes(r.step) && r.status === 'sent').map((r) => r.at.getTime()))
      if (lastAt) due = Math.max(due, lastAt + MIN_STEP_GAP_MS)
    }
    if (now.getTime() < due) return held ?? { kind: 'wait', reason: 'not_due', step: next, at: new Date(due) }

    if (next.channel !== 'whatsapp') return { kind: 'send', step: next, fallback: false, segment: enrolled.segment }
    if (p.marketingWa14d >= cfg.maxMarketingWaPer14Days) { held = { kind: 'wait', reason: 'cap', step: next }; continue }
    const t = resolveTemplate(next, p.approved, now.getTime() - base, cfg.waitForApprovalDays)
    if (t.kind === 'wait') { held = { kind: 'wait', reason: 'approval', step: next }; continue }
    if (t.kind === 'skip') return { kind: 'skip', step: next, reason: 'not_approved' }
    return { kind: 'send', step: next, template: t.template, fallback: t.fallback, segment: enrolled.segment }
  }
  return held ?? { kind: 'exit', reason: 'completed' }
}

// ─── Pacing ─────────────────────────────────────────────────────────────────

const BOGOTA_OFFSET_MS = 5 * H

/** Monday to Saturday, between the configured Bogotá hours (Colombia has no daylight saving). */
export function inSendingWindow(now: Date, cfg: Pick<ReactivationConfig, 'startHour' | 'endHour'>): boolean {
  const b = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  const hour = b.getUTCHours()
  return b.getUTCDay() !== 0 && hour >= cfg.startHour && hour < cfg.endHour
}

/** Start of the current Bogotá day (daily limit). */
export function bogotaDayStart(now: Date): Date {
  const b = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) + BOGOTA_OFFSET_MS)
}

/** Fewest verified partners among the partner's active services in their city (999 = no active service). */
export function scarcityOf(services: SnapshotService[], verifiedCount: (serviceId: string, city: string) => number): number {
  const active = services.filter((s) => s.active)
  if (!active.length) return 999
  return Math.min(...active.map((s) => verifiedCount(s.serviceId, s.city)))
}

/** Enrollment queue: B partners whose services have the fewest verified partners first, then oldest first. */
export function enrollmentOrder<T extends { segment: Segment; createdAt: Date; scarcity: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ab = a.segment === 'B' ? 0 : 1
    const bb = b.segment === 'B' ? 0 : 1
    if (ab !== bb) return ab - bb
    if (ab === 0 && a.scarcity !== b.scarcity) return a.scarcity - b.scarcity
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

// ─── Copy ───────────────────────────────────────────────────────────────────

export const firstNameOf = (name: string | null | undefined, fallback = 'Hola') => (name ?? '').trim().split(/\s+/)[0] || fallback

/** Plain GSM-7 text: an accent or «ñ» turns the SMS into UCS-2 and it is billed as 2–3 messages. */
export const gsmPlain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '')

/** The SMS step: at most 160 GSM-7 characters, one billed message (the first name is cut if needed). */
export function smsText(name: string | null | undefined): string {
  const build = (n: string) => `LoHaggo: ${n}, tu perfil de socio esta casi listo. Sube tu cedula y antecedentes aqui: lohaggo.com/partner/verification Responde BAJA para no recibir mas.`
  const first = gsmPlain(firstNameOf(name, 'hola'))
  const room = 160 - build('').length
  return build(first.slice(0, Math.max(1, room)) || 'hola')
}

/** Services as the WhatsApp text: A (no active services) reads «tus servicios». */
export function serviceTextFor(segment: CampaignSegment, services: SnapshotService[]): string {
  const names = services.filter((s) => s.active).map((s) => s.name)
  if (segment === 'A' || !names.length) return 'tus servicios'
  const list = names.slice(0, 2)
  return list.length === 1 ? list[0] : `${list[0]} y ${list[1]}`
}

// ─── Demand (C29 step and the bot's suggestions) ────────────────────────────

export type DemandRow = { serviceId: string; name: string; city: string; requests: number; unmet: number; verifiedPartners: number }

/**
 * Services with real demand in a city, best first: unmet requests (no proposal), then requests, then the
 * fewest verified partners. `only` limits to some services (the partner's own, for C29).
 */
export function rankDemand(rows: DemandRow[], city: string, opts: { only?: string[]; fewPartners?: number; limit?: number } = {}): DemandRow[] {
  // `fewPartners`: only what the C29 copy can honestly say («clientes pidiendo… y pocos socios»): requests left
  // without a proposal, or few verified partners for that service in the city
  const honest = (r: DemandRow) => opts.fewPartners === undefined || r.unmet > 0 || r.verifiedPartners <= opts.fewPartners
  return rows
    .filter((r) => r.city === city && r.requests > 0 && (!opts.only || opts.only.includes(r.serviceId)) && honest(r))
    .sort((a, b) => b.unmet - a.unmet || b.requests - a.requests || a.verifiedPartners - b.verifiedPartners || a.name.localeCompare(b.name))
    .slice(0, opts.limit ?? 5)
}

// ─── Report ─────────────────────────────────────────────────────────────────

export type ConversionEvents = {
  docs: Date[]
  verified: Date[]
  services: Date[]
  firstProposalAt: Date | null
  firstBookingAt: Date | null
  inbound: Date[]
}
export const CONVERSION_KEYS = ['docs', 'verified', 'services', 'proposal', 'booking', 'replied'] as const
export type ConversionKey = (typeof CONVERSION_KEYS)[number]
export const CONVERSION_LABEL: Record<ConversionKey, string> = {
  docs: 'Subió documentos', verified: 'Quedó verificado', services: 'Activó servicios', proposal: 'Primera propuesta', booking: 'Primera reserva', replied: 'Respondió',
}
export type GroupStats = { n: number } & Record<ConversionKey, number>
export type SegmentReport = { segment: CampaignSegment; treatment: GroupStats; control: GroupStats }

const emptyStats = (): GroupStats => ({ n: 0, docs: 0, verified: 0, services: 0, proposal: 0, booking: 0, replied: 0 })

/** Conversions inside `windowDays` after enrollment, treatment vs control, per segment. */
export function conversionReport(
  enrollments: Array<{ userId: string } & Enrollment>,
  events: (userId: string) => ConversionEvents,
  windowDays: number,
): SegmentReport[] {
  const out = new Map<CampaignSegment, SegmentReport>(CAMPAIGN_SEGMENTS.map((s) => [s, { segment: s, treatment: emptyStats(), control: emptyStats() }]))
  for (const e of enrollments) {
    const r = out.get(e.segment)
    if (!r) continue
    const g = e.control ? r.control : r.treatment
    const from = e.at.getTime()
    const to = from + windowDays * DAY
    const inWin = (d: Date | null | undefined) => Boolean(d && d.getTime() >= from && d.getTime() <= to)
    const ev = events(e.userId)
    g.n++
    if (ev.docs.some(inWin)) g.docs++
    if (ev.verified.some(inWin)) g.verified++
    if (ev.services.some(inWin)) g.services++
    if (inWin(ev.firstProposalAt)) g.proposal++
    if (inWin(ev.firstBookingAt)) g.booking++
    if (ev.inbound.some(inWin)) g.replied++
  }
  return Array.from(out.values())
}

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)
