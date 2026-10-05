import { attributionSnapshot } from '@/lib/analytics/origins'
import { FORMAT_SCOPES, formatCapabilities } from '@/lib/marketing/format-capabilities'
import type { MetaChannel } from '@/lib/messaging/meta-graph'
import { getConversionSettings } from '@/lib/analytics/conversions'
import { scanAttention } from '@/lib/admin/request-360'
import { prisma } from '@/lib/prisma'
import { platformOverview } from '@/lib/admin/overview'
import { bogotaDayStart } from '@/lib/admin/overview-core'
import { evaluateBudget, workspaceUsage } from '@/lib/ai/limits'
import { systemAlerts, systemOverview } from '@/lib/system/health'
import { trustReport } from '@/lib/public/trust'
import type { Snapshot } from '@/lib/haggo/detect'
import { guaranteeStats } from '@/lib/guarantee/ops'
import { cityLaunchStatus } from '@/lib/cities/launch'
import { catalogStatus } from '@/lib/messaging/wa-registry'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const round = (n: number) => Math.round(n * 100) / 100
const H = 3600_000

/** Open payment incidents (the ones someone still has to look at) */
const INCIDENT_OPEN = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED'] as const
const AUTOMATION_SENT = ['SENT']

/**
 * The platform as Haggo sees it: the dashboard's numbers plus what the dashboard does not break down.
 * Every source has its own fallback: a failing query leaves zeros and its name in `unavailable`, never
 * kills the cycle.
 */
export async function takeSnapshot(now = new Date()): Promise<Snapshot> {
  const today = bogotaDayStart(now)
  const day = new Date(now.getTime() - 24 * H)
  const week = new Date(now.getTime() - 7 * 24 * H)
  const unavailable: string[] = []
  // Each source has its fallback and a time limit: one query that hangs must not hold the whole cycle
  const safe = <T,>(name: string, p: PromiseLike<T>, fallback: T, ms = 20_000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms) })
    return Promise.race([Promise.resolve(p), limit])
      .catch(() => {
        unavailable.push(name)
        return fallback
      })
      .finally(() => clearTimeout(timer))
  }

  const [
    rejected24h, pendingOld, refundsOpen, refundsFailed, low7d, total24h, zero24h, sent24h, failed24h, events24h, high24h, blockedIps, runErrors24h, pendingVerification,
    sys, o, handoffs, gaps, criticalIncidents, capped, editorial, overview,
  ] = await Promise.all([
    safe('payments.rejected24h', prisma.payment.count({ where: { status: 'REJECTED', updatedAt: { gte: day } } }), 0),
    safe('payments.pendingOld', prisma.payment.count({ where: { status: 'PENDING', createdAt: { lt: day } } }), 0),
    safe('payments.refundsOpen', prisma.refundCase.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'] } } }), 0),
    safe('payments.refundsFailed', prisma.refundCase.count({ where: { status: 'FAILED' } }), 0),
    safe('reviews.low7d', prisma.review.count({ where: { clientReviewedAt: { gte: week }, clientToPartnerRating: { lte: 2 } } }), 0),
    safe('search.total24h', prisma.searchEvent.count({ where: { createdAt: { gte: day } } }), 0),
    safe('search.zero24h', prisma.searchEvent.count({ where: { createdAt: { gte: day }, resultCount: 0 } }), 0),
    safe('messaging.sent24h', prisma.messagingDelivery.count({ where: { createdAt: { gte: day }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] } } }), 0),
    safe('messaging.failed24h', prisma.messagingDelivery.count({ where: { createdAt: { gte: day }, status: 'FAILED' } }), 0),
    safe('security.events24h', prisma.securityEvent.count({ where: { createdAt: { gte: day } } }), 0),
    safe('security.high24h', prisma.securityEvent.count({ where: { createdAt: { gte: day }, severity: { in: ['HIGH', 'CRITICAL'] } } }), 0),
    safe('security.blockedIps', prisma.blockedIp.count({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }), 0),
    safe('marketing.runErrors24h', prisma.marketingAgentRun.count({ where: { status: 'error', startedAt: { gte: day } } }), 0),
    safe('partners.pendingVerification', prisma.partnerProfile.count({ where: { verified: false, isActive: true } }), 0),
    safe('system', systemAlerts(now), { cronsFailing: 0, cronsLate: 0, errorsLastHour: 0, aiDown: [] as Array<{ name: string; reason: string }>, aiAnswering: null as string | null }),
    safe('overview', platformOverview(now), null),
    safe('aiAgents.handoffs', prisma.conversation.groupBy({ by: ['aiAgentId'], where: { aiHandoffAt: { gte: today }, isTest: false, aiAgentId: { not: null } }, _count: { _all: true } }), [] as Array<{ aiAgentId: string | null; _count: { _all: number } }>),
    safe('aiAgents.gaps', prisma.aiKnowledgeGap.groupBy({ by: ['agentId'], where: { status: 'open', agentId: { not: null } }, _count: { _all: true } }), [] as Array<{ agentId: string | null; _count: { _all: number } }>),
    safe('system.criticalIncidents', prisma.adminIncident.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL' } }), 0),
    safe('budgets', prisma.workspace.findMany({ where: { OR: [{ aiMonthlyCostCapUsd: { not: null } }, { aiMonthlyCallCap: { not: null } }] }, select: { id: true, name: true, aiMonthlyCostCapUsd: true, aiMonthlyCallCap: true } }), []),
    // Editorial review: pieces held by the editor (or whose review could not run) and the editor's week
    safe('marketing.editorial', Promise.all([
      prisma.marketingPost.count({ where: { reviewStatus: { in: ['changes', 'rejected', 'failed'] }, status: { in: ['draft', 'review', 'approved'] } } }),
      prisma.marketingReview.count({ where: { reviewer: 'editor', createdAt: { gte: week }, verdict: { not: 'error' } } }),
      prisma.marketingReview.count({ where: { reviewer: 'editor', createdAt: { gte: week }, verdict: { in: ['changes', 'rejected'] } } }),
      prisma.marketingReview.count({ where: { createdAt: { gte: week }, verdict: 'error' } }),
    ]), [0, 0, 0, 0]),
    safe('webhooks', systemOverview(now), null),
  ])
  // What the inbox agents did today on the platform, and the day's cancellations by origin
  const [actionRows, chatCancellationsToday, cancellationsToday, metaConns, preflightRows] = await Promise.all([
    safe('aiActions', prisma.aiAgentAction.groupBy({ by: ['agentId', 'status'], where: { createdAt: { gte: today } }, _count: { _all: true } }), [] as Array<{ agentId: string; status: string; _count: { _all: number } }>),
    safe('aiActions.chatCancellations', prisma.bookingEvent.count({ where: { type: 'status', toStatus: 'CANCELLED', origin: 'chat', createdAt: { gte: today } } }), 0),
    safe('aiActions.cancellations', prisma.bookingEvent.count({ where: { type: 'status', toStatus: 'CANCELLED', createdAt: { gte: today } } }), 0),
    safe('marketing.metaAccounts', prisma.channelConnection.findMany({ where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] }, enabled: true }, select: { id: true, channel: true, name: true, capabilities: true, commentSettings: true } }), []),
    // Pieces Meta refused in the preflight (reels and stories are tested before their time)
    safe('marketing.preflight', prisma.marketingPost.findMany({ where: { updatedAt: { gte: new Date(now.getTime() - 14 * 24 * H) }, status: { in: ['draft', 'review', 'approved', 'scheduled'] } }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, agentMeta: true }, take: 200 }), []),
  ])
  const preflightFailed = preflightRows.flatMap((p) => {
    const rows = ((p.agentMeta as { preflight?: Array<{ status: string; channel: string; format: string; detail: string }> } | null)?.preflight ?? []).filter((r) => r.status === 'failed')
    return rows.length ? [{ id: p.id, title: p.title, detail: rows.map((r) => `${r.channel} ${r.format}: ${r.detail}`).join(' · ').slice(0, 300) }] : []
  })
  // Facebook / Instagram accounts: publishing and statistics permissions, Instagram's 24 h quota
  const metaAccounts = metaConns.map((c) => {
    const channel = c.channel as MetaChannel
    const granted = (c.commentSettings as { grantedScopes?: string[] | null } | null)?.grantedScopes ?? null
    const caps = formatCapabilities(channel, granted)
    // The quota is read when the account is diagnosed: older than 2 h it says nothing about the last 24 h
    const capsRaw = c.capabilities as { quota?: { used: number; total: number } | null; checkedAt?: string } | null
    const fresh = capsRaw?.checkedAt && now.getTime() - new Date(capsRaw.checkedAt).getTime() < 2 * H
    const quota = fresh ? capsRaw?.quota ?? null : null
    return {
      id: c.id, name: c.name, channel,
      missingPublish: granted ? FORMAT_SCOPES[channel].publish.filter((x) => !granted.includes(x)) : [],
      noInsights: caps.some((f) => f.canMeasure === false),
      quotaUsed: quota?.used ?? null, quotaTotal: quota?.total ?? null,
    }
  })
  const AWAITING = ['proposed', 'awaiting_approval', 'confirmed']
  const actionsOf = (rows: typeof actionRows) => ({
    executed: sum(rows.filter((r) => r.status === 'executed').map((r) => r._count._all)),
    failed: sum(rows.filter((r) => r.status === 'failed').map((r) => r._count._all)),
    awaiting: sum(rows.filter((r) => AWAITING.includes(r.status)).map((r) => r._count._all)),
  })
  const [platform, waTemplates, guarantee, budgets, extras] = await Promise.all([
    platformExtras(now, today, safe),
    // Meta's state of the WhatsApp catalog (registry cached 30 min; never blocks the snapshot)
    safe('waTemplates', catalogStatus().then((rows) => ({
      approved: rows.filter((r) => r.status === 'approved').length,
      pending: rows.filter((r) => r.status === 'pending' || r.status === 'received').length,
      rejected: rows.filter((r) => r.status === 'rejected').map((r) => r.name),
      recategorized: rows.filter((r) => r.recategorized).map((r) => r.name),
    })), undefined),
    // Before the GuaranteeClaim SQL runs the table does not exist: zeros
    safe('guarantee', guaranteeStats(now), { open: 0, overdue: 0, strikesLast90: 0, partnersAtLimit: [] as Array<{ partnerId: string; strikes: number }> }),
    Promise.all(capped.map((w) => safe(`budgets.${w.name}`, workspaceUsage(w.id).then((u) => ({ workspace: w.name, pct: evaluateBudget(u, { costCapUsd: w.aiMonthlyCostCapUsd, callCap: w.aiMonthlyCallCap }).pct })), null))).then((xs) => xs.filter((x): x is { workspace: string; pct: number } => Boolean(x))),
    moreExtras(today, day, week, safe),
  ])
  const [attribution, requestAttention, phoneLogin] = await Promise.all([
    safe('attribution', attributionSnapshot(now), undefined),
    safe('requestAttention', scanAttention({ days: 30, now }).then((items) => {
      const flags = items.flatMap((x) => x.flags.map((f) => ({ ...f, id: x.id, ref: x.ref, service: x.service })))
      const codes: Record<string, number> = {}
      for (const x of items) for (const code of Array.from(new Set(x.flags.map((f) => f.code)))) codes[code] = (codes[code] ?? 0) + 1
      return {
        critical: flags.filter((f) => f.severity === 'critical').length,
        warning: flags.filter((f) => f.severity === 'warning').length,
        info: flags.filter((f) => f.severity === 'info').length,
        codes,
        top: flags.filter((f) => f.severity !== 'info').slice(0, 8).map((f) => ({ id: f.id, ref: f.ref, service: f.service, severity: f.severity, code: f.code, title: f.title })),
      }
    }), undefined),
    safe('phoneLogin', Promise.all([
      prisma.phoneLoginCode.count({ where: { createdAt: { gte: day } } }),
      prisma.phoneLoginCode.count({ where: { createdAt: { gte: day }, usedAt: { not: null } } }),
    ]).then(([sent, used]) => ({ sent24h: sent, used24h: used })), undefined),
  ])

  const s = o?.series
  const last7 = (xs: number[] | undefined) => sum((xs ?? []).slice(-7))
  const prev7 = (xs: number[] | undefined) => sum((xs ?? []).slice(-14, -7))
  const webhookRows = overview?.webhooks.byChannel ?? []
  const notOk = webhookRows.filter((w) => w.status !== 'OK')

  return {
    at: now.toISOString(),
    // Parts that could not be read this time: their numbers are zeros, not reality
    ...(unavailable.length ? { unavailable } : {}),
    sales: { today: o?.sales.today.amount ?? 0, todayDelta: o?.sales.today.delta ?? null, month: o?.sales.month.amount ?? 0, monthDelta: o?.sales.month.delta ?? null, last7: last7(s?.sales), prev7: prev7(s?.sales) },
    bookings: { today: o?.bookings.today ?? 0, pending: o?.bookings.pending ?? 0, cancelledToday: o?.bookings.cancelledToday ?? 0, last7: last7(s?.bookings), prev7: prev7(s?.bookings), rescheduledToday: platform.rescheduledToday },
    requests: { active: o?.requests.active ?? 0, withoutProposals: o?.requests.withoutProposals ?? 0 },
    partners: { available: o?.users.partnersAvailable ?? 0, verified: o?.users.partnersVerified ?? 0, pendingVerification },
    payments: { rejected24h, pendingOld, refundsOpen, refundsFailed },
    paymentIncidents: extras.paymentIncidents,
    reviews: { low7d },
    search: { total24h, zero24h },
    messaging: { sent24h, failed24h },
    security: { events24h, high24h, blockedIps },
    payouts: { pending: o?.payouts.pending ?? 0, failed: o?.payouts.failed ?? 0, paymentsToConfirm: o?.payouts.paymentsToConfirm ?? 0, oldestPendingDays: platform.oldestPayoutDays },
    inbox: { open: o?.inbox.open ?? 0, unassigned: o?.inbox.unassigned ?? 0, waiting: o?.inbox.waiting ?? 0, aiHandling: o?.inbox.aiHandling ?? 0, inboundToday: o?.inbox.today.inbound ?? 0, handoffsToday: o?.inbox.today.handoffs ?? 0 },
    aiAgents: (o?.ai.agents ?? []).map((a) => ({
      id: a.id, name: a.name, messagesToday: a.messagesToday,
      handoffsToday: handoffs.find((h) => h.aiAgentId === a.id)?._count._all ?? 0,
      openGaps: gaps.find((g) => g.agentId === a.id)?._count._all ?? 0,
      actionsToday: actionsOf(actionRows.filter((r) => r.agentId === a.id)),
    })),
    aiActions: { actionsToday: actionsOf(actionRows), chatCancellationsToday, cancellationsToday, awaitingApproval: platform.awaiting.count, oldestAwaitingMinutes: platform.awaiting.oldestMinutes },
    aiCost: { today: round(o?.ai.costToday ?? 0), month: round(o?.ai.costMonth ?? 0), avg7d: extras.aiCostAvg7d },
    aiProviders: { down: sys.aiDown, answering: sys.aiAnswering },
    marketing: {
      inReview: o?.marketing.inReview ?? 0, failedWeek: o?.marketing.failedWeek ?? 0, runErrors24h, scheduledToday: o?.marketing.scheduledToday ?? 0, ideasPending: o?.marketing.ideasPending ?? 0,
      degraded: (o?.marketing.agents ?? []).filter((a) => a.degraded).map((a) => ({ id: a.id, campaign: a.campaign, reason: a.degraded! })),
      editorial: { held: editorial[0], reviewedWeek: editorial[1], notApprovedWeek: editorial[2], failedWeek: editorial[3] },
      metaAccounts,
      preflightFailed,
    },
    quality: { rating: o?.quality.rating ?? null, casesOpen: o?.quality.casesOpen ?? 0, casesSla: o?.quality.casesSla ?? 0 },
    channels: { problems: (o?.channels.problems ?? []).map((c) => c.name) },
    system: {
      cronsFailing: sys.cronsFailing,
      cronsLate: sys.cronsLate,
      errorsLastHour: sys.errorsLastHour,
      criticalIncidents,
    },
    webhooks: overview ? { total24h: sum(webhookRows.map((w) => w.n)), notOk24h: sum(notOk.map((w) => w.n)), failingChannels: Array.from(new Set(notOk.map((w) => String(w.channel)))) } : undefined,
    externalServices: overview ? { errors: overview.services.filter((x) => x.level === 'error').map((x) => x.name), warnings: overview.services.filter((x) => x.level === 'warning').map((x) => x.name) } : undefined,
    automations: extras.automations,
    budgets,
    docs: platform.docs,
    catalog: platform.catalog,
    partnerCoverage: extras.partnerCoverage,
    origin: platform.origin,
    trust: platform.trust,
    config: platform.config,
    cities: extras.cities,
    guarantee,
    waTemplates,
    attribution,
    conversions: extras.conversions,
    requestAttention,
    phoneLogin,
  }
}

type Safe = <T>(name: string, p: PromiseLike<T>, fallback: T) => Promise<T>

/** Documents, catalog, payouts, approvals, origin and configuration. Each part falls back to zeros. */
async function platformExtras(now: Date, today: Date, safe: Safe) {
  const [docs, servicesWithoutPartners, partnersVerifiedNoServices, payout, awaiting, rescheduledToday, origin, trust] = await Promise.all([
    safe('docs', prisma.verificationDocument.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } }).then((r) => ({ pending: r._count._all, oldestHours: r._min.createdAt ? Math.round((now.getTime() - r._min.createdAt.getTime()) / H) : 0 })), { pending: 0, oldestHours: 0 }),
    safe('catalog.servicesWithoutPartners', prisma.service.count({ where: { partners: { none: { active: true, partner: { verified: true, isActive: true } } } } }), 0),
    safe('catalog.partnersVerifiedNoServices', prisma.partnerProfile.count({ where: { verified: true, isActive: true, services: { none: { active: true } } } }), 0),
    safe('payouts.oldest', prisma.payout.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, _min: { createdAt: true } }).then((r) => (r._min.createdAt ? Math.floor((now.getTime() - r._min.createdAt.getTime()) / (24 * H)) : 0)), 0),
    safe('aiActions.awaiting', prisma.aiAgentAction.aggregate({ where: { status: 'awaiting_approval' }, _count: { _all: true }, _min: { createdAt: true } }).then((r) => ({ count: r._count._all, oldestMinutes: r._min.createdAt ? Math.round((now.getTime() - r._min.createdAt.getTime()) / 60_000) : 0 })), { count: 0, oldestMinutes: 0 }),
    safe('bookings.rescheduled', prisma.bookingEvent.count({ where: { type: 'reschedule', createdAt: { gte: today } } }), 0),
    safe('origin', Promise.all([
      prisma.serviceRequest.count({ where: { createdAt: { gte: today }, origin: 'chat' } }),
      prisma.serviceRequest.count({ where: { createdAt: { gte: today }, origin: { not: 'chat' } } }),
      prisma.booking.count({ where: { createdAt: { gte: today }, origin: 'chat' } }),
      prisma.booking.count({ where: { createdAt: { gte: today }, origin: { not: 'chat' } } }),
    ]).then(([requestsTodayChat, requestsTodayApp, bookingsTodayChat, bookingsTodayApp]) => ({ requestsTodayChat, requestsTodayApp, bookingsTodayChat, bookingsTodayApp })), { requestsTodayChat: 0, requestsTodayApp: 0, bookingsTodayChat: 0, bookingsTodayApp: 0 }),
    safe('trust', trustReport().then((t) => ({ unbacked: t.unbacked.map((u) => u.key as string), commissionEnabled: t.facts.commissionEnabled, activeCities: t.facts.activeCities.length })), { unbacked: [] as string[], commissionEnabled: false, activeCities: 0 }),
  ])
  return {
    docs,
    catalog: { servicesWithoutPartners, partnersVerifiedNoServices },
    oldestPayoutDays: payout,
    awaiting,
    rescheduledToday,
    origin,
    trust: { unbacked: trust.unbacked },
    config: { commissionEnabled: trust.commissionEnabled, activeCities: trust.activeCities },
  }
}

/** Payment incidents, partner coverage, cities, automations, conversions and the AI cost average. */
async function moreExtras(today: Date, day: Date, week: Date, safe: Safe) {
  const verified = { verified: true, isActive: true }
  const [incidentsOpen, incidentsHigh, noZones, noSchedule, payoutNoBank, notActive, waitlist, autoSent, autoFailed, autoFailed7d, convSettings, convSent7d, cost7d] = await Promise.all([
    safe('paymentIncidents.open', prisma.paymentIncident.count({ where: { status: { in: [...INCIDENT_OPEN] } } }), 0),
    safe('paymentIncidents.high', prisma.paymentIncident.count({ where: { status: { in: [...INCIDENT_OPEN] }, severity: { in: ['HIGH', 'CRITICAL'] } } }), 0),
    // An empty zone list means «the whole city»: counted, but only informative
    safe('partnerCoverage.noZones', prisma.partnerProfile.count({ where: { ...verified, coverageZones: { isEmpty: true } } }), 0),
    safe('partnerCoverage.noSchedule', prisma.partnerProfile.count({ where: { ...verified, availability: { none: { active: true, partnerServiceId: null } } } }), 0),
    safe('partnerCoverage.payoutNoBank', prisma.partnerProfile.count({ where: { bankAccounts: { none: { isActive: true } }, payouts: { some: { status: { in: ['PENDING', 'PROCESSING'] } } } } }), 0),
    safe('cities', prisma.cityConfig.findMany({ where: { status: { not: 'ACTIVE' } }, select: { slug: true, name: true } }), [] as Array<{ slug: string; name: string }>),
    safe('cities.waitlist', prisma.cityWaitlist.groupBy({ by: ['citySlug'], where: { notifiedAt: null }, _count: { _all: true } }), [] as Array<{ citySlug: string; _count: { _all: number } }>),
    safe('automations.sent24h', prisma.automationExecution.count({ where: { executedAt: { gte: day }, status: { in: AUTOMATION_SENT } } }), 0),
    safe('automations.failed24h', prisma.automationExecution.count({ where: { executedAt: { gte: day }, status: 'FAILED' } }), 0),
    safe('automations.failed7d', prisma.automationExecution.count({ where: { executedAt: { gte: week }, status: 'FAILED' } }), 0),
    safe('conversions.settings', getConversionSettings(), null),
    safe('conversions.sent7d', prisma.conversionEvent.count({ where: { status: 'sent', createdAt: { gte: week } } }), 0),
    safe('aiCost.avg7d', prisma.aiCall.aggregate({ where: { createdAt: { gte: new Date(today.getTime() - 7 * 24 * H), lt: today } }, _sum: { costUsd: true } }).then((r) => round((r._sum.costUsd ?? 0) / 7)), undefined),
  ])
  const ready = await Promise.all(notActive.slice(0, 6).map((c) => safe(`cities.${c.slug}`, cityLaunchStatus(c.slug), null)))
  const cfg = convSettings
  return {
    paymentIncidents: { open: incidentsOpen, high: incidentsHigh },
    partnerCoverage: { noZones, noSchedule, payoutNoBank },
    cities: {
      readyToLaunch: ready.filter((r): r is NonNullable<typeof r> => Boolean(r && r.supported && r.ready)).map((r) => ({ slug: r.slug, name: r.city })),
      waitlistPending: Object.fromEntries(waitlist.map((w) => [w.citySlug, w._count._all])),
    },
    automations: { sent24h: autoSent, failed24h: autoFailed, failed7d: autoFailed7d },
    conversions: cfg ? { configured: Boolean((cfg.metaPixelId && cfg.metaToken) || (cfg.ga4MeasurementId && cfg.ga4ApiSecret)), sent7d: convSent7d } : undefined,
    aiCostAvg7d: cost7d,
  }
}
