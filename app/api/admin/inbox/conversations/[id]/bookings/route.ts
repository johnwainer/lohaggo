import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { formatBookingWhen, formatCalendarDay } from '@/lib/bookings/when'
import { BOOKING_STATUS_LABEL } from '@/lib/bookings/transitions'
import { UNPAID_LOOKBACK_DAYS, canCancelAndReopen, isRelevantBooking, paymentState, shortRef } from '@/lib/inbox/bookings-core'

type RouteContext = { params: Promise<{ id: string }> }

const REQUEST_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Buscando socio', ACCEPTED: 'Aceptada' }

/**
 * Bookings and open requests of the account linked to the conversation, for the side panel: active
 * bookings, completed ones unpaid from the last 14 days, and requests still looking for (or with) a partner.
 * A partner sees the bookings they work on. Only the fields shown are selected.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const conversation = await prisma.conversation.findUnique({ where: { id }, select: { workspaceId: true, userId: true } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  if (!conversation.userId) return NextResponse.json({ role: null, bookings: [], requests: [] })

  const user = await prisma.user.findUnique({ where: { id: conversation.userId }, select: { role: true, partnerProfile: { select: { id: true } } } })
  if (!user) return NextResponse.json({ role: null, bookings: [], requests: [] })
  const asPartner = user.role === 'PARTNER' && user.partnerProfile
  const now = new Date()
  const since = new Date(now.getTime() - UNPAID_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      ...(asPartner ? { partnerId: user.partnerProfile!.id } : { userId: conversation.userId }),
      OR: [{ status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }, { status: 'COMPLETED', scheduledDate: { gte: since } }],
    },
    orderBy: { scheduledDate: 'asc' },
    take: 30,
    select: {
      id: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true,
      service: { select: { name: true } },
      proposal: { select: { serviceRequestId: true } },
      payment: { select: { status: true, confirmationStatus: true } },
      user: { select: { name: true } },
      partner: { select: { user: { select: { name: true } } } },
    },
  })

  const requests = asPartner ? [] : await prisma.serviceRequest.findMany({
    where: { userId: conversation.userId, status: { in: ['ACTIVE', 'ACCEPTED'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, status: true, createdAt: true, preferredDate: true, preferredTime: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
  })

  const shown = bookings.filter((b) => isRelevantBooking(b, now)).slice(0, 15)
  const requestsWithBooking = new Set(shown.map((b) => b.proposal?.serviceRequestId).filter(Boolean))

  return NextResponse.json({
    role: asPartner ? 'PARTNER' : 'CLIENT',
    bookings: shown.map((b) => {
      const requestId = b.proposal?.serviceRequestId ?? null
      const payment = paymentState(b.status, b.payment)
      return {
        id: b.id,
        ref: shortRef(b.id),
        requestId,
        service: b.service.name,
        when: formatBookingWhen(b),
        status: b.status,
        statusLabel: BOOKING_STATUS_LABEL[b.status],
        payment,
        totalPrice: b.totalPrice,
        counterpart: asPartner ? b.user.name : b.partner?.user.name ?? null,
        canReopen: canCancelAndReopen(b.status, requestId),
        needsPayment: b.status === 'COMPLETED' && !payment.settled,
      }
    }),
    requests: requests.filter((r) => !requestsWithBooking.has(r.id)).map((r) => ({
      id: r.id,
      ref: shortRef(r.id),
      service: r.service.name,
      status: r.status,
      statusLabel: REQUEST_STATUS_LABEL[r.status] ?? r.status,
      when: r.preferredDate ? `${formatCalendarDay(r.preferredDate)}${r.preferredTime ? ` ${r.preferredTime}` : ''}` : 'Sin fecha fija',
      proposals: r._count.proposals,
    })),
  })
}
