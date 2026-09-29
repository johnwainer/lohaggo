/**
 * «Solicitud 360»: everything that happened in one service request (photos, proposals, each chat with its
 * messages and images, the booking with its history, work photos, payment, review, guarantee, support
 * cases and where it came from), plus its attention flags. The admin page and Haggo read the same data.
 */
import { prisma } from '@/lib/prisma'
import { bookingWhen } from '@/lib/bookings/when'
import { ACTIVE_STATUSES } from '@/lib/guarantee/policy'
import { attentionFlags, type CaseChat, type CaseChatMessage, type CaseInput } from '@/lib/admin/attention-core'

export const BLOCKED_PREFIX = '⚠️ MENSAJE BLOQUEADO'
export const SUPPORT_PREFIX = '🛟 Soporte LoHaggo'

const requestInclude = {
  service: { select: { id: true, name: true, slug: true, basePrice: true } },
  user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
  partner: { select: { id: true, user: { select: { name: true } } } },
  photos: { orderBy: { order: 'asc' as const }, select: { id: true, url: true } },
  proposals: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      partner: { select: { id: true, slug: true, rating: true, totalReviews: true, completedServicesCount: true, user: { select: { id: true, name: true, phone: true, email: true } } } },
      chat: { include: { messages: { orderBy: { createdAt: 'asc' as const }, take: 300 } } },
      bookings: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          events: { orderBy: { createdAt: 'asc' as const } },
          photos: { orderBy: { createdAt: 'asc' as const } },
          payment: { select: { id: true, status: true, confirmationStatus: true, clientReportedMethod: true, clientReportedAt: true, partnerConfirmedMethod: true, partnerConfirmedAt: true, totalAmount: true, paidAt: true } },
          review: true,
          guaranteeClaims: { select: { id: true, type: true, status: true, createdAt: true, description: true, photoUrls: true } },
          refundCases: { select: { id: true, status: true, requestedAmount: true, approvedAmount: true, createdAt: true } },
        },
      },
    },
  },
}

type LoadedRequest = NonNullable<Awaited<ReturnType<typeof loadRaw>>>

async function loadRaw(id: string) {
  return prisma.serviceRequest.findUnique({ where: { id }, include: requestInclude })
}

function sideOf(senderId: string, origin: string | null, clientId: string, partnerUserId: string): CaseChatMessage['side'] {
  if (senderId === clientId) return 'CLIENT'
  if (senderId === partnerUserId) return 'PARTNER'
  return origin === 'admin' ? 'SUPPORT' : 'SYSTEM'
}

/** The accepted proposal's booking (or the latest one), if any. */
function mainBooking(sr: LoadedRequest) {
  const all = sr.proposals.flatMap((p) => p.bookings.map((b) => ({ ...b, proposalPrice: p.price })))
  return all.find((b) => b.status !== 'CANCELLED') ?? all[0] ?? null
}

export function caseInputOf(sr: LoadedRequest, now = new Date()): CaseInput {
  const b = mainBooking(sr)
  const chats: CaseChat[] = sr.proposals
    .filter((p) => p.chat)
    .map((p) => ({
      proposalId: p.id,
      blockedAttempts: p.chat!.messages.filter((m) => m.senderId === 'SYSTEM' && m.content.startsWith(BLOCKED_PREFIX)).length,
      messages: p.chat!.messages.map((m) => ({ side: sideOf(m.senderId, m.origin, sr.userId, p.partner.user.id), at: m.createdAt, content: m.content })),
    }))
  const statusEvents = b?.events.filter((e) => e.type === 'status') ?? []
  const lastStatus = [...statusEvents].reverse().find((e) => e.toStatus === b?.status)
  const cancel = [...statusEvents].reverse().find((e) => e.toStatus === 'CANCELLED')
  return {
    now,
    basePrice: sr.service.basePrice,
    request: {
      status: sr.status,
      createdAt: sr.createdAt,
      expiresAt: sr.expiresAt,
      isUrgent: sr.isUrgent,
      direct: Boolean(sr.partnerId),
      proposals: sr.proposals.map((p) => ({ id: p.id, status: p.status, price: p.price, createdAt: p.createdAt })),
    },
    booking: b
      ? {
          status: b.status,
          createdAt: b.createdAt,
          at: bookingWhen(b),
          totalPrice: b.totalPrice,
          proposalPrice: b.proposalPrice,
          statusSince: lastStatus?.createdAt ?? b.updatedAt,
          payment: b.payment ? { status: b.payment.status, confirmationStatus: b.payment.confirmationStatus, clientReportedAt: b.payment.clientReportedAt } : null,
          reschedules: b.events.filter((e) => e.type === 'reschedule').length,
          afterPhotos: b.photos.filter((ph) => ph.kind === 'after').length,
          cancelledBy: cancel?.actorType ?? null,
        }
      : null,
    chats,
    guaranteeOpen: b ? b.guaranteeClaims.filter((g) => (ACTIVE_STATUSES as string[]).includes(g.status)).length : 0,
  }
}

/** Everything about one request, shaped for the admin page (and Haggo, which wraps user text as untrusted). */
export async function requestCase(id: string, now = new Date()) {
  const sr = await loadRaw(id)
  if (!sr) return null
  const [touches, notices, cases, blockedLog, conversation] = await Promise.all([
    prisma.serviceRequest.findUnique({ where: { id }, select: { acquisition: true, lastTouch: true } }),
    prisma.notification.findMany({ where: { type: 'NEW_SERVICE_REQUEST', data: { contains: id } }, select: { userId: true, read: true, createdAt: true }, take: 100 }).catch(() => []),
    prisma.adminSupportCase.findMany({ where: { OR: [{ requestId: id }, { booking: { proposal: { serviceRequestId: id } } }] }, select: { id: true, subject: true, status: true, priority: true, queue: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }).catch(() => []),
    prisma.adminAuditLog.findMany({ where: { action: 'CHAT_CONTACT_BLOCKED', entityType: 'Chat', entityId: { in: sr.proposals.map((p) => p.chat?.id).filter((x): x is string => Boolean(x)) } }, select: { entityId: true, details: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
    sr.originConversationId ? prisma.conversation.findUnique({ where: { id: sr.originConversationId }, select: { id: true, channel: true, contactName: true } }).catch(() => null) : Promise.resolve(null),
  ])
  const noticeUsers = notices.length ? await prisma.user.findMany({ where: { id: { in: notices.map((n) => n.userId) }, role: 'PARTNER' }, select: { id: true, name: true } }) : []
  const input = caseInputOf(sr, now)
  const booking = mainBooking(sr)
  return {
    id: sr.id,
    ref: sr.id.slice(-6),
    status: sr.status,
    createdAt: sr.createdAt,
    expiresAt: sr.expiresAt,
    service: sr.service,
    client: sr.user,
    direct: sr.partner ? { id: sr.partner.id, name: sr.partner.user.name } : null,
    address: sr.address,
    city: sr.city,
    zone: sr.zone,
    notes: sr.notes,
    budget: sr.budget,
    preferredDate: sr.preferredDate,
    preferredTime: sr.preferredTime,
    isUrgent: sr.isUrgent,
    origin: { via: sr.origin, channel: sr.originChannel, conversation, acquisition: touches?.acquisition ?? null, lastTouch: touches?.lastTouch ?? null },
    photos: sr.photos,
    notified: notices.flatMap((n) => {
      const u = noticeUsers.find((x) => x.id === n.userId)
      return u ? [{ name: u.name, read: n.read, at: n.createdAt }] : []
    }),
    proposals: sr.proposals.map((p) => ({
      id: p.id,
      ref: p.id.slice(-6),
      status: p.status,
      price: p.price,
      notes: p.notes,
      proposedDate: p.proposedDate,
      proposedTime: p.proposedTime,
      createdAt: p.createdAt,
      origin: p.origin,
      partner: { id: p.partner.id, slug: p.partner.slug, name: p.partner.user.name, phone: p.partner.user.phone, rating: p.partner.rating, reviews: p.partner.totalReviews, jobs: p.partner.completedServicesCount },
      chat: p.chat
        ? {
            id: p.chat.id,
            messages: p.chat.messages.map((m) => ({ id: m.id, side: sideOf(m.senderId, m.origin, sr.userId, p.partner.user.id), content: m.content, imageUrl: m.imageUrl, at: m.createdAt, origin: m.origin, read: m.read })),
            blocked: blockedLog.filter((l) => l.entityId === p.chat!.id).map((l) => ({ at: l.createdAt, details: l.details })),
          }
        : null,
    })),
    booking: booking
      ? {
          id: booking.id,
          ref: booking.id.slice(-6),
          status: booking.status,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          totalPrice: booking.totalPrice,
          proposalPrice: booking.proposalPrice,
          partnerId: booking.partnerId,
          events: booking.events.map((e) => ({ id: e.id, type: e.type, from: e.fromStatus, to: e.toStatus, actorType: e.actorType, origin: e.origin, detail: e.detail, at: e.createdAt })),
          photos: booking.photos.map((ph) => ({ id: ph.id, url: ph.url, kind: ph.kind, at: ph.createdAt })),
          payment: booking.payment,
          review: booking.review,
          guaranteeClaims: booking.guaranteeClaims,
          refundCases: booking.refundCases,
        }
      : null,
    otherBookings: sr.proposals.flatMap((p) => p.bookings).filter((b) => b.id !== booking?.id).map((b) => ({ id: b.id, status: b.status, createdAt: b.createdAt })),
    supportCases: cases,
    flags: attentionFlags(input),
  }
}

export type RequestCase = NonNullable<Awaited<ReturnType<typeof requestCase>>>

/**
 * Requests that need attention: the last `days` of requests plus any with a live booking, each with its
 * flags, worst first. For the list badges, Haggo's snapshot and its read tool.
 */
export async function scanAttention(opts: { days?: number; now?: Date; take?: number } = {}) {
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - (opts.days ?? 30) * 24 * 3600_000)
  const rows = await prisma.serviceRequest.findMany({
    where: { OR: [{ createdAt: { gte: since } }, { proposals: { some: { bookings: { some: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } } } } } }] },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 300,
  })
  const order = { critical: 0, warning: 1, info: 2 }
  return rows
    .map((sr) => {
      const flags = attentionFlags(caseInputOf(sr, now))
      const b = mainBooking(sr)
      return { id: sr.id, ref: sr.id.slice(-6), service: sr.service.name, client: sr.user.name, status: sr.status, bookingStatus: b?.status ?? null, createdAt: sr.createdAt, flags }
    })
    .filter((r) => r.flags.length > 0)
    .sort((a, b) => order[a.flags[0].severity] - order[b.flags[0].severity] || b.createdAt.getTime() - a.createdAt.getTime())
}
