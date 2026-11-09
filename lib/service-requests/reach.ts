import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification, requestWhenText, sendRequestNoticeToPartner } from '@/lib/notifications/notificationService'
import { zoneName } from '@/lib/geo/zones'
import { pickReachBatch, widenedRequestId, type ReachCandidate, type ReachScope } from '@/lib/service-requests/reach-core'

/**
 * A request with no proposal 60 min after it was created reaches the partners of the bordering zones (and
 * those of its zone left out by their schedule); at 3 h, the whole city. Who was told is read from the
 * partners' notifications, so nobody hears twice about the same request in a wave, a crashed run picks up
 * where it stopped, and a partner gets at most PARTNER_WIDEN_DAILY_CAP of these notices a day. The team is
 * alerted (D7 by WhatsApp, once; in-app on each wave).
 */

const logger = createLogger('request-reach')
const MIN = 60_000
const H = 60 * MIN
const DAY = 24 * H

export const REQUEST_WIDEN_ACTION = 'REQUEST_WIDEN'
export const WIDEN_WAVES: Array<{ wave: number; afterMs: number; scope: ReachScope; limit: number }> = [
  { wave: 1, afterMs: 60 * MIN, scope: 'nearby', limit: 10 },
  { wave: 2, afterMs: 3 * H, scope: 'city', limit: 20 },
]
export const PARTNER_WIDEN_DAILY_CAP = 6
/** Requests older than this are not widened any more (reopened or reactivated ones keep their own rounds) */
const WIDEN_MAX_AGE_MS = 7 * DAY
/** Visible in «Oportunidades» for this long after the widened notice */
export const WIDENED_VISIBLE_MS = 8 * DAY
const QUOTED_WINDOW_MS = 30 * DAY

/** Requests this partner user was told about outside their zones (they can see and answer them). */
export async function widenedRequestIdsFor(userId: string, now: Date = new Date()): Promise<string[]> {
  const rows = await prisma.notification.findMany({
    where: { userId, type: 'NEW_SERVICE_REQUEST', createdAt: { gte: new Date(now.getTime() - WIDENED_VISIBLE_MS) }, data: { contains: '"reach":"' } },
    select: { data: true },
    take: 200,
  })
  return Array.from(new Set(rows.map((r) => widenedRequestId(r.data)).filter((id): id is string => Boolean(id))))
}

/**
 * Tells up to `limit` more partners about an open, unanswered request: verified, active and available ones
 * who offer the service in its city, never proposed nor were told about it, ranked by ring and by what they
 * quoted lately. Stops at `deadline` (the rest go in the next run). Returns how many were told.
 */
export async function notifyMorePartners(requestId: string, opts: { scope: ReachScope; limit: number; round: number; deadline?: number }, now: Date = new Date()) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, serviceId: true, address: true, city: true, zone: true, isUrgent: true, preferredDate: true, preferredTime: true, status: true, expiresAt: true, partnerId: true,
      service: { select: { name: true, categoryId: true } }, user: { select: { name: true } },
      proposals: { select: { partnerId: true } },
    },
  })
  if (!sr || sr.status !== 'ACTIVE' || sr.partnerId || sr.expiresAt.getTime() <= now.getTime()) return { notified: 0, pending: 0 }

  const offers = await prisma.partnerService.findMany({
    where: { serviceId: sr.serviceId, city: sr.city, active: true, partner: { isActive: true, verified: true, isAvailable: true, user: { isActive: true } } },
    select: { partner: { select: { id: true, userId: true, coverageZones: true, rating: true, completedServicesCount: true, user: { select: { name: true } } } } },
  })
  const proposed = new Set(sr.proposals.map((p) => p.partnerId))
  const partners = Array.from(new Map(offers.map((o) => [o.partner.id, o.partner])).values()).filter((p) => !proposed.has(p.id))
  if (!partners.length) return { notified: 0, pending: 0 }
  const userIds = partners.map((p) => p.userId)

  const [told, recent, quotes] = await Promise.all([
    prisma.notification.findMany({ where: { userId: { in: userIds }, type: 'NEW_SERVICE_REQUEST', data: { contains: sr.id } }, select: { userId: true } }),
    prisma.notification.findMany({ where: { userId: { in: userIds }, type: 'NEW_SERVICE_REQUEST', createdAt: { gte: new Date(now.getTime() - DAY) }, data: { contains: '"reach":"' } }, select: { userId: true } }),
    prisma.proposal.findMany({
      where: { partnerId: { in: partners.map((p) => p.id) }, createdAt: { gte: new Date(now.getTime() - QUOTED_WINDOW_MS) } },
      select: { partnerId: true, serviceRequest: { select: { serviceId: true, service: { select: { categoryId: true } } } } },
      take: 2000,
    }),
  ])
  const toldIds = new Set(told.map((n) => n.userId))
  const todayCount = new Map<string, number>()
  for (const n of recent) todayCount.set(n.userId, (todayCount.get(n.userId) ?? 0) + 1)
  const quoted = new Map<string, { service: number; category: number }>()
  for (const q of quotes) {
    const c = quoted.get(q.partnerId) ?? { service: 0, category: 0 }
    if (q.serviceRequest.serviceId === sr.serviceId) c.service++
    else if (q.serviceRequest.service.categoryId === sr.service.categoryId) c.category++
    quoted.set(q.partnerId, c)
  }

  const candidates: ReachCandidate[] = partners
    .filter((p) => !toldIds.has(p.userId) && (todayCount.get(p.userId) ?? 0) < PARTNER_WIDEN_DAILY_CAP)
    .map((p) => ({
      partnerId: p.id, userId: p.userId, name: p.user.name ?? 'Socio', coverageZones: p.coverageZones ?? [],
      rating: p.rating, completed: p.completedServicesCount, quotedService: quoted.get(p.id)?.service ?? 0, quotedCategory: quoted.get(p.id)?.category ?? 0,
    }))
  const batch = pickReachBatch(candidates, { zone: sr.zone, scope: opts.scope, limit: opts.limit })
  const when = await requestWhenText(sr)
  let notified = 0
  for (const c of batch) {
    if (opts.deadline && Date.now() > opts.deadline) break
    try {
      await sendRequestNoticeToPartner(sr, { id: c.userId, name: c.name }, { direct: false, round: opts.round, when, reach: opts.scope })
      notified++
    } catch (err) {
      logger.warn('Widened notice failed', { requestId, partnerUserId: c.userId, err: err instanceof Error ? err.message : err })
    }
  }
  return { notified, pending: batch.length - notified }
}

async function alertAdmins(r: { id: string; address: string; city: string; zone: string | null; createdAt: Date; service: { name: string } }, wave: number, notified: number, now: Date) {
  const hours = Math.max(1, Math.floor((now.getTime() - r.createdAt.getTime()) / H))
  const { WA } = await import('@/lib/messaging/wa-specs')
  const { sendWaToAdmins } = await import('@/lib/messaging/wa-send')
  await sendWaToAdmins((a) => WA.D7({ adminName: a.name, requestId: r.id, service: r.service.name, address: r.address, city: r.city, hours }), {}, now).catch(() => null)
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 20 })
  const where = zoneName(r.zone) ?? String(r.city).replace(/_/g, ' ').toLowerCase()
  for (const a of admins) {
    await createNotification({
      userId: a.id,
      type: 'NEW_SERVICE_REQUEST',
      title: 'Solicitud sin propuestas',
      message: `${r.service.name} en ${where}: ${hours} h sin propuestas. ${notified > 0 ? `Avisamos a ${notified} socio${notified === 1 ? '' : 's'} más${wave === 1 ? ' de zonas cercanas' : ' de toda la ciudad'}.` : 'No hay más socios a quién avisar: revisa la oferta de este servicio.'}`,
      data: { serviceRequestId: r.id, kind: 'REQUEST_NO_PROPOSALS', wave, url: `/admin/service-requests/${r.id}` },
      channels: ['PUSH'],
    }).catch(() => null)
  }
}

/** Every 15 min (request-lifecycle): the next due wave of each unanswered request, within a time budget. */
export async function widenUnansweredRequests(now: Date = new Date(), opts: { budgetMs?: number; limit?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 25_000)
  const first = WIDEN_WAVES[0]
  const rows = await prisma.serviceRequest.findMany({
    where: {
      status: 'ACTIVE', partnerId: null, expiresAt: { gt: now }, proposals: { none: {} },
      createdAt: { lte: new Date(now.getTime() - first.afterMs), gte: new Date(now.getTime() - WIDEN_MAX_AGE_MS) },
    },
    select: { id: true, address: true, city: true, zone: true, createdAt: true, service: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 30,
  })
  if (!rows.length) return { widened: 0, partnersWidened: 0 }
  const marks = await prisma.adminAuditLog.findMany({
    where: { action: REQUEST_WIDEN_ACTION, entityType: 'ServiceRequest', entityId: { in: rows.map((r) => r.id) } },
    select: { entityId: true, details: true },
  })
  const done = new Map<string, Set<number>>()
  for (const m of marks) {
    const wave = Number((() => { try { return (JSON.parse(m.details ?? '{}') as { wave?: unknown }).wave } catch { return 0 } })())
    if (!m.entityId || !wave) continue
    if (!done.has(m.entityId)) done.set(m.entityId, new Set())
    done.get(m.entityId)!.add(wave)
  }

  let widened = 0
  let partnersWidened = 0
  for (const r of rows) {
    if (Date.now() > deadline) break
    const age = now.getTime() - r.createdAt.getTime()
    const w = WIDEN_WAVES.find((x) => age >= x.afterMs && !done.get(r.id)?.has(x.wave))
    if (!w) continue
    const res = await notifyMorePartners(r.id, { scope: w.scope, limit: w.limit, round: 50 + w.wave, deadline }, now).catch((err) => {
      logger.warn('Widening failed', { requestId: r.id, err: err instanceof Error ? err.message : err })
      return null
    })
    // Out of time mid-wave: no mark, the next run tells the ones left (those told are skipped)
    if (!res || res.pending > 0) continue
    await prisma.adminAuditLog.create({
      data: { action: REQUEST_WIDEN_ACTION, entityType: 'ServiceRequest', entityId: r.id, actorEmail: 'sistema', details: JSON.stringify({ wave: w.wave, scope: w.scope, partners: res.notified }) },
    })
    await alertAdmins(r, w.wave, res.notified, now)
    widened++
    partnersWidened += res.notified
  }
  return { widened, partnersWidened }
}
