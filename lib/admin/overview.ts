import { prisma } from '@/lib/prisma'
import { periodOf } from '@/lib/ai/pricing'
import { latestSnapshots } from '@/lib/marketing/metrics'
import { systemAlerts } from '@/lib/system/health'
import { alertsFrom, bogotaKey, delta, fillSeries, lastDays, windows } from '@/lib/admin/overview-core'

const OPEN = ['OPEN', 'IN_PROGRESS'] as const
const range = (from: Date, to?: Date) => ({ gte: from, ...(to ? { lt: to } : {}) })

/** Money collected (approved payments by paid date) and the platform's share in a window. */
async function sales(from: Date, to?: Date) {
  const where = { status: 'APPROVED' as const, paidAt: range(from, to) }
  const [pay, partner] = await Promise.all([
    prisma.payment.aggregate({ where, _sum: { totalAmount: true, clientCommission: true }, _count: { _all: true } }),
    prisma.payout.aggregate({ where: { payment: where }, _sum: { partnerCommission: true } }),
  ])
  return {
    amount: pay._sum.totalAmount ?? 0,
    commission: (pay._sum.clientCommission ?? 0) + (partner._sum.partnerCommission ?? 0),
    count: pay._count._all,
  }
}

type Row = { d: string } & Record<string, number | bigint | null>

/** Per-day series for the last 14 days (Bogotá), grouped in SQL. */
async function series(from: Date) {
  const day = (col: string) => `to_char("${col}" - interval '5 hours', 'YYYY-MM-DD')`
  const [bookings, payments, users, messages] = await Promise.all([
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day('createdAt')} AS d, count(*)::int AS n FROM "Booking" WHERE "createdAt" >= $1 GROUP BY 1`, from),
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day('paidAt')} AS d, coalesce(sum("totalAmount"), 0)::float AS amount FROM "Payment" WHERE status = 'APPROVED' AND "paidAt" >= $1 GROUP BY 1`, from),
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day('createdAt')} AS d, count(*) FILTER (WHERE role = 'CLIENT')::int AS clients, count(*) FILTER (WHERE role = 'PARTNER')::int AS partners FROM "User" WHERE "createdAt" >= $1 GROUP BY 1`, from),
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT ${day('sentAt')} AS d, count(*) FILTER (WHERE m.direction = 'INBOUND')::int AS inbound, count(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m."aiAgentId" IS NOT NULL)::int AS ai, count(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m."aiAgentId" IS NULL)::int AS human
       FROM "ConversationMessage" m JOIN "Conversation" c ON c.id = m."conversationId"
       WHERE m."sentAt" >= $1 AND m."isInternal" = false AND c."isTest" = false GROUP BY 1`,
      from,
    ),
  ])
  return { bookings, payments, users, messages }
}

/** Latest things that happened across the platform, newest first. */
async function activity(since: Date) {
  const take = 8
  const [bookings, payments, users, convs, pubs, cases] = await Promise.all([
    prisma.booking.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, totalPrice: true, city: true, service: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { status: 'APPROVED', paidAt: { gte: since } }, orderBy: { paidAt: 'desc' }, take, select: { id: true, paidAt: true, totalAmount: true, booking: { select: { service: { select: { name: true } } } } } }),
    prisma.user.findMany({ where: { createdAt: { gte: since }, role: { in: ['CLIENT', 'PARTNER'] } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, role: true, name: true } }),
    prisma.conversation.findMany({ where: { createdAt: { gte: since }, isTest: false, aiSpam: false }, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, channel: true, contactName: true } }),
    prisma.marketingPublication.findMany({ where: { status: 'published', publishedAt: { gte: since } }, orderBy: { publishedAt: 'desc' }, take: take * 3, select: { id: true, publishedAt: true, channel: true, post: { select: { title: true, origin: true } } } }),
    prisma.adminSupportCase.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, subject: true, priority: true } }),
  ])
  // One line per post, with all the channels it went out on (not one per network)
  const CH: Record<string, string> = { WEB: 'Blog', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram' }
  const postGroups = (list: typeof pubs) => {
    const groups = new Map<string, { at: Date; title: string; agent: boolean; channels: string[]; id: string }>()
    for (const p of list) {
      const key = `${p.post.title}:${Math.floor(p.publishedAt!.getTime() / 3_600_000)}`
      const g = groups.get(key) ?? { at: p.publishedAt!, title: p.post.title, agent: p.post.origin === 'agent', channels: [], id: p.id }
      if (!g.channels.includes(CH[p.channel] ?? p.channel)) g.channels.push(CH[p.channel] ?? p.channel)
      if (p.publishedAt! > g.at) g.at = p.publishedAt!
      groups.set(key, g)
    }
    return Array.from(groups.values()).map((g) => ({ id: `m${g.id}`, at: g.at, kind: 'post', text: `${g.agent ? 'El agente publicó' : 'Publicado'}: ${g.title}`, detail: g.channels.join(', ') }))
  }
  const first = (name?: string | null) => (name || '').trim().split(/\s+/)[0] || 'Alguien'
  const items = [
    ...bookings.map((b) => ({ id: `b${b.id}`, at: b.createdAt, kind: 'booking', text: `Nueva reserva: ${b.service.name}`, detail: `$${Math.round(b.totalPrice).toLocaleString('es-CO')} · ${b.city.charAt(0)}${b.city.slice(1).toLowerCase()}` })),
    ...payments.map((p) => ({ id: `p${p.id}`, at: p.paidAt!, kind: 'payment', text: `Pago recibido: ${p.booking.service.name}`, detail: `$${Math.round(p.totalAmount).toLocaleString('es-CO')}` })),
    ...users.map((u) => ({ id: `u${u.id}`, at: u.createdAt, kind: u.role === 'PARTNER' ? 'partner' : 'client', text: u.role === 'PARTNER' ? `Nuevo socio: ${first(u.name)}` : `Nuevo cliente: ${first(u.name)}`, detail: null })),
    ...convs.map((c) => ({ id: `c${c.id}`, at: c.createdAt, kind: 'conversation', text: `Nueva conversación de ${first(c.contactName)}`, detail: c.channel })),
    ...postGroups(pubs),
    ...cases.map((c) => ({ id: `s${c.id}`, at: c.createdAt, kind: 'case', text: `Caso de soporte: ${c.subject}`, detail: c.priority })),
  ]
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 14)
}

/**
 * Everything the admin command center shows, in one pass: money, operation, people, inbox, AI,
 * marketing, quality and alerts. Counts exclude test conversations and spam.
 */
export async function platformOverview(now = new Date()) {
  const w = windows(now)
  const convBase = { isTest: false, aiSpam: false }
  const waitingSince = new Date(now.getTime() - 15 * 60_000)

  const [
    salesToday, salesYesterday, salesWeek, salesMonth, salesPrevMonth,
    bookingsToday, bookingsYesterday, bookingsScheduledToday, bookingsByStatus,
    requestsActive, requestsToday, requestsNoProposals,
    clients, partners, partnersVerified, partnersAvailable, newClientsToday, newPartnersToday, newUsersWeek,
    payoutsPending, payoutsFailed, paymentsToConfirm,
    convOpen, convUnassigned, convWaiting, convUnread, convByChannel, convAiOpen, msgsToday, handoffsToday,
    aiAgents, aiCallsToday, aiCostMonth, aiByAgentToday,
    mkScheduledToday, mkUpcoming, mkPublishedWeek, mkInReview, mkFailedWeek, mkAgents, mkIdeasPending, blogViews,
    casesOpen, casesSla, reviews30, reviewsWeek,
    connections,
    rawSeries, feed, sys,
  ] = await Promise.all([
    sales(w.today), sales(w.yesterday, w.yesterdaySameTime), sales(w.week), sales(w.month), sales(w.prevMonth, w.prevMonthEnd),
    prisma.booking.count({ where: { createdAt: range(w.today) } }),
    prisma.booking.count({ where: { createdAt: range(w.yesterday, w.yesterdaySameTime) } }),
    prisma.booking.count({ where: { scheduledDate: range(w.today, new Date(w.today.getTime() + 24 * 3600_000)), status: { not: 'CANCELLED' } } }),
    prisma.booking.groupBy({ by: ['status'], where: { OR: [{ status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }, { updatedAt: range(w.today) }] }, _count: { _all: true } }),
    prisma.serviceRequest.count({ where: { status: 'ACTIVE' } }),
    prisma.serviceRequest.count({ where: { createdAt: range(w.today) } }),
    prisma.serviceRequest.count({ where: { status: 'ACTIVE', createdAt: { lt: new Date(now.getTime() - 2 * 3600_000) }, proposals: { none: {} } } }),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.partnerProfile.count(),
    prisma.partnerProfile.count({ where: { verified: true } }),
    prisma.partnerProfile.count({ where: { verified: true, isActive: true, isAvailable: true } }),
    prisma.user.count({ where: { role: 'CLIENT', createdAt: range(w.today) } }),
    prisma.user.count({ where: { role: 'PARTNER', createdAt: range(w.today) } }),
    prisma.user.count({ where: { role: { in: ['CLIENT', 'PARTNER'] }, createdAt: range(w.week) } }),
    prisma.payout.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, _sum: { netAmount: true }, _count: { _all: true } }),
    prisma.payout.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: 'PENDING', confirmationStatus: { in: ['CLIENT_REPORTED', 'PARTNER_REPORTED'] } } }),
    prisma.conversation.count({ where: { ...convBase, status: { in: [...OPEN] } } }),
    prisma.conversation.count({ where: { ...convBase, status: { in: [...OPEN] }, assignedToId: null, aiHandled: false } }),
    prisma.conversation.count({ where: { ...convBase, status: { in: [...OPEN] }, unreadCount: { gt: 0 }, lastMessageAt: { lt: waitingSince } } }),
    prisma.conversation.aggregate({ where: { ...convBase, status: { in: [...OPEN] } }, _sum: { unreadCount: true } }),
    prisma.conversation.groupBy({ by: ['channel'], where: { ...convBase, status: { in: [...OPEN] } }, _count: { _all: true } }),
    prisma.conversation.count({ where: { ...convBase, status: { in: [...OPEN] }, aiHandled: true, aiHandoffAt: null } }),
    prisma.conversationMessage.groupBy({ by: ['direction'], where: { sentAt: range(w.today), isInternal: false, conversation: { isTest: false } }, _count: { _all: true } }),
    prisma.conversation.count({ where: { ...convBase, aiHandoffAt: range(w.today) } }),
    prisma.aiAgent.findMany({ where: { status: 'active' }, select: { id: true, name: true, autopilot: true, workspace: { select: { name: true } } } }),
    prisma.aiCall.aggregate({ where: { createdAt: range(w.today) }, _sum: { costUsd: true }, _count: { _all: true } }),
    prisma.aiCall.aggregate({ where: { period: periodOf(now) }, _sum: { costUsd: true } }),
    prisma.conversationMessage.groupBy({ by: ['aiAgentId'], where: { sentAt: range(w.today), direction: 'OUTBOUND', aiAgentId: { not: null } }, _count: { _all: true } }),
    prisma.marketingPublication.count({ where: { status: 'scheduled', scheduledAt: range(w.today, new Date(w.today.getTime() + 24 * 3600_000)) } }),
    prisma.marketingPublication.findMany({ where: { status: 'scheduled', scheduledAt: { gte: now } }, orderBy: { scheduledAt: 'asc' }, take: 5, select: { id: true, channel: true, scheduledAt: true, post: { select: { id: true, title: true, origin: true } } } }),
    prisma.marketingPublication.findMany({ where: { status: 'published', publishedAt: range(w.week) }, select: { id: true, channel: true } }),
    prisma.marketingPost.count({ where: { status: 'review' } }),
    prisma.marketingPublication.count({ where: { status: 'failed', updatedAt: range(w.week) } }),
    prisma.marketingAgent.findMany({ where: { status: 'active' }, select: { id: true, mode: true, degradedReason: true, campaign: { select: { name: true } } } }),
    prisma.marketingIdea.count({ where: { status: 'proposed', agent: { status: 'active' } } }),
    prisma.webPageView.aggregate({ where: { day: { gte: bogotaKey(w.week) } }, _sum: { views: true } }),
    prisma.adminSupportCase.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.adminSupportCase.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, slaDueAt: { lt: now } } }),
    prisma.review.aggregate({ where: { clientReviewedAt: range(w.days30), clientToPartnerRating: { not: null } }, _avg: { clientToPartnerRating: true }, _count: { _all: true } }),
    prisma.review.count({ where: { clientReviewedAt: range(w.week), clientToPartnerRating: { not: null } } }),
    prisma.channelConnection.findMany({ select: { id: true, name: true, channel: true, status: true, enabled: true } }),
    series(w.days14),
    activity(new Date(now.getTime() - 3 * 24 * 3600_000)),
    systemAlerts(now),
  ])

  const agentNames = new Map(aiAgents.map((a) => [a.id, a.name]))
  const otherAgentIds = aiByAgentToday.map((r) => r.aiAgentId).filter((id): id is string => Boolean(id) && !agentNames.has(id!))
  if (otherAgentIds.length) for (const a of await prisma.aiAgent.findMany({ where: { id: { in: otherAgentIds } }, select: { id: true, name: true } })) agentNames.set(a.id, a.name)
  const snaps = await latestSnapshots(mkPublishedWeek.filter((p) => p.channel !== 'WEB').map((p) => p.id))
  let reachWeek = 0
  let interactionsWeek = 0
  snaps.forEach((s) => { if (s) { reachWeek += s.reach; interactionsWeek += s.likes + s.comments + s.shares + s.saves } })

  const keys = lastDays(now, 14)
  const status = (s: string) => bookingsByStatus.find((b) => b.status === s)?._count._all ?? 0
  const inbound = msgsToday.find((m) => m.direction === 'INBOUND')?._count._all ?? 0
  const outbound = msgsToday.find((m) => m.direction === 'OUTBOUND')?._count._all ?? 0
  const aiMsgsToday = aiByAgentToday.reduce((a, r) => a + r._count._all, 0)
  const channelProblems = connections.filter((c) => c.enabled && c.status === 'ERROR')

  return {
    generatedAt: now.toISOString(),
    sales: {
      today: { ...salesToday, delta: delta(salesToday.amount, salesYesterday.amount) },
      week: salesWeek,
      month: { ...salesMonth, delta: delta(salesMonth.amount, salesPrevMonth.amount), previous: salesPrevMonth.amount },
    },
    bookings: {
      today: bookingsToday,
      todayDelta: delta(bookingsToday, bookingsYesterday),
      scheduledToday: bookingsScheduledToday,
      pending: status('PENDING'), confirmed: status('CONFIRMED'), inProgress: status('IN_PROGRESS'),
      // Only rows touched today reach these two (see the groupBy filter)
      completedToday: status('COMPLETED'), cancelledToday: status('CANCELLED'),
    },
    requests: { active: requestsActive, today: requestsToday, withoutProposals: requestsNoProposals },
    users: { clients, partners, partnersVerified, partnersAvailable, newClientsToday, newPartnersToday, newWeek: newUsersWeek },
    payouts: { pending: payoutsPending._count._all, pendingAmount: payoutsPending._sum.netAmount ?? 0, failed: payoutsFailed, paymentsToConfirm },
    inbox: {
      open: convOpen, unassigned: convUnassigned, waiting: convWaiting, unread: convUnread._sum.unreadCount ?? 0, aiHandling: convAiOpen,
      byChannel: convByChannel.map((c) => ({ channel: c.channel, open: c._count._all })).sort((a, b) => b.open - a.open),
      today: { inbound, outbound, ai: aiMsgsToday, handoffs: handoffsToday },
    },
    ai: {
      agents: aiAgents.map((a) => ({ id: a.id, name: a.name, autopilot: a.autopilot, workspace: a.workspace.name, messagesToday: aiByAgentToday.find((r) => r.aiAgentId === a.id)?._count._all ?? 0 })).sort((a, b) => b.messagesToday - a.messagesToday),
      callsToday: aiCallsToday._count._all,
      costToday: aiCallsToday._sum.costUsd ?? 0,
      costMonth: aiCostMonth._sum.costUsd ?? 0,
    },
    marketing: {
      scheduledToday: mkScheduledToday,
      upcoming: mkUpcoming.map((p) => ({ id: p.id, postId: p.post.id, title: p.post.title, channel: p.channel, at: p.scheduledAt, agent: p.post.origin === 'agent' })),
      publishedWeek: mkPublishedWeek.length,
      reachWeek, interactionsWeek,
      blogViewsWeek: blogViews._sum.views ?? 0,
      inReview: mkInReview,
      failedWeek: mkFailedWeek,
      agents: mkAgents.map((a) => ({ id: a.id, campaign: a.campaign.name, mode: a.mode, degraded: a.degradedReason })),
      ideasPending: mkIdeasPending,
    },
    quality: {
      rating: reviews30._avg.clientToPartnerRating ? Math.round(reviews30._avg.clientToPartnerRating * 10) / 10 : null,
      reviews30: reviews30._count._all,
      reviewsWeek,
      casesOpen, casesSla,
    },
    channels: { total: connections.filter((c) => c.enabled).length, problems: channelProblems.map((c) => ({ name: c.name, channel: c.channel })) },
    series: {
      days: keys,
      bookings: fillSeries(keys, rawSeries.bookings, ['n']).map((r) => r.n),
      sales: fillSeries(keys, rawSeries.payments, ['amount']).map((r) => r.amount),
      clients: fillSeries(keys, rawSeries.users, ['clients']).map((r) => r.clients),
      partners: fillSeries(keys, rawSeries.users, ['partners']).map((r) => r.partners),
      inbound: fillSeries(keys, rawSeries.messages, ['inbound']).map((r) => r.inbound),
      aiReplies: fillSeries(keys, rawSeries.messages, ['ai']).map((r) => r.ai),
      humanReplies: fillSeries(keys, rawSeries.messages, ['human']).map((r) => r.human),
    },
    activity: feed.map((f) => ({ ...f, at: f.at.toISOString() })),
    alerts: alertsFrom({
      waitingCustomers: convWaiting,
      slaBreached: casesSla,
      channelProblems: channelProblems.length,
      payoutsFailed,
      postsFailed: mkFailedWeek,
      agentsDegraded: mkAgents.filter((a) => a.degradedReason).length,
      requestsWithoutProposals: requestsNoProposals,
      paymentsToConfirm,
      cronsFailing: sys.cronsFailing,
      cronsLate: sys.cronsLate,
      errorsLastHour: sys.errorsLastHour,
      aiDown: sys.aiDown,
      aiAnswering: sys.aiAnswering,
    }),
  }
}

export type PlatformOverview = Awaited<ReturnType<typeof platformOverview>>
