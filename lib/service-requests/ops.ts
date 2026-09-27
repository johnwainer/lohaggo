import { City, type Prisma } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { serviceRequestSchema } from '@/lib/validation/schemas'
import { sanitizeObject } from '@/lib/validation/sanitize'
import { notifyNewServiceRequest, notifyProposalRejected } from '@/lib/notifications/notificationService'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { DEFAULT_COMMISSION, loadEffectiveRates, loadPlatformConfigRow } from '@/lib/payments/commission'
import { compactTouch } from '@/lib/analytics/attribution-core'
import { conversationAttribution, type RequestAttribution } from '@/lib/analytics/touches'
import { runAfterResponse } from '@/lib/ops/after'

/**
 * Service-request operations shared by the app routes and the inbox AI agents. They load, validate state
 * and throw OpsError in Spanish; they do not check the session nor write the audit log (the caller does).
 */

const logger = createLogger('service-requests-ops')

export type ServiceRequestInput = z.input<typeof serviceRequestSchema>

/** Stored defaults when there is no PlatformConfig row; what applies is `effectiveRates` (0/0 while commission is off). */
export const DEFAULT_RATES = DEFAULT_COMMISSION

export const clientRequestInclude = {
  service: { include: { category: true } },
  proposals: {
    include: {
      partner: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
          documents: { where: { status: 'APPROVED' as const }, select: { type: true, status: true } },
        },
      },
    },
  },
  photos: true,
} satisfies Prisma.ServiceRequestInclude

const createdRequestInclude = {
  service: { include: { category: true } },
  user: { select: { name: true, email: true, phone: true } },
  photos: true,
} satisfies Prisma.ServiceRequestInclude

/** PlatformConfig without creating it: the row named 'default', else the first one, else null. */
export const loadPlatformConfig = loadPlatformConfigRow

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

/** A 'YYYY-MM-DD' day plus an optional 'HH:mm' time read as Bogotá wall-clock (-05:00), whatever the server's zone. */
export function preferredDateTimeBogota(date?: string | null, time?: string | null): Date | null {
  if (!date) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time || '')
  const hh = m ? String(Math.min(23, Number(m[1]))).padStart(2, '0') : '00'
  const mm = m ? m[2] : '00'
  const d = new Date(`${date}T${hh}:${mm}:00-05:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export type CreateRequestOptions = {
  /** First / last touch from the browser (web); a chat request reads its conversation's */
  attribution?: RequestAttribution | null
  /** The page fires the pixel's Lead with the same event id */
  browserSent?: boolean
  /** false for requests that are not a new lead (a guarantee's replacement) */
  conversion?: boolean
}

export async function createServiceRequest(actor: Actor, input: ServiceRequestInput, origin: Origin, opts: CreateRequestOptions = {}) {
  const parsed = serviceRequestSchema.safeParse(input)
  if (!parsed.success) throw new OpsError(parsed.error.errors[0]?.message || 'Datos inválidos', 400)
  const data = sanitizeObject(parsed.data)

  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { isActive: true } })
  if (!user?.isActive) throw new OpsError('Tu cuenta está inactiva. Contacta al administrador.', 403)

  let partnerPrice: number | null = null
  if (data.partnerId) {
    const partner = await prisma.partnerProfile.findUnique({
      where: { id: data.partnerId },
      select: { id: true, verified: true, isActive: true, services: { where: { serviceId: data.serviceId, active: true }, select: { price: true } } },
    })
    if (!partner || !partner.verified || !partner.isActive || partner.services.length === 0) throw new OpsError('Ese socio no ofrece este servicio', 400)
    partnerPrice = partner.services[0].price
  }

  if (data.budget) {
    if (data.partnerId) {
      if (partnerPrice !== null && data.budget < partnerPrice) throw new OpsError(`El presupuesto debe ser al menos ${money(partnerPrice)} para este servicio del socio`, 400)
    } else {
      const service = await prisma.service.findUnique({ where: { id: data.serviceId }, select: { basePrice: true } })
      if (service && data.budget < service.basePrice) throw new OpsError(`El presupuesto debe ser al menos ${money(service.basePrice)} para este servicio`, 400)
    }
    const config = await loadPlatformConfig()
    if (config) {
      if (data.budget < config.minServicePrice) throw new OpsError(`El presupuesto mínimo en la plataforma es ${money(config.minServicePrice)}`, 400)
      if (data.budget > config.maxServicePrice) throw new OpsError(`El presupuesto máximo en la plataforma es ${money(config.maxServicePrice)}`, 400)
    }
  }

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  const preferredDateTime = preferredDateTimeBogota(data.preferredDate, data.preferredTime)
  const attribution = opts.attribution ?? (origin.via === 'chat' ? await conversationAttribution(origin.conversationId) : null)
  const touches = {
    ...(attribution?.first ? { acquisition: compactTouch(attribution.first) as Prisma.InputJsonValue } : {}),
    ...(attribution?.last ? { lastTouch: compactTouch(attribution.last) as Prisma.InputJsonValue } : {}),
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      userId: actor.userId,
      serviceId: data.serviceId,
      partnerId: data.partnerId || null,
      address: data.address,
      notes: data.notes || null,
      budget: data.budget || null,
      city: (data.city as City) || City.MEDELLIN,
      preferredDate: preferredDateTime,
      preferredTime: data.preferredTime || null,
      isUrgent: data.isUrgent || false,
      status: 'ACTIVE',
      expiresAt,
      ...originColumns(origin),
      ...touches,
      photos: data.photoUrls && data.photoUrls.length > 0 ? { create: data.photoUrls.map((url, index) => ({ url, order: index })) } : undefined,
    },
    include: createdRequestInclude,
  })

  try {
    await notifyNewServiceRequest(serviceRequest.id, { origin })
  } catch (err) {
    logger.warn('notifyNewServiceRequest failed (non-fatal)', { serviceRequestId: serviceRequest.id, err })
  }

  if (opts.conversion !== false) {
    const id = serviceRequest.id
    runAfterResponse(async () => {
      const { sendLeadConversion } = await import('@/lib/analytics/conversions')
      await sendLeadConversion(id, { browser: attribution?.browser ?? null, browserSent: opts.browserSent })
    })
  }

  await recordPromptContext(actor.userId, 'CLIENT_REQUEST_CREATED', {
    serviceRequestId: serviceRequest.id,
    city: serviceRequest.city,
    isUrgent: serviceRequest.isUrgent,
  }).catch(() => undefined)

  return serviceRequest
}

export async function cancelServiceRequest(actor: Actor, requestId: string, origin: Origin) {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true, proposals: { select: { id: true, status: true } } },
  })
  if (!serviceRequest) throw new OpsError('Solicitud no encontrada', 404)
  if (serviceRequest.userId !== actor.userId) throw new OpsError('No autorizado', 403)
  if (serviceRequest.status !== 'ACTIVE') throw new OpsError('Solo se pueden cancelar solicitudes activas', 400)

  const pendingProposalIds = serviceRequest.proposals.filter((p) => p.status === 'PENDING').map((p) => p.id)

  await prisma.$transaction([
    prisma.serviceRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } }),
    ...(pendingProposalIds.length > 0
      ? [prisma.proposal.updateMany({ where: { id: { in: pendingProposalIds } }, data: { status: 'REJECTED' } })]
      : []),
  ])

  for (const proposalId of pendingProposalIds) {
    try {
      await notifyProposalRejected(proposalId)
    } catch (err) {
      logger.warn('Notify rejected failed (non-fatal)', { proposalId, err })
    }
  }

  const { waRequestCancelled } = await import('@/lib/messaging/wa-events')
  await waRequestCancelled(requestId, origin)

  return { id: requestId, cancelledProposals: pendingProposalIds.length }
}

/** The client's requests with their proposals, plus the effective client commission rate (0 while it is off). */
export async function listClientRequests(userId: string) {
  const [serviceRequests, rates] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { userId }, include: clientRequestInclude, orderBy: { createdAt: 'desc' } }),
    loadEffectiveRates(),
  ])
  return { serviceRequests, clientCommissionRate: rates.client }
}

/** Open requests a partner can bid on: in their cities/services or addressed directly to them, not yet answered. */
export async function listOpenRequestsForPartner(partnerId: string) {
  const partner = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
    select: { id: true, verified: true, isActive: true, services: { where: { active: true }, select: { serviceId: true, city: true } } },
  })
  if (!partner) throw new OpsError('Solo los socios pueden ver solicitudes activas', 403)
  if (!partner.verified || !partner.isActive) throw new OpsError('Debes estar verificado para ver solicitudes de servicio', 403)

  const offers = partner.services.map((s) => ({ serviceId: s.serviceId, city: s.city }))
  const open = { status: 'ACTIVE' as const, expiresAt: { gt: new Date() }, NOT: { proposals: { some: { partnerId } } } }
  return prisma.serviceRequest.findMany({
    where: {
      ...open,
      OR: [{ partnerId }, ...(offers.length > 0 ? [{ partnerId: null, OR: offers }] : [])],
    },
    include: {
      service: { include: { category: true } },
      user: { select: { name: true } },
      photos: true,
      _count: { select: { proposals: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export type PartnerForService = {
  partnerId: string
  name: string | null
  rating: number
  totalReviews: number
  price: number
  completedServicesCount: number
  isAvailable: boolean
}

/** Verified, active partners offering the service in the city, best rated first (max 20). */
export async function partnersForService(serviceId: string, city: City): Promise<PartnerForService[]> {
  const rows = await prisma.partnerService.findMany({
    where: { serviceId, city, active: true, partner: { verified: true, isActive: true } },
    select: {
      price: true,
      partner: { select: { id: true, rating: true, totalReviews: true, completedServicesCount: true, isAvailable: true, user: { select: { name: true } } } },
    },
    orderBy: { partner: { rating: 'desc' } },
    take: 20,
  })
  return rows.map((r) => ({
    partnerId: r.partner.id,
    name: r.partner.user.name,
    rating: r.partner.rating,
    totalReviews: r.partner.totalReviews,
    price: r.price,
    completedServicesCount: r.partner.completedServicesCount,
    isAvailable: r.partner.isAvailable,
  }))
}

export async function partnerAvailabilitySummary(serviceId: string, city: City) {
  const partners = await partnersForService(serviceId, city)
  const rated = partners.filter((p) => p.totalReviews > 0)
  return {
    total: partners.length,
    available: partners.filter((p) => p.isAvailable).length,
    fromPrice: partners.length ? Math.min(...partners.map((p) => p.price)) : null,
    avgRating: rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : null,
  }
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'activa', ACCEPTED: 'aceptada', EXPIRED: 'vencida', CANCELLED: 'cancelada' }

export function formatBogota(d: Date, withTime: boolean) {
  const date = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }).format(d)
  if (!withTime) return date
  const time = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date} ${time}`
}

/** One compact Spanish line about a request, for an agent to read or repeat in a chat. */
export async function requestSummaryForChat(requestId: string) {
  const r = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, address: true, status: true, isUrgent: true, preferredDate: true, preferredTime: true, expiresAt: true, budget: true,
      service: { select: { name: true } },
      _count: { select: { proposals: true } },
    },
  })
  if (!r) throw new OpsError('Solicitud no encontrada', 404)
  const when = r.isUrgent && !r.preferredDate
    ? 'urgente'
    : r.preferredDate
      ? (r.preferredTime ? `${formatBogota(r.preferredDate, false)} ${r.preferredTime}` : formatBogota(r.preferredDate, false))
      : 'sin fecha'
  const parts = [
    `Solicitud #${r.id.slice(-6)} · ${r.service.name}`,
    r.address,
    when,
    r.budget ? `presupuesto ${money(r.budget)}` : null,
    STATUS_LABEL[r.status] || r.status.toLowerCase(),
    `${r._count.proposals} propuesta${r._count.proposals === 1 ? '' : 's'}`,
  ]
  if (r.status === 'ACTIVE') {
    const hours = Math.max(0, Math.ceil((r.expiresAt.getTime() - Date.now()) / 3600_000))
    parts.push(hours > 0 ? `vence en ${hours} h` : 'vencida')
  }
  return parts.filter(Boolean).join(' · ')
}

// ── Lifecycle: resend without proposals, expiry and reactivation ─────────────────────────────────────────
// Markers live in AdminAuditLog (entityType 'ServiceRequest'), so no schema change is needed and support
// can read the history of a request.

export const REQUEST_RESEND_ACTION = 'REQUEST_RESEND'
export const REQUEST_EXPIRE_ACTION = 'REQUEST_EXPIRE'
export const REQUEST_REACTIVATE_ACTION = 'REQUEST_REACTIVATE'
export const RESEND_AFTER_MS = 2 * 3600_000
export const REACTIVATION_MS = 24 * 3600_000
export const MAX_REACTIVATIONS = 3

/** Whether a request is past its deadline: EXPIRED, or still ACTIVE with `expiresAt` in the past. */
export function isRequestExpired(r: { status: string; expiresAt: Date | string }, now: Date = new Date()) {
  if (r.status === 'EXPIRED') return true
  return r.status === 'ACTIVE' && new Date(r.expiresAt).getTime() < now.getTime()
}

/**
 * Reopens an expired request for 24 h (owner only, at most 3 times): back to ACTIVE, the proposals that
 * expiry had closed become PENDING again, and matching partners are told once more.
 */
export async function reactivateServiceRequest(actor: Actor, requestId: string, origin: Origin) {
  const now = new Date()
  const sr = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, status: true, expiresAt: true } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  if (sr.userId !== actor.userId) throw new OpsError('No autorizado', 403)
  if (!isRequestExpired(sr, now)) throw new OpsError(sr.status === 'ACTIVE' ? 'Tu solicitud sigue activa' : 'Solo se pueden reactivar solicitudes vencidas', 400)

  const done = await prisma.adminAuditLog.count({ where: { action: REQUEST_REACTIVATE_ACTION, entityType: 'ServiceRequest', entityId: requestId } })
  if (done >= MAX_REACTIVATIONS) throw new OpsError(`Ya reactivaste esta solicitud ${MAX_REACTIVATIONS} veces. Crea una nueva o escríbenos por WhatsApp.`, 400)

  const expiresAt = new Date(now.getTime() + REACTIVATION_MS)
  const updated = await prisma.serviceRequest.updateMany({
    where: { id: requestId, OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', expiresAt: { lt: now } }] },
    data: { status: 'ACTIVE', expiresAt },
  })
  if (updated.count === 0) throw new OpsError('La solicitud cambió; recarga la página', 409)

  let restored = 0
  if (sr.status === 'EXPIRED') {
    const lastExpire = await prisma.adminAuditLog.findFirst({
      where: { action: REQUEST_EXPIRE_ACTION, entityType: 'ServiceRequest', entityId: requestId },
      orderBy: { createdAt: 'desc' },
      select: { details: true },
    })
    const ids = parseProposalIds(lastExpire?.details)
    if (ids.length > 0) {
      const res = await prisma.proposal.updateMany({ where: { id: { in: ids }, serviceRequestId: requestId, status: 'REJECTED' }, data: { status: 'PENDING' } })
      restored = res.count
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.userId,
      actorEmail: actor.email ?? null,
      action: REQUEST_REACTIVATE_ACTION,
      entityType: 'ServiceRequest',
      entityId: requestId,
      details: JSON.stringify({ n: done + 1, via: origin.via, channel: origin.channel ?? null, conversationId: origin.conversationId ?? null, restoredProposals: restored, expiresAt: expiresAt.toISOString() }),
    },
  })

  try {
    await notifyNewServiceRequest(requestId, { partnersOnly: true, round: 10 + done + 1 })
  } catch (err) {
    logger.warn('notify on reactivation failed (non-fatal)', { requestId, err })
  }

  return { id: requestId, expiresAt, reactivations: done + 1, remaining: MAX_REACTIVATIONS - done - 1, restoredProposals: restored }
}

function parseProposalIds(details?: string | null): string[] {
  if (!details) return []
  try {
    const ids = (JSON.parse(details) as { proposalIds?: unknown }).proposalIds
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** ACTIVE requests with no proposal after 2 h get one more round to partners (only once per request). */
export async function resendUnansweredRequests(now: Date = new Date(), limit = 50) {
  const candidates = await prisma.serviceRequest.findMany({
    where: { status: 'ACTIVE', createdAt: { lte: new Date(now.getTime() - RESEND_AFTER_MS) }, expiresAt: { gt: now }, proposals: { none: {} } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit * 2,
  })
  if (candidates.length === 0) return { resent: 0, partnersNotified: 0 }
  const already = await prisma.adminAuditLog.findMany({
    where: { action: REQUEST_RESEND_ACTION, entityType: 'ServiceRequest', entityId: { in: candidates.map((c) => c.id) } },
    select: { entityId: true },
  })
  const skip = new Set(already.map((a) => a.entityId))
  let resent = 0
  let partnersNotified = 0
  for (const { id } of candidates.filter((c) => !skip.has(c.id)).slice(0, limit)) {
    // Mark first so a crash mid-send never produces a second round
    await prisma.adminAuditLog.create({ data: { action: REQUEST_RESEND_ACTION, entityType: 'ServiceRequest', entityId: id, actorEmail: 'sistema', details: JSON.stringify({ reason: 'sin propuestas tras 2 h' }) } })
    partnersNotified += await notifyNewServiceRequest(id, { partnersOnly: true, round: 1 }).catch(() => 0)
    // B4: the client hears that partners were told again and can adjust the request
    const { waRequestNoProposals } = await import('@/lib/messaging/wa-events')
    await waRequestNoProposals(id)
    resent++
  }
  return { resent, partnersNotified }
}

/**
 * ACTIVE requests past `expiresAt` become EXPIRED; their PENDING proposals are rejected (partners told)
 * and the client is invited to reactivate.
 */
export async function expireOverdueRequests(now: Date = new Date(), limit = 100) {
  const overdue = await prisma.serviceRequest.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    select: { id: true, userId: true, service: { select: { name: true } }, proposals: { where: { status: 'PENDING' }, select: { id: true } } },
    orderBy: { expiresAt: 'asc' },
    take: limit,
  })
  let expired = 0
  let rejectedProposals = 0
  for (const r of overdue) {
    const res = await prisma.serviceRequest.updateMany({ where: { id: r.id, status: 'ACTIVE', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } })
    if (res.count === 0) continue
    const proposalIds = r.proposals.map((p) => p.id)
    if (proposalIds.length > 0) {
      await prisma.proposal.updateMany({ where: { id: { in: proposalIds }, status: 'PENDING' }, data: { status: 'REJECTED' } })
    }
    await prisma.adminAuditLog.create({ data: { action: REQUEST_EXPIRE_ACTION, entityType: 'ServiceRequest', entityId: r.id, actorEmail: 'sistema', details: JSON.stringify({ proposalIds }) } })
    expired++
    rejectedProposals += proposalIds.length

    for (const proposalId of proposalIds) {
      await notifyProposalRejected(proposalId).catch((err) => logger.warn('notify rejected on expiry failed', { proposalId, err }))
    }
    await notifyRequestExpired(r.userId, r.id, r.service.name).catch((err) => logger.warn('notify client on expiry failed', { requestId: r.id, err }))
  }
  return { expired, rejectedProposals }
}

export function requestExpiredMessage(serviceName: string) {
  return `Tu solicitud de ${serviceName} venció sin que eligieras propuesta. Puedes reactivarla con un toque.`
}

async function notifyRequestExpired(userId: string, requestId: string, serviceName: string) {
  const { createNotification } = await import('@/lib/notifications/notificationService')
  // B6 by WhatsApp template (the free text would miss the 24 h window, so WhatsApp stays out of the notification)
  const { waRequestExpired } = await import('@/lib/messaging/wa-events')
  await waRequestExpired(requestId)
  await createNotification({
    userId,
    type: 'NEW_SERVICE_REQUEST',
    title: 'Tu solicitud venció',
    message: requestExpiredMessage(serviceName),
    data: { serviceRequestId: requestId, recipient: 'CLIENT', reason: 'EXPIRED', url: '/dashboard?tab=requests' },
    // Channel templates of this type are built around {{message}}; WhatsApp free text would miss the 24 h window
    channels: ['PUSH', 'EMAIL'],
  })
}

/**
 * Adds photos (already in our storage) to one of the client's requests, after the ones it has. Max 10
 * per request, as in the app.
 */
export async function addRequestPhotos(actor: Actor, requestId: string, urls: string[]) {
  const sr = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, _count: { select: { photos: true } } } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  if (sr.userId !== actor.userId) throw new OpsError('No autorizado', 403)
  const room = Math.max(0, 10 - sr._count.photos)
  if (!room) throw new OpsError('La solicitud ya tiene el máximo de 10 fotos.', 409)
  const take = urls.slice(0, room)
  await prisma.requestPhoto.createMany({ data: take.map((url, i) => ({ serviceRequestId: sr.id, url, order: sr._count.photos + i })) })
  return { added: take.length, skipped: urls.length - take.length }
}
