import { prisma } from '@/lib/prisma'
import { platformOverview } from '@/lib/admin/overview'
import { bogotaDayStart } from '@/lib/admin/overview-core'
import { evaluateBudget, workspaceUsage } from '@/lib/ai/limits'
import { systemAlerts } from '@/lib/system/health'
import type { Snapshot } from '@/lib/haggo/detect'

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
  const budgets = await Promise.all(capped.map(async (w) => ({ workspace: w.name, pct: evaluateBudget(await workspaceUsage(w.id), { costCapUsd: w.aiMonthlyCostCapUsd, callCap: w.aiMonthlyCallCap }).pct })))
  const [rejected24h, pendingOld, refundsOpen, low7d, total24h, zero24h, sent24h, failed24h, events24h, high24h, blockedIps, runErrors24h, pendingVerification] = extra
  const s = o.series
  const last7 = (xs: number[]) => sum(xs.slice(-7))
  const prev7 = (xs: number[]) => sum(xs.slice(-14, -7))

  return {
    at: now.toISOString(),
    sales: { today: o.sales.today.amount, todayDelta: o.sales.today.delta, month: o.sales.month.amount, monthDelta: o.sales.month.delta, last7: last7(s.sales), prev7: prev7(s.sales) },
    bookings: { today: o.bookings.today, pending: o.bookings.pending, cancelledToday: o.bookings.cancelledToday, last7: last7(s.bookings), prev7: prev7(s.bookings) },
    requests: { active: o.requests.active, withoutProposals: o.requests.withoutProposals },
    partners: { available: o.users.partnersAvailable, verified: o.users.partnersVerified, pendingVerification },
    payments: { rejected24h, pendingOld, refundsOpen },
    reviews: { low7d },
    search: { total24h, zero24h },
    messaging: { sent24h, failed24h },
    security: { events24h, high24h, blockedIps },
    payouts: { pending: o.payouts.pending, failed: o.payouts.failed, paymentsToConfirm: o.payouts.paymentsToConfirm },
    inbox: { open: o.inbox.open, unassigned: o.inbox.unassigned, waiting: o.inbox.waiting, aiHandling: o.inbox.aiHandling, inboundToday: o.inbox.today.inbound, handoffsToday: o.inbox.today.handoffs },
    aiAgents: o.ai.agents.map((a) => ({
      id: a.id, name: a.name, messagesToday: a.messagesToday,
      handoffsToday: handoffs.find((h) => h.aiAgentId === a.id)?._count._all ?? 0,
      openGaps: gaps.find((g) => g.agentId === a.id)?._count._all ?? 0,
    })),
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
  }
}
