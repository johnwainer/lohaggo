import { attributionSnapshot } from '@/lib/analytics/origins'
import { scanAttention } from '@/lib/admin/request-360'
import { prisma } from '@/lib/prisma'
import { platformOverview } from '@/lib/admin/overview'
import { bogotaDayStart } from '@/lib/admin/overview-core'
import { evaluateBudget, workspaceUsage } from '@/lib/ai/limits'
import { systemAlerts } from '@/lib/system/health'
import { trustReport } from '@/lib/public/trust'
import type { Snapshot } from '@/lib/haggo/detect'
import { guaranteeStats } from '@/lib/guarantee/ops'
import { catalogStatus } from '@/lib/messaging/wa-registry'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const round = (n: number) => Math.round(n * 100) / 100

/** The platform as Haggo sees it: the dashboard's numbers plus what the dashboard does not break down. */
export async function takeSnapshot(now = new Date()): Promise<Snapshot> {
  const today = bogotaDayStart(now)
  const day = new Date(now.getTime() - 24 * 3600_000)
  const week = new Date(now.getTime() - 7 * 24 * 3600_000)
  const [extra, sys, o, handoffs, gaps, criticalIncidents, capped, editorial] = await Promise.all([
    Promise.all([
      prisma.payment.count({ where: { status: 'REJECTED', updatedAt: { gte: day } } }),
      prisma.payment.count({ where: { status: 'PENDING', createdAt: { lt: day } } }),
      prisma.refundCase.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'] } } }).catch(() => 0),
      prisma.review.count({ where: { clientReviewedAt: { gte: week }, clientToPartnerRating: { lte: 2 } } }),
      prisma.searchEvent.count({ where: { createdAt: { gte: day } } }),
      prisma.searchEvent.count({ where: { createdAt: { gte: day }, resultCount: 0 } }),
      prisma.messagingDelivery.count({ where: { createdAt: { gte: day }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] } } }),
      prisma.messagingDelivery.count({ where: { createdAt: { gte: day }, status: 'FAILED' } }),
      prisma.securityEvent.count({ where: { createdAt: { gte: day } } }),
      prisma.securityEvent.count({ where: { createdAt: { gte: day }, severity: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.blockedIp.count({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      prisma.marketingAgentRun.count({ where: { status: 'error', startedAt: { gte: day } } }),
      prisma.partnerProfile.count({ where: { verified: false, isActive: true } }),
    ]),
    systemAlerts(now),
    platformOverview(now),
    prisma.conversation.groupBy({ by: ['aiAgentId'], where: { aiHandoffAt: { gte: today }, isTest: false, aiAgentId: { not: null } }, _count: { _all: true } }),
    prisma.aiKnowledgeGap.groupBy({ by: ['agentId'], where: { status: 'open', agentId: { not: null } }, _count: { _all: true } }),
    prisma.adminIncident.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL' } }),
    prisma.workspace.findMany({ where: { OR: [{ aiMonthlyCostCapUsd: { not: null } }, { aiMonthlyCallCap: { not: null } }] }, select: { id: true, name: true, aiMonthlyCostCapUsd: true, aiMonthlyCallCap: true } }),
    // Editorial review: pieces held by the editor (or whose review could not run) and the editor's week
    Promise.all([
      prisma.marketingPost.count({ where: { reviewStatus: { in: ['changes', 'rejected', 'failed'] }, status: { in: ['draft', 'review', 'approved'] } } }),
      prisma.marketingReview.count({ where: { reviewer: 'editor', createdAt: { gte: week }, verdict: { not: 'error' } } }),
      prisma.marketingReview.count({ where: { reviewer: 'editor', createdAt: { gte: week }, verdict: { in: ['changes', 'rejected'] } } }),
      prisma.marketingReview.count({ where: { createdAt: { gte: week }, verdict: 'error' } }),
    ]).catch(() => [0, 0, 0, 0]),
  ])
  // What the inbox agents did today on the platform, and the day's cancellations by origin
  const [actionRows, chatCancellationsToday, cancellationsToday] = await Promise.all([
    prisma.aiAgentAction.groupBy({ by: ['agentId', 'status'], where: { createdAt: { gte: today } }, _count: { _all: true } }),
    prisma.bookingEvent.count({ where: { type: 'status', toStatus: 'CANCELLED', origin: 'chat', createdAt: { gte: today } } }),
    prisma.bookingEvent.count({ where: { type: 'status', toStatus: 'CANCELLED', createdAt: { gte: today } } }),
  ]).catch(() => [[] as Array<{ agentId: string; status: string; _count: { _all: number } }>, 0, 0] as const)
  const AWAITING = ['proposed', 'awaiting_approval', 'confirmed']
  const actionsOf = (rows: typeof actionRows) => ({
    executed: sum(rows.filter((r) => r.status === 'executed').map((r) => r._count._all)),
    failed: sum(rows.filter((r) => r.status === 'failed').map((r) => r._count._all)),
    awaiting: sum(rows.filter((r) => AWAITING.includes(r.status)).map((r) => r._count._all)),
  })
  const platform = await platformExtras(now, today)
  // Before the GuaranteeClaim SQL runs the table does not exist: zeros
  // Meta's state of the WhatsApp catalog (registry cached 30 min; never blocks the snapshot)
  const waTemplates = await catalogStatus().then((rows) => ({
    approved: rows.filter((r) => r.status === 'approved').length,
    pending: rows.filter((r) => r.status === 'pending' || r.status === 'received').length,
    rejected: rows.filter((r) => r.status === 'rejected').map((r) => r.name),
    recategorized: rows.filter((r) => r.recategorized).map((r) => r.name),
  })).catch(() => undefined)
  const guarantee = await guaranteeStats(now).catch(() => ({ open: 0, overdue: 0, strikesLast90: 0, partnersAtLimit: [] as Array<{ partnerId: string; strikes: number }> }))
  const budgets = await Promise.all(capped.map(async (w) => ({ workspace: w.name, pct: evaluateBudget(await workspaceUsage(w.id), { costCapUsd: w.aiMonthlyCostCapUsd, callCap: w.aiMonthlyCallCap }).pct })))
  const [rejected24h, pendingOld, refundsOpen, low7d, total24h, zero24h, sent24h, failed24h, events24h, high24h, blockedIps, runErrors24h, pendingVerification] = extra
  const s = o.series
  const last7 = (xs: number[]) => sum(xs.slice(-7))
  const prev7 = (xs: number[]) => sum(xs.slice(-14, -7))

  return {
    at: now.toISOString(),
    sales: { today: o.sales.today.amount, todayDelta: o.sales.today.delta, month: o.sales.month.amount, monthDelta: o.sales.month.delta, last7: last7(s.sales), prev7: prev7(s.sales) },
    bookings: { today: o.bookings.today, pending: o.bookings.pending, cancelledToday: o.bookings.cancelledToday, last7: last7(s.bookings), prev7: prev7(s.bookings), rescheduledToday: platform.rescheduledToday },
    requests: { active: o.requests.active, withoutProposals: o.requests.withoutProposals },
    partners: { available: o.users.partnersAvailable, verified: o.users.partnersVerified, pendingVerification },
    payments: { rejected24h, pendingOld, refundsOpen },
    reviews: { low7d },
    search: { total24h, zero24h },
    messaging: { sent24h, failed24h },
    security: { events24h, high24h, blockedIps },
    payouts: { pending: o.payouts.pending, failed: o.payouts.failed, paymentsToConfirm: o.payouts.paymentsToConfirm, oldestPendingDays: platform.oldestPayoutDays },
    inbox: { open: o.inbox.open, unassigned: o.inbox.unassigned, waiting: o.inbox.waiting, aiHandling: o.inbox.aiHandling, inboundToday: o.inbox.today.inbound, handoffsToday: o.inbox.today.handoffs },
    aiAgents: o.ai.agents.map((a) => ({
      id: a.id, name: a.name, messagesToday: a.messagesToday,
      handoffsToday: handoffs.find((h) => h.aiAgentId === a.id)?._count._all ?? 0,
      openGaps: gaps.find((g) => g.agentId === a.id)?._count._all ?? 0,
      actionsToday: actionsOf(actionRows.filter((r) => r.agentId === a.id)),
    })),
    aiActions: { actionsToday: actionsOf(actionRows), chatCancellationsToday, cancellationsToday, awaitingApproval: platform.awaiting.count, oldestAwaitingMinutes: platform.awaiting.oldestMinutes },
    aiCost: { today: round(o.ai.costToday), month: round(o.ai.costMonth) },
    aiProviders: { down: sys.aiDown, answering: sys.aiAnswering },
    marketing: {
      inReview: o.marketing.inReview, failedWeek: o.marketing.failedWeek, runErrors24h, scheduledToday: o.marketing.scheduledToday, ideasPending: o.marketing.ideasPending,
      degraded: o.marketing.agents.filter((a) => a.degraded).map((a) => ({ id: a.id, campaign: a.campaign, reason: a.degraded! })),
      editorial: { held: editorial[0], reviewedWeek: editorial[1], notApprovedWeek: editorial[2], failedWeek: editorial[3] },
    },
    quality: { rating: o.quality.rating, casesOpen: o.quality.casesOpen, casesSla: o.quality.casesSla },
    channels: { problems: o.channels.problems.map((c) => c.name) },
    system: {
      cronsFailing: sys.cronsFailing,
      cronsLate: sys.cronsLate,
      errorsLastHour: sys.errorsLastHour,
      criticalIncidents,
    },
    budgets,
    docs: platform.docs,
    catalog: platform.catalog,
    origin: platform.origin,
    trust: platform.trust,
    config: platform.config,
    guarantee,
    waTemplates,
    attribution: await attributionSnapshot(now).catch(() => undefined),
    requestAttention: await scanAttention({ days: 30, now }).then((items) => {
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
    }).catch(() => undefined),
    phoneLogin: await Promise.all([
      prisma.phoneLoginCode.count({ where: { createdAt: { gte: day } } }),
      prisma.phoneLoginCode.count({ where: { createdAt: { gte: day }, usedAt: { not: null } } }),
    ]).then(([sent24h, used24h]) => ({ sent24h, used24h })).catch(() => undefined),
  }
}

const zero = <T,>(v: T) => () => v

/** Documents, catalog, payouts, approvals, origin and configuration. Each part falls back to zeros. */
async function platformExtras(now: Date, today: Date) {
  const H = 3600_000
  const [docs, servicesWithoutPartners, partnersVerifiedNoServices, payout, awaiting, rescheduledToday, origin, trust] = await Promise.all([
    prisma.verificationDocument.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } }).then((r) => ({ pending: r._count._all, oldestHours: r._min.createdAt ? Math.round((now.getTime() - r._min.createdAt.getTime()) / H) : 0 })).catch(zero({ pending: 0, oldestHours: 0 })),
    prisma.service.count({ where: { partners: { none: { active: true, partner: { verified: true, isActive: true } } } } }).catch(zero(0)),
    prisma.partnerProfile.count({ where: { verified: true, isActive: true, services: { none: { active: true } } } }).catch(zero(0)),
    prisma.payout.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, _min: { createdAt: true } }).then((r) => (r._min.createdAt ? Math.floor((now.getTime() - r._min.createdAt.getTime()) / (24 * H)) : 0)).catch(zero(0)),
    prisma.aiAgentAction.aggregate({ where: { status: 'awaiting_approval' }, _count: { _all: true }, _min: { createdAt: true } }).then((r) => ({ count: r._count._all, oldestMinutes: r._min.createdAt ? Math.round((now.getTime() - r._min.createdAt.getTime()) / 60_000) : 0 })).catch(zero({ count: 0, oldestMinutes: 0 })),
    prisma.bookingEvent.count({ where: { type: 'reschedule', createdAt: { gte: today } } }).catch(zero(0)),
    Promise.all([
      prisma.serviceRequest.count({ where: { createdAt: { gte: today }, origin: 'chat' } }),
      prisma.serviceRequest.count({ where: { createdAt: { gte: today }, origin: { not: 'chat' } } }),
      prisma.booking.count({ where: { createdAt: { gte: today }, origin: 'chat' } }),
      prisma.booking.count({ where: { createdAt: { gte: today }, origin: { not: 'chat' } } }),
    ]).then(([requestsTodayChat, requestsTodayApp, bookingsTodayChat, bookingsTodayApp]) => ({ requestsTodayChat, requestsTodayApp, bookingsTodayChat, bookingsTodayApp })).catch(zero({ requestsTodayChat: 0, requestsTodayApp: 0, bookingsTodayChat: 0, bookingsTodayApp: 0 })),
    trustReport().then((t) => ({ unbacked: t.unbacked.map((u) => u.key as string), commissionEnabled: t.facts.commissionEnabled, activeCities: t.facts.activeCities.length })).catch(zero({ unbacked: [] as string[], commissionEnabled: false, activeCities: 0 })),
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
