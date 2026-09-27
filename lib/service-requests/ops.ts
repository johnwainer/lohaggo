import { City, type Prisma } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { serviceRequestSchema } from '@/lib/validation/schemas'
import { sanitizeObject } from '@/lib/validation/sanitize'
import { notifyNewServiceRequest, notifyProposalRejected } from '@/lib/notifications/notificationService'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'

/**
 * Service-request operations shared by the app routes and the inbox AI agents. They load, validate state
 * and throw OpsError in Spanish; they do not check the session nor write the audit log (the caller does).
 */

const logger = createLogger('service-requests-ops')

export type ServiceRequestInput = z.input<typeof serviceRequestSchema>

export const DEFAULT_RATES = { clientCommissionRate: 5.0, partnerCommissionRate: 10.0 }

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
export async function loadPlatformConfig() {
  return (await prisma.platformConfig.findFirst({ where: { key: 'default' } })) || (await prisma.platformConfig.findFirst({ orderBy: { createdAt: 'asc' } }))
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

export async function createServiceRequest(actor: Actor, input: ServiceRequestInput, origin: Origin) {
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

  let preferredDateTime: Date | null = null
  if (data.preferredDate) {
    preferredDateTime = new Date(data.preferredDate)
    if (data.preferredTime) {
      const [hours, minutes] = data.preferredTime.split(':').map(Number)
      preferredDateTime.setHours(hours, minutes, 0, 0)
    }
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
      photos: data.photoUrls && data.photoUrls.length > 0 ? { create: data.photoUrls.map((url, index) => ({ url, order: index })) } : undefined,
    },
    include: createdRequestInclude,
  })

  try {
    await notifyNewServiceRequest(serviceRequest.id)
  } catch (err) {
    logger.warn('notifyNewServiceRequest failed (non-fatal)', { serviceRequestId: serviceRequest.id, err })
  }

  await recordPromptContext(actor.userId, 'CLIENT_REQUEST_CREATED', {
    serviceRequestId: serviceRequest.id,
    city: serviceRequest.city,
    isUrgent: serviceRequest.isUrgent,
  }).catch(() => undefined)

  return serviceRequest
}

export async function cancelServiceRequest(actor: Actor, requestId: string, _origin: Origin) {
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

  return { id: requestId, cancelledProposals: pendingProposalIds.length }
}

/** The client's requests with their proposals, plus the client commission rate (never writes PlatformConfig). */
export async function listClientRequests(userId: string) {
  const [serviceRequests, platformConfig] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { userId }, include: clientRequestInclude, orderBy: { createdAt: 'desc' } }),
    prisma.platformConfig.findFirst({ orderBy: { createdAt: 'asc' } }),
  ])
  return { serviceRequests, clientCommissionRate: platformConfig?.clientCommissionRate ?? DEFAULT_RATES.clientCommissionRate }
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
