/**
 * Partner reactivation campaign: loads the partners, plans each one with lib/partners/reactivation-core.ts
 * and sends through the guarded paths (WhatsApp: lib/messaging/wa-send.ts with dedupe, opt-outs, marketing
 * exclusion and quiet hours; email: real addresses only; SMS: SMS/WhatsApp opt-outs). Every enrollment,
 * step, skip and exit is an AdminAuditLog row (PARTNER_REACTIVATION_STEP, entityType User), which is also
 * the data of the report. Runs from the hourly automations cron, Monday to Saturday in the configured hours.
 */
import type { City } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { toE164 } from '@/lib/inbox/contacts'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'
import { WA } from '@/lib/messaging/wa-specs'
import { NO_MARKETING_TAG, WA_SENT_ACTION, sendWaToUser, type WaOutcome, type WaSpec } from '@/lib/messaging/wa-send'
import { cityLabel, isMarketingQuietHour } from '@/lib/messaging/wa-format'
import { isApproved } from '@/lib/messaging/wa-core'
import { getReactivationSettings, isReactivationStopped } from '@/lib/partners/reactivation-settings'
import { docsEmail, tipsEmail } from '@/lib/partners/reactivation-emails'
import {
  CAMPAIGN_SEGMENTS, EXIT_LABEL, RX_ACTION, SEGMENT_LABEL, STEP_LABEL, TEMPLATE_NAME,
  bogotaDayStart, conversionReport, enrollmentOf, enrollmentOrder, firstNameOf, inSendingWindow, isCampaignSegment,
  parseRxDetails, planPartner, rankDemand, scarcityOf, segmentOf, serviceTextFor, smsText,
  type CampaignSegment, type ConversionEvents, type DemandRow, type PartnerSnapshot, type Plan, type ReactivationConfig,
  type RxRow, type Segment, type StepDef, type WaCode,
} from '@/lib/partners/reactivation-core'

const logger = createLogger('partner-reactivation')
const DAY = 24 * 3600_000
const RUN_BUDGET_MS = 40_000
export const REVIEW_SLA_INCIDENT = 'partners:docs-review-sla'

// ─── Loading ────────────────────────────────────────────────────────────────

export async function loadSnapshots(): Promise<PartnerSnapshot[]> {
  const [rows, lastProposal, lastBooking] = await Promise.all([
    prisma.partnerProfile.findMany({
      where: { user: { role: 'PARTNER' } },
      select: {
        id: true, userId: true, city: true, slug: true, verified: true, isActive: true, createdAt: true,
        user: { select: { name: true, email: true, phone: true, isActive: true, excludedFromMarketing: true } },
        documents: { select: { type: true, status: true, createdAt: true } },
        services: { select: { serviceId: true, active: true, city: true, createdAt: true, service: { select: { name: true } } } },
        _count: { select: { proposals: true } },
      },
    }),
    prisma.proposal.groupBy({ by: ['partnerId'], _max: { createdAt: true } }),
    prisma.booking.groupBy({ by: ['partnerId'], where: { partnerId: { not: null } }, _max: { createdAt: true } }),
  ])
  const propAt = new Map(lastProposal.map((r) => [r.partnerId, r._max.createdAt ?? null]))
  const bookAt = new Map(lastBooking.map((r) => [r.partnerId ?? '', r._max.createdAt ?? null]))
  return rows.map((p) => ({
    userId: p.userId,
    partnerId: p.id,
    name: p.user.name,
    email: p.user.email,
    phone: p.user.phone,
    city: p.city,
    slug: p.slug,
    verified: p.verified,
    active: p.isActive && p.user.isActive,
    excludedFromMarketing: p.user.excludedFromMarketing,
    createdAt: p.createdAt,
    docs: p.documents.map((d) => ({ type: d.type, status: d.status, createdAt: d.createdAt })),
    services: p.services.map((s) => ({ serviceId: s.serviceId, name: s.service.name, active: s.active, city: s.city, createdAt: s.createdAt })),
    proposals: p._count.proposals,
    lastProposalAt: propAt.get(p.id) ?? null,
    lastBookingAt: bookAt.get(p.id) ?? null,
  }))
}

export async function loadHistory(): Promise<Map<string, RxRow[]>> {
  const rows = await prisma.adminAuditLog.findMany({
    where: { action: RX_ACTION, entityType: 'User' },
    select: { entityId: true, details: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const out = new Map<string, RxRow[]>()
  for (const r of rows) {
    if (!r.entityId) continue
    const row = parseRxDetails(r.details, r.createdAt)
    if (row) out.set(r.entityId, [...(out.get(r.entityId) ?? []), row])
  }
  return out
}

/** Messages each partner wrote to us since `since` (WhatsApp or SMS, by linked user or by phone). */
async function loadInbound(snaps: PartnerSnapshot[], since: Date): Promise<Map<string, Date[]>> {
  const out = new Map<string, Date[]>()
  if (!snaps.length) return out
  const byPhone = new Map<string, string>()
  for (const s of snaps) {
    const phone = toE164(s.phone)
    if (phone) byPhone.set(phone, s.userId)
  }
  const userIds = new Set(snaps.map((s) => s.userId))
  const convs = await prisma.conversation.findMany({
    where: { isTest: false, OR: [{ userId: { in: Array.from(userIds) } }, { contactPhone: { in: Array.from(byPhone.keys()) } }] },
    select: { id: true, userId: true, contactPhone: true },
  })
  const owner = new Map<string, string>()
  for (const c of convs) {
    const u = c.userId && userIds.has(c.userId) ? c.userId : byPhone.get(c.contactPhone)
    if (u) owner.set(c.id, u)
  }
  if (!owner.size) return out
  const msgs = await prisma.conversationMessage.findMany({
    where: { conversationId: { in: Array.from(owner.keys()) }, direction: 'INBOUND', sentAt: { gte: since } },
    select: { conversationId: true, sentAt: true },
    take: 20_000,
  })
  for (const m of msgs) {
    const u = owner.get(m.conversationId)
    if (u) out.set(u, [...(out.get(u) ?? []), m.sentAt])
  }
  return out
}

/** Marketing WhatsApp received in the last 14 days per user (plus this campaign's C3, which Meta files as utility). */
async function loadMarketingCounts(history: Map<string, RxRow[]>, now: Date): Promise<Map<string, number>> {
  const since = new Date(now.getTime() - 14 * DAY)
  const rows = await prisma.adminAuditLog.findMany({
    where: { action: WA_SENT_ACTION, createdAt: { gte: since }, details: { contains: '"category":"MARKETING"' } },
    select: { details: true },
  })
  const out = new Map<string, number>()
  for (const r of rows) {
    const m = r.details?.match(/"userId":"([^"]+)"/)
    if (m) out.set(m[1], (out.get(m[1]) ?? 0) + 1)
  }
  for (const [userId, list] of Array.from(history.entries())) {
    const c3 = list.filter((x) => x.status === 'sent' && x.template === 'C3' && x.at.getTime() >= since.getTime()).length
    if (c3) out.set(userId, (out.get(userId) ?? 0) + c3)
  }
  return out
}

/** WhatsApp or SMS STOP, or «no más avisos» on a marketing template. */
async function loadOptedOut(snaps: PartnerSnapshot[]): Promise<Set<string>> {
  const [optOuts, tagged] = await Promise.all([
    prisma.messagingOptOut.findMany({ where: { channel: { in: ['WHATSAPP', 'SMS'] }, isActive: true }, select: { userId: true, destination: true } }),
    prisma.conversation.findMany({ where: { tags: { has: NO_MARKETING_TAG } }, select: { userId: true, contactPhone: true } }),
  ])
  const users = new Set<string>()
  const phones = new Set<string>()
  for (const o of optOuts) { if (o.userId) users.add(o.userId); phones.add(o.destination) }
  for (const t of tagged) { if (t.userId) users.add(t.userId); phones.add(t.contactPhone) }
  const out = new Set<string>()
  for (const s of snaps) {
    const phone = toE164(s.phone)
    if (users.has(s.userId) || (phone && phones.has(phone))) out.add(s.userId)
  }
  return out
}

/** Verified, active partners per service and city (their active services). */
function verifiedCounter(snaps: PartnerSnapshot[]) {
  const counts = new Map<string, number>()
  for (const s of snaps) {
    if (!s.verified || !s.active) continue
    for (const x of s.services) if (x.active) counts.set(`${x.serviceId}|${x.city}`, (counts.get(`${x.serviceId}|${x.city}`) ?? 0) + 1)
  }
  return (serviceId: string, city: string) => counts.get(`${serviceId}|${city}`) ?? 0
}

/** Requests per service and city in the last `days` (unmet = no proposal), with the verified partners for each. */
export async function loadDemand(snaps: PartnerSnapshot[], days: number, now = new Date()): Promise<DemandRow[]> {
  const reqs = await prisma.serviceRequest.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - days * DAY) } },
    select: { serviceId: true, city: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
    take: 5000,
  })
  const verified = verifiedCounter(snaps)
  const map = new Map<string, DemandRow>()
  for (const r of reqs) {
    const key = `${r.serviceId}|${r.city}`
    const row = map.get(key) ?? { serviceId: r.serviceId, name: r.service.name, city: r.city, requests: 0, unmet: 0, verifiedPartners: verified(r.serviceId, r.city) }
    row.requests++
    if (!r._count.proposals) row.unmet++
    map.set(key, row)
  }
  return Array.from(map.values())
}

async function approvalLookup() {
  const { getWaRegistry } = await import('@/lib/messaging/wa-registry')
  const registry = await getWaRegistry()
  return { available: registry.size > 0, approved: (code: WaCode) => isApproved(registry.get(TEMPLATE_NAME[code])) }
}

type World = {
  cfg: ReactivationConfig
  snaps: PartnerSnapshot[]
  history: Map<string, RxRow[]>
  inbound: Map<string, Date[]>
  marketing: Map<string, number>
  optedOut: Set<string>
  approved: (code: WaCode) => boolean
  registryAvailable: boolean
  verified: (serviceId: string, city: string) => number
}

async function loadWorld(now: Date, cfg?: ReactivationConfig): Promise<World> {
  const config = cfg ?? (await getReactivationSettings())
  const [snaps, history, approval] = await Promise.all([loadSnapshots(), loadHistory(), approvalLookup()])
  const enrolledSince = Math.min(...Array.from(history.values()).map((rows) => enrollmentOf(rows)?.at.getTime() ?? Infinity), now.getTime())
  const [inbound, marketing, optedOut] = await Promise.all([
    loadInbound(snaps, new Date(enrolledSince)),
    loadMarketingCounts(history, now),
    loadOptedOut(snaps),
  ])
  return { cfg: config, snaps, history, inbound, marketing, optedOut, approved: approval.approved, registryAvailable: approval.available, verified: verifiedCounter(snaps) }
}

function planFor(w: World, s: PartnerSnapshot, now: Date): Plan {
  const list = w.inbound.get(s.userId) ?? []
  const lastInboundAt = list.length ? new Date(Math.max(...list.map((d) => d.getTime()))) : null
  return planPartner({
    snapshot: s,
    segmentNow: segmentOf(s, now),
    rows: w.history.get(s.userId) ?? [],
    cfg: w.cfg,
    now,
    lastInboundAt,
    marketingWa14d: w.marketing.get(s.userId) ?? 0,
    optedOut: w.optedOut.has(s.userId),
    approved: w.approved,
  })
}

// ─── Recording ──────────────────────────────────────────────────────────────

async function record(w: World, userId: string, row: Omit<RxRow, 'at'>, now: Date) {
  await prisma.adminAuditLog.create({
    data: {
      action: RX_ACTION, entityType: 'User', entityId: userId, actorEmail: 'sistema',
      route: row.template ?? row.channel ?? row.step,
      details: JSON.stringify(row).slice(0, 1000),
    },
  })
  w.history.set(userId, [...(w.history.get(userId) ?? []), { ...row, at: now }])
}

// ─── Steps ──────────────────────────────────────────────────────────────────

type StepResult = { status: 'sent' | 'skipped'; reason?: string; template?: string | null; counts: boolean } | { status: 'retry'; reason: string; counts: boolean } | { status: 'exit'; reason: 'opted_out' | 'inactive' | 'no_phone'; counts?: undefined }

async function waSpecFor(w: World, s: PartnerSnapshot, segment: CampaignSegment, step: StepDef, code: WaCode, now: Date): Promise<WaSpec | null | 'no_demand'> {
  const tag = `rx_${step.key}`
  const service = serviceTextFor(segment, s.services)
  switch (code) {
    case 'C46': return WA.C46({ userId: s.userId, name: s.name, service, city: cityLabel(s.city), step: tag })
    case 'C47': return WA.C47({ userId: s.userId, name: s.name, step: tag })
    case 'C48': return WA.C48({ userId: s.userId, name: s.name, service, step: tag })
    case 'C3': return { ...WA.C3({ userId: s.userId, name: s.name, day: tag }), marketing: true }
    case 'C49':
    case 'C33': {
      const { ensurePartnerSlug } = await import('@/lib/partners/share')
      const slug = await ensurePartnerSlug({ id: s.partnerId, slug: s.slug, city: s.city, userName: s.name })
      return code === 'C49'
        ? WA.C49({ userId: s.userId, partnerId: s.partnerId, name: s.name, service, slug, step: tag })
        : WA.C33({ partnerId: s.partnerId, name: s.name, slug })
    }
    case 'C29': {
      const demand = await demandFor(w, now)
      const pick = rankDemand(demand, s.city, { only: s.services.map((x) => x.serviceId), fewPartners: 3, limit: 1 })[0]
      if (!pick) return 'no_demand'
      return { ...WA.C29({ partnerId: s.partnerId, partnerName: s.name, service: pick.name, city: cityLabel(s.city), now }), dedupeKey: `RX:C29:${s.userId}:${tag}` }
    }
  }
}

let demandCache: { at: number; rows: DemandRow[] } | null = null
async function demandFor(w: World, now: Date) {
  if (demandCache && now.getTime() - demandCache.at < 10 * 60_000) return demandCache.rows
  const rows = await loadDemand(w.snaps, w.cfg.demandLookbackDays, now)
  demandCache = { at: now.getTime(), rows }
  return rows
}

async function runWaStep(w: World, s: PartnerSnapshot, segment: CampaignSegment, step: StepDef, code: WaCode, now: Date): Promise<StepResult> {
  const spec = await waSpecFor(w, s, segment, step, code, now)
  if (spec === 'no_demand') return { status: 'skipped', reason: 'no_demand', template: code, counts: false }
  if (!spec) return { status: 'skipped', reason: 'no_template', template: code, counts: false }
  const r: WaOutcome | null = await sendWaToUser(s.userId, spec, now)
  if (!r) return { status: 'retry', reason: 'no_spec', counts: false }
  if (r.ok) return { status: 'sent', template: code, counts: true }
  if ('skipped' in r && r.skipped) {
    if (r.skipped === 'opted_out') return { status: 'exit', reason: 'opted_out' }
    if (r.skipped === 'inactive') return { status: 'exit', reason: 'inactive' }
    if (r.skipped === 'no_phone') return { status: 'exit', reason: 'no_phone' }
    if (r.skipped === 'duplicate' || r.skipped === 'user_disabled') return { status: 'skipped', reason: r.skipped, template: code, counts: false }
    // marketing_blocked, not_approved, missing_vars: nothing sent, try again in a later run
    return { status: 'retry', reason: r.skipped, counts: false }
  }
  return { status: 'retry', reason: 'error', counts: true }
}

async function emailAllowed(userId: string, email: string | null) {
  if (!email || isPlaceholderEmail(email)) return 'no_email'
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsEmailEnabled: true } })
  if (u?.notificationsEmailEnabled === false) return 'email_disabled'
  const optOut = await prisma.messagingOptOut.findFirst({ where: { channel: 'EMAIL', isActive: true, OR: [{ userId }, { destination: email }] }, select: { id: true } })
  return optOut ? 'email_opted_out' : null
}

async function runEmailStep(s: PartnerSnapshot, step: StepDef): Promise<StepResult> {
  const blocked = await emailAllowed(s.userId, s.email)
  if (blocked) return { status: 'skipped', reason: blocked, counts: false }
  const { getMessagingProviderRuntimeConfig } = await import('@/lib/messaging/provider-config')
  const { sendMessageViaProvider } = await import('@/lib/messaging/providers')
  const runtime = await getMessagingProviderRuntimeConfig()
  if (!runtime.sendgrid?.active) return { status: 'skipped', reason: 'email_not_configured', counts: false }
  const first = firstNameOf(s.name)
  const mail = step.key === 'docs_email' ? docsEmail(first) : tipsEmail(first, s.slug)
  const res = await sendMessageViaProvider({ channel: 'EMAIL', to: s.email!, userId: s.userId, subject: mail.subject, body: mail.html }, runtime)
  return res.ok ? { status: 'sent', template: step.key, counts: false } : { status: 'skipped', reason: `email_error:${res.errorCode ?? 'x'}`, counts: false }
}

async function runSmsStep(s: PartnerSnapshot): Promise<StepResult> {
  const phone = toE164(s.phone)
  if (!phone) return { status: 'skipped', reason: 'no_phone', counts: false }
  const optOut = await prisma.messagingOptOut.findFirst({ where: { channel: 'SMS', isActive: true, OR: [{ userId: s.userId }, { destination: phone }] }, select: { id: true } })
  if (optOut) return { status: 'skipped', reason: 'sms_opted_out', counts: false }
  const { getMessagingProviderRuntimeConfig } = await import('@/lib/messaging/provider-config')
  const { sendMessageViaProvider } = await import('@/lib/messaging/providers')
  const runtime = await getMessagingProviderRuntimeConfig()
  const body = smsText(s.name)
  const res = await sendMessageViaProvider({ channel: 'SMS', to: phone, userId: s.userId, body }, runtime)
  if (!res.ok) return { status: 'skipped', reason: `sms_error:${res.errorCode ?? 'x'}`, counts: true }
  const { recordAutomatedOutbound } = await import('@/lib/inbox/automated')
  await recordAutomatedOutbound({ channel: 'SMS', contactPhone: phone, userId: s.userId, contactName: s.name, body, providerMessageId: res.providerMessageId ?? null, emit: false }).catch(() => null)
  return { status: 'sent', template: 'sms', counts: true }
}

// ─── Follow-up for a person (segments C and E) ──────────────────────────────

async function createFollowup(w: World, s: PartnerSnapshot, segment: Segment, now: Date) {
  const phone = toE164(s.phone)
  const conv = await prisma.conversation.findFirst({
    where: { channel: 'WHATSAPP', OR: [{ userId: s.userId }, ...(phone ? [{ contactPhone: phone }] : [])] },
    select: { id: true, workspaceId: true },
    orderBy: { lastMessageAt: 'desc' },
  })
  const what = segment === 'E' ? 'tiene un documento rechazado sin reemplazar' : 'tiene los documentos incompletos'
  if (conv) {
    await prisma.conversationTask.create({
      data: {
        conversationId: conv.id, workspaceId: conv.workspaceId, source: 'automation', agentName: 'Reactivación de socios',
        title: `Socio ${firstNameOf(s.name, 'sin nombre')} ${what}: escríbele y ayúdale a terminar la verificación`.slice(0, 200),
        dueAt: new Date(now.getTime() + DAY),
      },
    })
  }
  await record(w, s.userId, { step: 'followup', status: conv ? 'task' : 'skipped', segment, reason: conv ? null : 'no_conversation' }, now)
}

// ─── The hourly run ─────────────────────────────────────────────────────────

export type RunTally = Record<string, number | string>

const bump = (t: RunTally, k: string, n = 1) => { t[k] = Number(t[k] ?? 0) + n }

/** Sent WhatsApp + SMS and treatment enrollments since the start of the Bogotá day. */
function todayCounts(history: Map<string, RxRow[]>, now: Date) {
  const start = bogotaDayStart(now).getTime()
  let sends = 0
  let enrolls = 0
  for (const rows of Array.from(history.values())) {
    for (const r of rows) {
      if (r.at.getTime() < start) continue
      if (r.status === 'sent' && (r.channel === 'whatsapp' || r.channel === 'sms')) sends++
      if (r.step === 'enroll' && !r.control) enrolls++
    }
  }
  return { sends, enrolls }
}

export async function runPartnerReactivation(now = new Date()): Promise<RunTally> {
  const t: RunTally = {}
  const cfg = await getReactivationSettings()
  if (!cfg.enabled) return { skipped: 'disabled' }
  if (cfg.paused) return { skipped: 'paused' }
  if (!inSendingWindow(now, cfg) || isMarketingQuietHour(now)) return { skipped: 'outside_window' }
  // A retried or overlapping cron call never runs the campaign twice in the same half hour (emails and SMS have no dedupe)
  const { hit } = await import('@/lib/rate-limit-store')
  if ((await hit('partner-reactivation:run', 30 * 60_000, now.getTime())).count > 1) return { skipped: 'already_running' }

  const started = Date.now()
  const w = await loadWorld(now, cfg)
  if (!w.registryAvailable) return { skipped: 'templates_unavailable' }
  const today = todayCounts(w.history, now)
  let sendBudget = Math.min(cfg.perRunLimit, Math.max(0, cfg.dailyLimit - today.sends))
  let enrollBudget = Math.min(cfg.perRunLimit, Math.max(0, cfg.dailyLimit - today.enrolls))
  let stopped = false
  const outOfTime = () => stopped || Date.now() - started > RUN_BUDGET_MS

  const act = async (s: PartnerSnapshot): Promise<void> => {
    for (let i = 0; i < 6; i++) {
      if (outOfTime()) return
      const plan = planFor(w, s, now)
      if (plan.kind === 'exit') {
        await record(w, s.userId, { step: 'exit', status: 'exit', segment: enrollmentOf(w.history.get(s.userId) ?? [])?.segment ?? 'A', reason: plan.reason }, now)
        bump(t, `exit_${plan.reason}`)
        return
      }
      if (plan.kind === 'skip') {
        await record(w, s.userId, { step: plan.step.key, status: 'skipped', segment: enrollmentOf(w.history.get(s.userId) ?? [])!.segment, channel: plan.step.channel, reason: plan.reason }, now)
        bump(t, `skip_${plan.step.key}`)
        continue
      }
      if (plan.kind !== 'send') return
      const counts = plan.step.channel !== 'email'
      if (counts && sendBudget <= 0) return
      if (await isReactivationStopped()) { stopped = true; return }
      // Email and SMS have no provider dedupe: the step is marked as sent before it goes out, so an overlapping
      // or retried run never sends it twice (a failed send is then recorded as skipped, never retried)
      if (plan.step.channel !== 'whatsapp') {
        await record(w, s.userId, { step: plan.step.key, status: 'sent', segment: plan.segment, channel: plan.step.channel, template: plan.step.key, reason: 'intent' }, now)
      }
      const res = plan.step.channel === 'whatsapp'
        ? await runWaStep(w, s, plan.segment, plan.step, plan.template!, now)
        : plan.step.channel === 'sms' ? await runSmsStep(s) : await runEmailStep(s, plan.step)
      if (res.counts) sendBudget--
      // An error from the provider may still have delivered it: never retried, recorded as skipped
      if (res.status === 'retry' && res.counts) {
        await record(w, s.userId, { step: plan.step.key, status: 'skipped', segment: plan.segment, channel: plan.step.channel, template: plan.template ?? null, reason: `error:${res.reason}` }, now)
        bump(t, `failed_${plan.step.key}`)
        return
      }
      if (res.status === 'retry') { bump(t, `retry_${res.reason}`); return }
      if (plan.step.channel !== 'whatsapp') {
        if (res.status !== 'sent') await record(w, s.userId, { step: plan.step.key, status: 'skipped', segment: plan.segment, channel: plan.step.channel, reason: res.status === 'skipped' ? res.reason ?? null : 'exit' }, now)
        if (res.status === 'exit') { await record(w, s.userId, { step: 'exit', status: 'exit', segment: plan.segment, reason: res.reason }, now); bump(t, `exit_${res.reason}`); return }
        bump(t, `${res.status}_${plan.step.key}`)
        continue
      }
      if (res.status === 'exit') {
        await record(w, s.userId, { step: 'exit', status: 'exit', segment: plan.segment, reason: res.reason }, now)
        bump(t, `exit_${res.reason}`)
        return
      }
      await record(w, s.userId, {
        step: plan.step.key, status: res.status, segment: plan.segment, channel: plan.step.channel,
        template: res.template ?? plan.template ?? null, reason: res.status === 'skipped' ? res.reason ?? null : plan.fallback ? 'fallback' : null,
      }, now)
      bump(t, `${res.status}_${plan.step.key}${plan.template ? `_${res.template ?? plan.template}` : ''}`)
    }
  }

  // 1) Partners already in a sequence, oldest enrollment first
  const enrolled = w.snaps
    .map((s) => ({ s, e: enrollmentOf(w.history.get(s.userId) ?? []) }))
    .filter((x) => x.e && !x.e.control)
    .sort((a, b) => a.e!.at.getTime() - b.e!.at.getTime())
  for (const { s } of enrolled) {
    if (outOfTime()) { t.timeout = 1; break }
    try { await act(s) } catch (err) { bump(t, 'error'); logger.warn('Reactivation step failed', { userId: s.userId, err: err instanceof Error ? err.message : err }) }
  }

  // 2) New enrollments: B partners with the scarcest services first, then the oldest
  const queue = enrollmentOrder(
    w.snaps
      .map((s) => ({ s, plan: planFor(w, s, now), segment: segmentOf(s, now) ?? 'G', createdAt: s.createdAt, scarcity: scarcityOf(s.services, w.verified) }))
      .filter((x) => x.plan.kind === 'enroll'),
  )
  for (const x of queue) {
    if (outOfTime()) { t.timeout = 1; break }
    if (enrollBudget <= 0 || sendBudget <= 0) break
    const plan = x.plan as Extract<Plan, { kind: 'enroll' }>
    const activeServices = x.s.services.filter((s) => s.active).length
    await record(w, x.s.userId, { step: 'enroll', status: 'enrolled', segment: plan.segment, control: plan.control, activeServices }, now)
    bump(t, plan.control ? `control_${plan.segment}` : `enroll_${plan.segment}`)
    if (plan.control) continue
    enrollBudget--
    try { await act(x.s) } catch (err) { bump(t, 'error'); logger.warn('Reactivation day-0 failed', { userId: x.s.userId, err: err instanceof Error ? err.message : err }) }
  }

  // 3) Documents incomplete or rejected: a task for a person, once
  let tasks = 0
  for (const s of w.snaps) {
    if (tasks >= 20 || outOfTime()) break
    const plan = planFor(w, s, now)
    if (plan.kind !== 'followup') continue
    await createFollowup(w, s, plan.segment, now).catch((err) => logger.warn('Reactivation follow-up failed', { userId: s.userId, err: err instanceof Error ? err.message : err }))
    tasks++
  }
  if (tasks) t.followups = tasks

  if (Object.keys(t).length) logger.info('Partner reactivation run', t)
  return t
}

// ─── Preview (dry run) ──────────────────────────────────────────────────────

export type PreviewItem = { userId: string; name: string; segment: string; action: string; detail: string }

function describePlan(p: Plan): { key: string; label: string; actionable: boolean } {
  switch (p.kind) {
    case 'enroll': return { key: `enroll_${p.control ? 'control' : 'treatment'}`, label: p.control ? 'Entra al grupo de control (no recibe nada)' : 'Entra a la campaña', actionable: true }
    case 'send': return { key: `send_${p.step.key}`, label: `Enviar: ${STEP_LABEL[p.step.key]}${p.template ? ` (${p.template}${p.fallback ? ', plantilla de respaldo' : ''})` : ''}`, actionable: true }
    case 'skip': return { key: `skip_${p.step.key}`, label: `Saltar: ${STEP_LABEL[p.step.key]} (${p.reason === 'disabled' ? 'canal apagado' : 'plantilla no aprobada'})`, actionable: true }
    case 'exit': return { key: `exit_${p.reason}`, label: `Sale de la campaña: ${EXIT_LABEL[p.reason]}`, actionable: true }
    case 'wait': return {
      key: `wait_${p.reason}`,
      label: p.reason === 'approval' ? `Espera aprobación de Meta: ${p.step ? STEP_LABEL[p.step.key] : ''}` : p.reason === 'cap' ? 'Espera: ya recibió 3 mensajes de marketing en 14 días' : `Próximo paso: ${p.step ? STEP_LABEL[p.step.key] : ''}`,
      actionable: false,
    }
    case 'paused': return { key: 'paused', label: 'En pausa: nos escribió (lo atiende el bot o una persona)', actionable: false }
    case 'followup': return { key: 'followup', label: 'Tarea para una persona (documentos incompletos o rechazados)', actionable: true }
    case 'control': return { key: 'control', label: 'Grupo de control', actionable: false }
    case 'exited': return { key: 'exited', label: 'Ya salió de la campaña', actionable: false }
    default: return { key: 'ignore', label: 'Fuera de la campaña', actionable: false }
  }
}

export async function previewPartnerReactivation(now = new Date()) {
  const w = await loadWorld(now)
  const today = todayCounts(w.history, now)
  const segments: Record<string, { label: string; partners: number; enrolled: number; control: number }> = {}
  for (const seg of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as Segment[]) segments[seg] = { label: SEGMENT_LABEL[seg], partners: 0, enrolled: 0, control: 0 }
  const actions = new Map<string, { label: string; count: number }>()
  const upcoming: PreviewItem[] = []
  const followups: PreviewItem[] = []
  const waits: Array<{ at: Date; item: PreviewItem }> = []

  for (const s of w.snaps) {
    const seg = segmentOf(s, now)
    if (seg) segments[seg].partners++
    const e = enrollmentOf(w.history.get(s.userId) ?? [])
    if (e) segments[e.segment][e.control ? 'control' : 'enrolled']++
    const plan = planFor(w, s, now)
    const d = describePlan(plan)
    if (d.key === 'ignore') continue
    const a = actions.get(d.key) ?? { label: d.label, count: 0 }
    a.count++
    actions.set(d.key, a)
    const item: PreviewItem = { userId: s.userId, name: s.name, segment: e?.segment ?? seg ?? '—', action: d.label, detail: '' }
    if (plan.kind === 'followup') {
      followups.push({ ...item, detail: s.phone ? 'Se crea una tarea en su chat de WhatsApp' : 'Sin celular: escríbele por otro medio' })
    } else if (plan.kind === 'wait' && plan.at) {
      waits.push({ at: plan.at, item: { ...item, detail: `desde ${plan.at.toISOString()}` } })
    } else if (d.actionable && upcoming.length < 40) {
      upcoming.push(item)
    }
  }
  // Earlier-done follow-ups still in C/E are listed so a person sees them all
  for (const s of w.snaps) {
    const seg = segmentOf(s, now)
    if (seg !== 'C' && seg !== 'E') continue
    if (followups.some((f) => f.userId === s.userId)) continue
    const task = (w.history.get(s.userId) ?? []).find((r) => r.step === 'followup')
    followups.push({ userId: s.userId, name: s.name, segment: seg, action: 'Seguimiento de una persona', detail: task?.status === 'task' ? 'Tarea creada en su chat' : 'Sin chat de WhatsApp: escríbele' })
  }
  waits.sort((a, b) => a.at.getTime() - b.at.getTime())

  const templates = (Object.keys(TEMPLATE_NAME) as WaCode[]).map((code) => ({ code, name: TEMPLATE_NAME[code], approved: w.approved(code) }))
  return {
    config: w.cfg,
    window: { open: inSendingWindow(now, w.cfg) && !isMarketingQuietHour(now), sentToday: today.sends, enrolledToday: today.enrolls, dailyLimit: w.cfg.dailyLimit, perRunLimit: w.cfg.perRunLimit },
    registryAvailable: w.registryAvailable,
    templates,
    segments,
    actions: Array.from(actions.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count),
    upcoming,
    nextScheduled: waits.slice(0, 15).map((x) => x.item),
    followups,
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

export async function partnerReactivationReport(now = new Date()) {
  const cfg = await getReactivationSettings()
  const [snaps, history] = await Promise.all([loadSnapshots(), loadHistory()])
  const byUser = new Map(snaps.map((s) => [s.userId, s]))

  const enrollments: Array<{ userId: string } & NonNullable<ReturnType<typeof enrollmentOf>>> = []
  for (const [userId, rows] of Array.from(history.entries())) {
    const e = enrollmentOf(rows)
    if (e) enrollments.push({ userId, ...e })
  }
  const since = new Date(Math.min(now.getTime(), ...enrollments.map((e) => e.at.getTime())))
  const partnerIds = enrollments.map((e) => byUser.get(e.userId)?.partnerId).filter((x): x is string => Boolean(x))

  const [docs, identityApproved, services, firstProposals, firstBookings, inbound] = await Promise.all([
    prisma.verificationDocument.findMany({ where: { partnerId: { in: partnerIds }, createdAt: { gte: since } }, select: { partnerId: true, createdAt: true } }),
    prisma.verificationDocument.findMany({ where: { partnerId: { in: partnerIds }, status: 'APPROVED', type: { in: ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'] }, reviewedAt: { gte: since } }, select: { partnerId: true, reviewedAt: true } }),
    prisma.partnerService.findMany({ where: { partnerId: { in: partnerIds }, active: true }, select: { partnerId: true, createdAt: true } }),
    prisma.proposal.groupBy({ by: ['partnerId'], where: { partnerId: { in: partnerIds } }, _min: { createdAt: true } }),
    prisma.booking.groupBy({ by: ['partnerId'], where: { partnerId: { in: partnerIds } }, _min: { createdAt: true } }),
    loadInbound(snaps.filter((s) => enrollments.some((e) => e.userId === s.userId)), since),
  ])
  const group = <T>(rows: T[], key: (r: T) => string, at: (r: T) => Date | null) => {
    const m = new Map<string, Date[]>()
    for (const r of rows) { const d = at(r); if (d) m.set(key(r), [...(m.get(key(r)) ?? []), d]) }
    return m
  }
  const docsBy = group(docs, (r) => r.partnerId, (r) => r.createdAt)
  const verifiedBy = group(identityApproved, (r) => r.partnerId, (r) => r.reviewedAt)
  const servicesBy = group(services, (r) => r.partnerId, (r) => r.createdAt)
  const propBy = new Map(firstProposals.map((r) => [r.partnerId, r._min.createdAt ?? null]))
  const bookBy = new Map(firstBookings.map((r) => [r.partnerId ?? '', r._min.createdAt ?? null]))

  const enrollmentByUser = new Map(enrollments.map((e) => [e.userId, e]))
  const events = (userId: string): ConversionEvents => {
    const s = byUser.get(userId)
    const pid = s?.partnerId ?? ''
    const e = enrollmentByUser.get(userId)
    const svc = [...(servicesBy.get(pid) ?? [])]
    // A service switched on later keeps its creation date: count it when there are more active now than at enrollment
    if (e && s && s.services.filter((x) => x.active).length > e.activeServices && !svc.some((d) => d.getTime() >= e.at.getTime())) {
      if (now.getTime() - e.at.getTime() <= cfg.conversionWindowDays * DAY) svc.push(now)
    }
    return {
      docs: docsBy.get(pid) ?? [],
      verified: verifiedBy.get(pid) ?? [],
      services: svc,
      firstProposalAt: propBy.get(pid) ?? null,
      firstBookingAt: bookBy.get(pid) ?? null,
      inbound: inbound.get(userId) ?? [],
    }
  }
  const conversions = conversionReport(enrollments, events, cfg.conversionWindowDays)

  // Sends per step / channel / template, and exits per reason
  const sends = new Map<string, { segment: string; step: string; label: string; channel: string; template: string; sent: number; skipped: number }>()
  const exits = new Map<string, number>()
  for (const rows of Array.from(history.values())) {
    for (const r of rows) {
      if (r.status === 'exit' && r.reason) exits.set(r.reason, (exits.get(r.reason) ?? 0) + 1)
      if ((r.status !== 'sent' && r.status !== 'skipped') || r.step === 'followup' || r.step === 'enroll' || r.step === 'exit') continue
      const key = `${r.segment}|${r.step}|${r.template ?? ''}`
      const row = sends.get(key) ?? { segment: r.segment, step: r.step, label: STEP_LABEL[r.step as keyof typeof STEP_LABEL] ?? r.step, channel: r.channel ?? '', template: r.template ?? '', sent: 0, skipped: 0 }
      row[r.status === 'sent' ? 'sent' : 'skipped']++
      sends.set(key, row)
    }
  }

  // Eligible now: in a campaign segment and never enrolled
  const eligible: Record<string, number> = { A: 0, B: 0, F: 0, H: 0 }
  for (const s of snaps) {
    const seg = segmentOf(s, now)
    if (isCampaignSegment(seg) && !enrollmentByUser.has(s.userId)) eligible[seg]++
  }

  return {
    windowDays: cfg.conversionWindowDays,
    segments: CAMPAIGN_SEGMENTS.map((seg) => {
      const c = conversions.find((x) => x.segment === seg)!
      return { segment: seg, label: SEGMENT_LABEL[seg], eligible: eligible[seg], enrolled: c.treatment.n, control: c.control.n, treatment: c.treatment, controlStats: c.control }
    }),
    sends: Array.from(sends.values()).sort((a, b) => a.segment.localeCompare(b.segment) || a.step.localeCompare(b.step)),
    exits: Array.from(exits.entries()).map(([reason, count]) => ({ reason, label: EXIT_LABEL[reason as keyof typeof EXIT_LABEL] ?? reason, count })).sort((a, b) => b.count - a.count),
  }
}

// ─── Document review SLA ────────────────────────────────────────────────────

/**
 * A verification document pending longer than `reviewSlaHours` opens a HIGH incident and notifies the admins
 * in the app (once per incident); it resolves itself when no document is over the SLA.
 */
export async function checkDocumentReviewSla(now = new Date()) {
  const cfg = await getReactivationSettings()
  const limit = new Date(now.getTime() - cfg.reviewSlaHours * 3600_000)
  const [late, oldest, open] = await Promise.all([
    prisma.verificationDocument.count({ where: { status: 'PENDING', createdAt: { lte: limit } } }),
    prisma.verificationDocument.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.adminIncident.findFirst({ where: { type: REVIEW_SLA_INCIDENT, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } }),
  ])
  if (!late) {
    if (open) {
      const { setIncidentStatus } = await import('@/lib/ops/platform-ops')
      await setIncidentStatus(open.id, 'RESOLVED', 'sistema').catch(() => null)
      return { late: 0, resolved: 1 }
    }
    return { late: 0 }
  }
  if (open) {
    await prisma.adminIncident.update({ where: { id: open.id }, data: { lastSeenAt: now } }).catch(() => null)
    return { late, open: 1 }
  }
  const hours = oldest ? Math.floor((now.getTime() - oldest.createdAt.getTime()) / 3600_000) : cfg.reviewSlaHours
  const { openIncident } = await import('@/lib/ops/platform-ops')
  await openIncident({
    type: REVIEW_SLA_INCIDENT, severity: 'HIGH', source: 'partner-reactivation', route: '/admin/documents',
    title: `${late} documento${late === 1 ? '' : 's'} de socios sin revisar hace más de ${cfg.reviewSlaHours} h`,
    description: `El más antiguo espera ${hours} h. Durante la campaña de reactivación los socios suben documentos: revisarlos rápido es lo que los convierte.`,
  })
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
  const { notifyAdminsInApp } = await import('@/lib/inbox/escalation')
  await notifyAdminsInApp(admins.map((a) => a.id), {
    title: 'Documentos de socios por revisar',
    message: `${late} documento${late === 1 ? '' : 's'} lleva${late === 1 ? '' : 'n'} más de ${cfg.reviewSlaHours} h sin revisar.`,
    url: '/admin/documents',
    kind: 'docs_review_sla',
  })
  return { late, opened: 1 }
}

// ─── Suggestions for the bot (partner without services) ─────────────────────

/**
 * Services with real requests in the city (last `days`), ranked by unmet demand and fewest verified partners,
 * with honest numbers for the chat. Empty when there was no demand.
 */
export async function serviceSuggestionsFor(city: string, days = 30, limit = 3, now = new Date()): Promise<DemandRow[]> {
  const since = new Date(now.getTime() - days * DAY)
  const where = { city: city as City }
  const [reqs, verified] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: { serviceId: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
      take: 2000,
    }),
    prisma.partnerService.groupBy({ by: ['serviceId'], where: { ...where, active: true, partner: { verified: true, isActive: true } }, _count: { _all: true } }),
  ])
  const partners = new Map(verified.map((v) => [v.serviceId, v._count._all]))
  const rows = new Map<string, DemandRow>()
  for (const r of reqs) {
    const row = rows.get(r.serviceId) ?? { serviceId: r.serviceId, name: r.service.name, city, requests: 0, unmet: 0, verifiedPartners: partners.get(r.serviceId) ?? 0 }
    row.requests++
    if (!r._count.proposals) row.unmet++
    rows.set(r.serviceId, row)
  }
  return rankDemand(Array.from(rows.values()), city, { limit })
}
