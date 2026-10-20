/**
 * «Volver a avisar» with a choice: every partner who offers the request's service in its city, whether
 * they can see it in «Oportunidades» (verified, active, covering the zone, not proposed yet), how they fit
 * (availability, schedule) and how many times they were told; the team picks some, several or all.
 */
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { OpsError } from '@/lib/ops/origin'
import { matchesRequest } from '@/lib/partners/coverage-core'
import { coversZone } from '@/lib/geo/zones'
import { requestWhenText, sendRequestNoticeToPartner } from '@/lib/notifications/notificationService'
import type { AdminActor } from '@/lib/admin/interventions'

/** The same partner is not told twice within this window (double clicks, two admins) */
export const RENOTIFY_COOLDOWN_MS = 15 * 60_000
/** At most this many partners per send */
export const RENOTIFY_BATCH_MAX = 60

export type PartnerCandidate = {
  partnerId: string
  userId: string
  name: string
  phone: string | null
  rating: number
  totalReviews: number
  completedServices: number
  available: boolean
  zoneOk: boolean
  scheduleOk: boolean
  /** Can be told: will see it in «Oportunidades» and can propose */
  selectable: boolean
  /** Why not, in a person's words */
  blocked: string | null
  proposed: boolean
  timesNotified: number
  lastNotifiedAt: string | null
}

async function loadRequest(requestId: string) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, status: true, expiresAt: true, serviceId: true, city: true, zone: true, address: true, isUrgent: true, preferredDate: true, preferredTime: true, partnerId: true,
      service: { select: { name: true } }, user: { select: { name: true } },
      proposals: { select: { partnerId: true } },
    },
  })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  return sr
}

/** Every partner who could be told about this request, with why some cannot */
export async function requestPartnerCandidates(requestId: string): Promise<{ direct: boolean; open: boolean; candidates: PartnerCandidate[] }> {
  const sr = await loadRequest(requestId)
  const open = sr.status === 'ACTIVE' && (!sr.expiresAt || sr.expiresAt.getTime() > Date.now())
  const proposed = new Set(sr.proposals.map((p) => p.partnerId))
  const offers = await prisma.partnerService.findMany({
    where: { serviceId: sr.serviceId, city: sr.city, active: true, ...(sr.partnerId ? { partnerId: sr.partnerId } : {}), partner: { isActive: true } },
    select: {
      partner: {
        select: {
          id: true, userId: true, verified: true, isAvailable: true, rating: true, totalReviews: true, completedServicesCount: true, coverageZones: true,
          user: { select: { name: true, phone: true, isActive: true } },
          availability: { where: { active: true, partnerServiceId: null }, select: { dayOfWeek: true, startTime: true, endTime: true } },
        },
      },
    },
  })
  const unique = new Map(offers.map((o) => [o.partner.id, o.partner]))
  const userIds = Array.from(unique.values()).map((p) => p.userId)
  const notices = userIds.length
    ? await prisma.notification.findMany({
        where: { userId: { in: userIds }, type: 'NEW_SERVICE_REQUEST', data: { contains: requestId } },
        select: { userId: true, createdAt: true },
      })
    : []
  const told = new Map<string, { n: number; last: Date }>()
  for (const n of notices) {
    const t = told.get(n.userId)
    told.set(n.userId, { n: (t?.n ?? 0) + 1, last: !t || n.createdAt > t.last ? n.createdAt : t.last })
  }

  const candidates = Array.from(unique.values()).filter((p) => p.user.isActive).map((p): PartnerCandidate => {
    const zoneOk = Boolean(sr.partnerId) || coversZone(p.coverageZones, sr.zone)
    const scheduleOk = matchesRequest({ coverageZones: p.coverageZones, schedule: p.availability }, { zone: sr.zone, preferredDate: sr.preferredDate, preferredTime: sr.preferredTime, isUrgent: sr.isUrgent })
    const isProposed = proposed.has(p.id)
    const blocked = isProposed ? 'Ya envió propuesta' : !p.verified ? 'Sin verificar: no ve solicitudes' : !zoneOk ? 'No cubre la zona: no la vería' : null
    const t = told.get(p.userId)
    return {
      partnerId: p.id, userId: p.userId, name: p.user.name ?? 'Socio', phone: p.user.phone,
      rating: p.rating, totalReviews: p.totalReviews, completedServices: p.completedServicesCount,
      available: p.isAvailable, zoneOk, scheduleOk, selectable: !blocked, blocked, proposed: isProposed,
      timesNotified: t?.n ?? 0, lastNotifiedAt: t?.last.toISOString() ?? null,
    }
  })
  // Best fits first: can be told, available, fits the schedule, never told, best rated
  const rank = (c: PartnerCandidate) => (c.selectable ? 0 : 100) + (c.available ? 0 : 10) + (c.scheduleOk ? 0 : 5) + (c.timesNotified ? 1 : 0)
  candidates.sort((a, b) => rank(a) - rank(b) || b.rating - a.rating || b.completedServices - a.completedServices || a.name.localeCompare(b.name))
  return { direct: Boolean(sr.partnerId), open, candidates }
}

/** Tells the chosen partners about the request again (only those who can see it; none told in the last 15 minutes) */
export async function notifySelectedPartners(admin: AdminActor, requestId: string, partnerIds: string[]) {
  const ids = Array.from(new Set(partnerIds)).slice(0, RENOTIFY_BATCH_MAX)
  if (!ids.length) throw new OpsError('Elige al menos un socio', 400)
  const sr = await loadRequest(requestId)
  if (sr.status !== 'ACTIVE' || (sr.expiresAt && sr.expiresAt.getTime() <= Date.now())) throw new OpsError('Solo se avisa en solicitudes activas: reactívala primero', 400)
  const { candidates } = await requestPartnerCandidates(requestId)
  const byId = new Map(candidates.map((c) => [c.partnerId, c]))
  const when = await requestWhenText(sr)
  // A new round per send (per minute): the WhatsApp template is not taken for a duplicate of an earlier notice
  const round = Math.floor(Date.now() / 60_000)
  const sent: string[] = []
  const skipped: Array<{ name: string; reason: string }> = []
  for (const id of ids) {
    const c = byId.get(id)
    if (!c) { skipped.push({ name: id, reason: 'No ofrece este servicio en la ciudad' }); continue }
    if (!c.selectable) { skipped.push({ name: c.name, reason: c.blocked ?? 'No puede verla' }); continue }
    if (c.lastNotifiedAt && Date.now() - new Date(c.lastNotifiedAt).getTime() < RENOTIFY_COOLDOWN_MS) { skipped.push({ name: c.name, reason: 'Ya se le avisó hace menos de 15 minutos' }); continue }
    await sendRequestNoticeToPartner(sr, { id: c.userId, name: c.name }, { direct: Boolean(sr.partnerId), round, when })
    sent.push(c.name)
  }
  await auditAdminAction({
    actorId: admin.userId, actorEmail: admin.email ?? 'admin', action: 'ADMIN_REQUEST_RENOTIFY_SELECTED', entityType: 'ServiceRequest', entityId: requestId,
    route: `/admin/service-requests/${requestId}`, details: JSON.stringify({ requestId, sent: sent.length, skipped: skipped.length, partners: ids }).slice(0, 2000),
  }).catch(() => null)
  return { sent: sent.length, skipped }
}
