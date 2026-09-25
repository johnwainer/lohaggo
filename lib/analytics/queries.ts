import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { change, funnel, lastMonths, percentile, periodDays, ratio, sourceLabel, type Period } from '@/lib/analytics/core'

export type Filters = { city: string | null; categoryId: string | null }

const CITIES = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA']
export const cleanFilters = (city?: string | null, categoryId?: string | null): Filters => ({
  city: city && CITIES.includes(city) ? city : null,
  categoryId: categoryId && /^[a-z0-9]{10,40}$/i.test(categoryId) ? categoryId : null,
})

const n = (v: unknown) => Number(v ?? 0)
/** Day and month keys in Bogotá, computed in SQL. */
const dayOf = (col: Prisma.Sql) => Prisma.sql`to_char(${col} - interval '5 hours', 'YYYY-MM-DD')`
const monthOf = (col: Prisma.Sql) => Prisma.sql`to_char(${col} - interval '5 hours', 'YYYY-MM')`
/** Booking-level filters (b = "Booking", s = "Service"). */
const bookingWhere = (f: Filters) => Prisma.sql`${f.city ? Prisma.sql`AND b.city::text = ${f.city}` : Prisma.empty} ${f.categoryId ? Prisma.sql`AND s."categoryId" = ${f.categoryId}` : Prisma.empty}`
/** Request-level filters (r = "ServiceRequest", s = "Service"). */
const requestWhere = (f: Filters) => Prisma.sql`${f.city ? Prisma.sql`AND r.city::text = ${f.city}` : Prisma.empty} ${f.categoryId ? Prisma.sql`AND s."categoryId" = ${f.categoryId}` : Prisma.empty}`

// ─── Negocio ────────────────────────────────────────────────────────────────

async function money(from: Date, to: Date, f: Filters) {
  const [row] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT coalesce(sum(p."totalAmount"), 0)::float AS amount, coalesce(sum(p."clientCommission"), 0)::float AS client_fee,
           coalesce(sum(po."partnerCommission"), 0)::float AS partner_fee, count(p.id)::int AS payments
    FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" JOIN "Service" s ON s.id = b."serviceId"
    LEFT JOIN "Payout" po ON po."paymentId" = p.id
    WHERE p.status = 'APPROVED' AND p."paidAt" >= ${from} AND p."paidAt" < ${to} ${bookingWhere(f)}`
  const [bk] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT count(*)::int AS created, count(*) FILTER (WHERE b.status = 'COMPLETED')::int AS completed, count(*) FILTER (WHERE b.status = 'CANCELLED')::int AS cancelled
    FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId" WHERE b."createdAt" >= ${from} AND b."createdAt" < ${to} ${bookingWhere(f)}`
  const amount = n(row.amount)
  const payments = n(row.payments)
  return { amount, commission: n(row.client_fee) + n(row.partner_fee), payments, ticket: payments ? amount / payments : 0, bookings: n(bk.created), completed: n(bk.completed), cancelled: n(bk.cancelled) }
}

export async function business(p: Period, f: Filters) {
  const [cur, prev] = await Promise.all([money(p.from, p.to, f), money(p.prevFrom, p.prevTo, f)])
  const months = lastMonths(p.to, 12)
  const since = new Date(`${months[0]}-01T00:00:00-05:00`)
  const [monthly, monthlyBookings, byService, byCategory, byCity] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${monthOf(Prisma.sql`p."paidAt"`)} AS m, coalesce(sum(p."totalAmount"), 0)::float AS amount, count(*)::int AS payments
      FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" JOIN "Service" s ON s.id = b."serviceId"
      WHERE p.status = 'APPROVED' AND p."paidAt" >= ${since} ${bookingWhere(f)} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${monthOf(Prisma.sql`b."createdAt"`)} AS m, count(*)::int AS n FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId"
      WHERE b."createdAt" >= ${since} ${bookingWhere(f)} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s.name AS name, count(DISTINCT b.id)::int AS bookings, coalesce(sum(p."totalAmount") FILTER (WHERE p.status = 'APPROVED' AND p."paidAt" >= ${p.from} AND p."paidAt" < ${p.to}), 0)::float AS amount
      FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId" LEFT JOIN "Payment" p ON p."bookingId" = b.id
      WHERE b."createdAt" >= ${p.from} AND b."createdAt" < ${p.to} ${bookingWhere(f)} GROUP BY s.name ORDER BY amount DESC, bookings DESC LIMIT 15`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c.name AS name, count(DISTINCT b.id)::int AS bookings, coalesce(sum(p."totalAmount") FILTER (WHERE p.status = 'APPROVED' AND p."paidAt" >= ${p.from} AND p."paidAt" < ${p.to}), 0)::float AS amount
      FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId" JOIN "Category" c ON c.id = s."categoryId" LEFT JOIN "Payment" p ON p."bookingId" = b.id
      WHERE b."createdAt" >= ${p.from} AND b."createdAt" < ${p.to} ${bookingWhere(f)} GROUP BY c.name ORDER BY amount DESC, bookings DESC LIMIT 12`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT b.city::text AS name, count(DISTINCT b.id)::int AS bookings, coalesce(sum(p."totalAmount") FILTER (WHERE p.status = 'APPROVED' AND p."paidAt" >= ${p.from} AND p."paidAt" < ${p.to}), 0)::float AS amount
      FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId" LEFT JOIN "Payment" p ON p."bookingId" = b.id
      WHERE b."createdAt" >= ${p.from} AND b."createdAt" < ${p.to} ${bookingWhere(f)} GROUP BY 1 ORDER BY amount DESC`,
  ])
  const rows = (r: Array<Record<string, unknown>>) => r.map((x) => ({ name: String(x.name), bookings: n(x.bookings), amount: n(x.amount) }))
  return {
    kpis: {
      amount: { value: cur.amount, change: change(cur.amount, prev.amount) },
      commission: { value: cur.commission, change: change(cur.commission, prev.commission) },
      payments: { value: cur.payments, change: change(cur.payments, prev.payments) },
      ticket: { value: cur.ticket, change: change(cur.ticket, prev.ticket) },
      bookings: { value: cur.bookings, change: change(cur.bookings, prev.bookings) },
      completionRate: { value: ratio(cur.completed, cur.bookings), previous: ratio(prev.completed, prev.bookings) },
      cancellationRate: { value: ratio(cur.cancelled, cur.bookings), previous: ratio(prev.cancelled, prev.bookings) },
    },
    monthly: months.map((m) => ({
      month: m,
      amount: n(monthly.find((x) => x.m === m)?.amount),
      payments: n(monthly.find((x) => x.m === m)?.payments),
      bookings: n(monthlyBookings.find((x) => x.m === m)?.n),
    })),
    byService: rows(byService),
    byCategory: rows(byCategory),
    byCity: rows(byCity),
  }
}

// ─── Embudo ─────────────────────────────────────────────────────────────────

async function requestFunnel(from: Date, to: Date, f: Filters) {
  const [row] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    WITH r AS (
      SELECT r.id, r."createdAt" FROM "ServiceRequest" r JOIN "Service" s ON s.id = r."serviceId"
      WHERE r."createdAt" >= ${from} AND r."createdAt" < ${to} ${requestWhere(f)}
    ),
    fp AS (SELECT pr."serviceRequestId" AS id, min(pr."createdAt") AS first FROM "Proposal" pr JOIN r ON r.id = pr."serviceRequestId" GROUP BY 1),
    bk AS (
      SELECT DISTINCT ON (pr."serviceRequestId") pr."serviceRequestId" AS id, b.id AS booking_id, b.status
      FROM "Booking" b JOIN "Proposal" pr ON pr.id = b."proposalId" JOIN r ON r.id = pr."serviceRequestId"
      ORDER BY pr."serviceRequestId", b."createdAt"
    )
    SELECT (SELECT count(*) FROM r)::int AS requests,
           (SELECT count(*) FROM fp)::int AS with_proposal,
           (SELECT count(*) FROM bk)::int AS booked,
           (SELECT count(*) FROM bk WHERE status = 'COMPLETED')::int AS completed,
           (SELECT count(*) FROM bk JOIN "Payment" py ON py."bookingId" = bk.booking_id WHERE py.status = 'APPROVED')::int AS paid,
           (SELECT coalesce(json_agg(extract(epoch FROM fp.first - r."createdAt") / 3600), '[]') FROM fp JOIN r ON r.id = fp.id) AS hours`
  return row
}

export async function funnelTab(p: Period, f: Filters) {
  const [cur, prev, searches, prevSearches, direct, daily, cancels] = await Promise.all([
    requestFunnel(p.from, p.to, f),
    requestFunnel(p.prevFrom, p.prevTo, f),
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT count(*)::int AS total, count(DISTINCT coalesce("userId", "visitorId"))::int AS people FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT count(*)::int AS total FROM "SearchEvent" WHERE "createdAt" >= ${p.prevFrom} AND "createdAt" < ${p.prevTo}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(*)::int AS n FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId"
      WHERE b."proposalId" IS NULL AND b."createdAt" >= ${p.from} AND b."createdAt" < ${p.to} ${bookingWhere(f)}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${dayOf(Prisma.sql`r."createdAt"`)} AS d, count(*)::int AS n FROM "ServiceRequest" r JOIN "Service" s ON s.id = r."serviceId"
      WHERE r."createdAt" >= ${p.from} AND r."createdAt" < ${p.to} ${requestWhere(f)} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT r.status::text AS status, count(*)::int AS n FROM "ServiceRequest" r JOIN "Service" s ON s.id = r."serviceId"
      WHERE r."createdAt" >= ${p.from} AND r."createdAt" < ${p.to} ${requestWhere(f)} GROUP BY 1`,
  ])
  const stages = (x: Record<string, unknown>) => funnel([
    { key: 'requests', label: 'Solicitudes', count: n(x.requests) },
    { key: 'proposal', label: 'Con al menos una propuesta', count: n(x.with_proposal) },
    { key: 'booked', label: 'Reservadas', count: n(x.booked) },
    { key: 'completed', label: 'Completadas', count: n(x.completed) },
    { key: 'paid', label: 'Pagadas', count: n(x.paid) },
  ])
  const hours = (Array.isArray(cur.hours) ? cur.hours : []).map(Number).filter((h) => Number.isFinite(h) && h >= 0)
  const prevHours = (Array.isArray(prev.hours) ? prev.hours : []).map(Number).filter((h) => Number.isFinite(h) && h >= 0)
  const days = periodDays(p)
  return {
    stages: stages(cur),
    previous: stages(prev),
    searches: { total: n(searches[0]?.total), people: n(searches[0]?.people), change: change(n(searches[0]?.total), n(prevSearches[0]?.total)) },
    directBookings: n(direct[0]?.n),
    firstProposalHours: { median: percentile(hours, 0.5), p75: percentile(hours, 0.75), prevMedian: percentile(prevHours, 0.5), sample: hours.length },
    requestStatus: cancels.map((c) => ({ status: String(c.status), n: n(c.n) })),
    daily: days.map((d) => ({ d, n: n(daily.find((x) => x.d === d)?.n) })),
  }
}

// ─── Oferta y demanda ───────────────────────────────────────────────────────

export async function supplyTab(p: Period, f: Filters) {
  const partnerCity = f.city ? Prisma.sql`AND ps.city::text = ${f.city}` : Prisma.empty
  const [services, cities, zero] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      WITH demand AS (
        SELECT r."serviceId" AS sid, count(*)::int AS requests,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Proposal" pr WHERE pr."serviceRequestId" = r.id))::int AS answered,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY (SELECT extract(epoch FROM min(pr."createdAt") - r."createdAt") / 3600 FROM "Proposal" pr WHERE pr."serviceRequestId" = r.id)) AS median_hours
        FROM "ServiceRequest" r JOIN "Service" s ON s.id = r."serviceId"
        WHERE r."createdAt" >= ${p.from} AND r."createdAt" < ${p.to} ${requestWhere(f)} GROUP BY 1
      ),
      supply AS (
        SELECT ps."serviceId" AS sid, count(DISTINCT ps."partnerId")::int AS partners
        FROM "PartnerService" ps JOIN "PartnerProfile" pp ON pp.id = ps."partnerId"
        WHERE ps.active AND pp.verified AND pp."isActive" ${partnerCity} GROUP BY 1
      )
      SELECT s.name, c.name AS category, coalesce(d.requests, 0) AS requests, coalesce(d.answered, 0) AS answered, d.median_hours, coalesce(sp.partners, 0) AS partners
      FROM "Service" s JOIN "Category" c ON c.id = s."categoryId"
      LEFT JOIN demand d ON d.sid = s.id LEFT JOIN supply sp ON sp.sid = s.id
      WHERE (d.requests > 0 OR sp.partners > 0) ${f.categoryId ? Prisma.sql`AND s."categoryId" = ${f.categoryId}` : Prisma.empty}
      ORDER BY coalesce(d.requests, 0) DESC, coalesce(sp.partners, 0) ASC LIMIT 40`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT x.city, sum(x.requests)::int AS requests, sum(x.partners)::int AS partners FROM (
        SELECT r.city::text AS city, count(*) AS requests, 0 AS partners FROM "ServiceRequest" r JOIN "Service" s ON s.id = r."serviceId"
        WHERE r."createdAt" >= ${p.from} AND r."createdAt" < ${p.to} ${f.categoryId ? Prisma.sql`AND s."categoryId" = ${f.categoryId}` : Prisma.empty} GROUP BY 1
        UNION ALL
        SELECT pp.city::text, 0, count(*) FROM "PartnerProfile" pp WHERE pp.verified AND pp."isActive" GROUP BY 1
      ) x GROUP BY 1 ORDER BY requests DESC`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT normalized AS q, count(*)::int AS n, count(DISTINCT coalesce("userId", "visitorId"))::int AS people
      FROM "SearchEvent" WHERE "resultCount" = 0 AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to}
      GROUP BY 1 ORDER BY n DESC LIMIT 15`,
  ])
  const rows = services.map((s) => {
    const requests = n(s.requests)
    const partners = n(s.partners)
    return {
      name: String(s.name), category: String(s.category), requests, answeredRate: ratio(n(s.answered), requests), medianHours: s.median_hours == null ? null : n(s.median_hours), partners,
      // Demand per available partner: where one more partner would matter most
      pressure: partners ? Math.round((requests / partners) * 10) / 10 : requests ? null : 0,
    }
  })
  return {
    services: rows,
    gaps: rows.filter((r) => r.requests > 0 && (r.partners === 0 || (r.answeredRate ?? 0) < 50)).slice(0, 10),
    cities: cities.map((c) => ({ city: String(c.city), requests: n(c.requests), partners: n(c.partners) })),
    zeroResults: zero.map((z) => ({ q: String(z.q), n: n(z.n), people: n(z.people) })),
  }
}

// ─── Clientes y socios ──────────────────────────────────────────────────────

export async function peopleTab(p: Period, f: Filters) {
  const months = lastMonths(p.to, 12)
  const since = new Date(`${months[0]}-01T00:00:00-05:00`)
  const cohortSince = new Date(`${months[6]}-01T00:00:00-05:00`)
  const cityUser = f.city ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Booking" bb WHERE bb."userId" = u.id AND bb.city::text = ${f.city})` : Prisma.empty
  const [signups, clientCohorts, partnerCohorts, sources, active] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${monthOf(Prisma.sql`u."createdAt"`)} AS m, count(*) FILTER (WHERE u.role = 'CLIENT')::int AS clients, count(*) FILTER (WHERE u.role = 'PARTNER')::int AS partners
      FROM "User" u WHERE u."createdAt" >= ${since} GROUP BY 1`,
    // Clients: booked within 30 days of signing up, and came back (2+ bookings)
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${monthOf(Prisma.sql`u."createdAt"`)} AS m, count(*)::int AS users,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Booking" b WHERE b."userId" = u.id AND b."createdAt" < u."createdAt" + interval '30 days'))::int AS activated,
             count(*) FILTER (WHERE (SELECT count(*) FROM "Booking" b WHERE b."userId" = u.id AND b.status <> 'CANCELLED') >= 2)::int AS repeat
      FROM "User" u WHERE u.role = 'CLIENT' AND u."createdAt" >= ${cohortSince} ${cityUser} GROUP BY 1 ORDER BY 1`,
    // Partners: verified, and did at least one job (bookings where they are the partner)
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${monthOf(Prisma.sql`u."createdAt"`)} AS m, count(*)::int AS users,
             count(*) FILTER (WHERE pp.verified)::int AS verified,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Booking" b WHERE b."partnerId" = pp.id AND b.status = 'COMPLETED'))::int AS worked
      FROM "User" u JOIN "PartnerProfile" pp ON pp."userId" = u.id
      WHERE u.role = 'PARTNER' AND u."createdAt" >= ${cohortSince} ${f.city ? Prisma.sql`AND pp.city::text = ${f.city}` : Prisma.empty} GROUP BY 1 ORDER BY 1`,
    // Where new accounts of the period came from, and how many of them booked
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT coalesce(u.acquisition->>'source', 'unknown') AS source, coalesce(u.acquisition->>'campaign', '') AS campaign, u.role::text AS role, count(*)::int AS users,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Booking" b WHERE b."userId" = u.id))::int AS booked
      FROM "User" u WHERE u.role IN ('CLIENT', 'PARTNER') AND u."createdAt" >= ${p.from} AND u."createdAt" < ${p.to}
      GROUP BY 1, 2, 3 ORDER BY users DESC LIMIT 40`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(DISTINCT b."userId")::int AS clients,
             count(DISTINCT b."userId") FILTER (WHERE EXISTS (SELECT 1 FROM "Booking" o WHERE o."userId" = b."userId" AND o."createdAt" < ${p.from}))::int AS returning
      FROM "Booking" b JOIN "Service" s ON s.id = b."serviceId" WHERE b."createdAt" >= ${p.from} AND b."createdAt" < ${p.to} ${bookingWhere(f)}`,
  ])
  const bySource = new Map<string, { source: string; clients: number; partners: number; booked: number; campaigns: Set<string> }>()
  for (const r of sources) {
    const label = String(r.source) === 'unknown' ? 'Sin dato (antes del seguimiento)' : sourceLabel(String(r.source))
    const g = bySource.get(label) ?? { source: label, clients: 0, partners: 0, booked: 0, campaigns: new Set<string>() }
    if (r.role === 'PARTNER') g.partners += n(r.users)
    else g.clients += n(r.users)
    g.booked += n(r.booked)
    if (r.campaign) g.campaigns.add(String(r.campaign))
    bySource.set(label, g)
  }
  return {
    signups: months.map((m) => ({ month: m, clients: n(signups.find((x) => x.m === m)?.clients), partners: n(signups.find((x) => x.m === m)?.partners) })),
    clientCohorts: clientCohorts.map((c) => ({ month: String(c.m), users: n(c.users), activatedRate: ratio(n(c.activated), n(c.users)), repeatRate: ratio(n(c.repeat), n(c.users)) })),
    partnerCohorts: partnerCohorts.map((c) => ({ month: String(c.m), users: n(c.users), verifiedRate: ratio(n(c.verified), n(c.users)), workedRate: ratio(n(c.worked), n(c.users)) })),
    sources: Array.from(bySource.values()).map((s) => ({ ...s, campaigns: Array.from(s.campaigns).slice(0, 5), conversion: ratio(s.booked, s.clients + s.partners) })).sort((a, b) => b.clients + b.partners - (a.clients + a.partners)),
    activeClients: n(active[0]?.clients),
    returningClients: n(active[0]?.returning),
  }
}

// ─── Atención (bandeja) ─────────────────────────────────────────────────────

export async function serviceTab(p: Period) {
  const [byChannel, response, daily, prevCount] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c.channel::text AS channel, count(*)::int AS conversations,
             count(*) FILTER (WHERE c."aiHandled" AND c."aiHandoffAt" IS NULL)::int AS ai_only,
             count(*) FILTER (WHERE c."aiHandoffAt" IS NOT NULL)::int AS handoffs
      FROM "Conversation" c WHERE c."isTest" = false AND c."aiSpam" = false AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}
      GROUP BY 1 ORDER BY 2 DESC`,
    // First reply after the first message received: minutes, and whether the AI or a person answered
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      WITH firsts AS (
        SELECT c.id,
          (SELECT min(m."sentAt") FROM "ConversationMessage" m WHERE m."conversationId" = c.id AND m.direction = 'INBOUND' AND m."isInternal" = false) AS first_in
        FROM "Conversation" c WHERE c."isTest" = false AND c."aiSpam" = false AND c."createdAt" >= ${p.from} AND c."createdAt" < ${p.to}
      )
      SELECT extract(epoch FROM o."sentAt" - f.first_in) / 60 AS minutes, (o."aiAgentId" IS NOT NULL) AS ai
      FROM firsts f
      JOIN LATERAL (
        SELECT m."sentAt", m."aiAgentId" FROM "ConversationMessage" m
        WHERE m."conversationId" = f.id AND m.direction = 'OUTBOUND' AND m."isInternal" = false AND m."sentAt" >= f.first_in
        ORDER BY m."sentAt" LIMIT 1
      ) o ON true
      WHERE f.first_in IS NOT NULL
      LIMIT 5000`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${dayOf(Prisma.sql`m."sentAt"`)} AS d,
             count(*) FILTER (WHERE m.direction = 'INBOUND')::int AS inbound,
             count(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m."aiAgentId" IS NOT NULL)::int AS ai,
             count(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m."aiAgentId" IS NULL)::int AS human
      FROM "ConversationMessage" m JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."isTest" = false AND m."isInternal" = false AND m."sentAt" >= ${p.from} AND m."sentAt" < ${p.to} GROUP BY 1`,
    prisma.conversation.count({ where: { isTest: false, aiSpam: false, createdAt: { gte: p.prevFrom, lt: p.prevTo } } }),
  ])
  const total = byChannel.reduce((a, c) => a + n(c.conversations), 0)
  const aiOnly = byChannel.reduce((a, c) => a + n(c.ai_only), 0)
  const handoffs = byChannel.reduce((a, c) => a + n(c.handoffs), 0)
  const mins = response.map((r) => n(r.minutes)).filter((m) => m >= 0)
  const aiMins = response.filter((r) => r.ai).map((r) => n(r.minutes))
  const humanMins = response.filter((r) => !r.ai).map((r) => n(r.minutes))
  const days = periodDays(p)
  return {
    kpis: {
      conversations: { value: total, change: change(total, prevCount) },
      aiResolved: ratio(aiOnly, total),
      handoffs,
      firstResponse: { median: percentile(mins, 0.5), p90: percentile(mins, 0.9), ai: percentile(aiMins, 0.5), human: percentile(humanMins, 0.5), answered: mins.length },
    },
    byChannel: byChannel.map((c) => ({ channel: String(c.channel), conversations: n(c.conversations), aiResolved: ratio(n(c.ai_only), n(c.conversations)), handoffs: n(c.handoffs) })),
    daily: days.map((d) => {
      const r = daily.find((x) => x.d === d)
      return { d, inbound: n(r?.inbound), ai: n(r?.ai), human: n(r?.human) }
    }),
  }
}

// ─── Búsquedas ──────────────────────────────────────────────────────────────

export async function searchTab(p: Period) {
  const [tot, prev, top, byRole, byHour, daily, bySource] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(*)::int AS total, count(DISTINCT coalesce("userId", "visitorId"))::int AS people, count(*) FILTER (WHERE "resultCount" = 0)::int AS zero, count(DISTINCT normalized)::int AS terms
      FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT count(*)::int AS total, count(*) FILTER (WHERE "resultCount" = 0)::int AS zero FROM "SearchEvent" WHERE "createdAt" >= ${p.prevFrom} AND "createdAt" < ${p.prevTo}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT normalized AS q, count(*)::int AS n, count(DISTINCT coalesce("userId", "visitorId"))::int AS people, round(avg("resultCount"))::int AS results, count(*) FILTER (WHERE "resultCount" = 0)::int AS zero
      FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1 ORDER BY n DESC LIMIT 40`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT coalesce(role, 'VISITOR') AS role, count(*)::int AS n FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT extract(hour FROM "createdAt" - interval '5 hours')::int AS h, count(*)::int AS n FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${dayOf(Prisma.sql`"createdAt"`)} AS d, count(*)::int AS n, count(*) FILTER (WHERE "resultCount" = 0)::int AS zero FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT source, count(*)::int AS n FROM "SearchEvent" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`,
  ])
  const t = tot[0] ?? {}
  const pv = prev[0] ?? {}
  const days = periodDays(p)
  const since = await prisma.searchEvent.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
  return {
    trackingSince: since?.createdAt ?? null,
    kpis: {
      total: { value: n(t.total), change: change(n(t.total), n(pv.total)) },
      people: n(t.people),
      terms: n(t.terms),
      zeroRate: { value: ratio(n(t.zero), n(t.total)), previous: ratio(n(pv.zero), n(pv.total)) },
    },
    top: top.map((x) => ({ q: String(x.q), n: n(x.n), people: n(x.people), results: n(x.results), zeroRate: ratio(n(x.zero), n(x.n)) })),
    byRole: byRole.map((r) => ({ role: String(r.role), n: n(r.n) })),
    byHour: Array.from({ length: 24 }, (_, h) => ({ h, n: n(byHour.find((x) => n(x.h) === h)?.n) })),
    bySource: bySource.map((s) => ({ source: String(s.source), n: n(s.n) })),
    daily: days.map((d) => ({ d, n: n(daily.find((x) => x.d === d)?.n), zero: n(daily.find((x) => x.d === d)?.zero) })),
  }
}

export async function filterOptions() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { order: 'asc' } })
  return { categories, cities: CITIES }
}
