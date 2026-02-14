import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [searches24h, requests24h, proposals24h, bookings24h, approvedPayments24h, completedBookings7d] = await Promise.all([
    prisma.searchHistory.count({ where: { createdAt: { gte: last24h } } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: last24h } } }),
    prisma.proposal.count({ where: { createdAt: { gte: last24h } } }),
    prisma.booking.count({ where: { createdAt: { gte: last24h } } }),
    prisma.payment.count({ where: { createdAt: { gte: last24h }, status: 'APPROVED' } }),
    prisma.booking.count({ where: { updatedAt: { gte: last7d }, status: 'COMPLETED' } }),
  ])

  const conversionSearchToRequest = searches24h > 0 ? (requests24h / searches24h) * 100 : 0
  const conversionRequestToBooking = requests24h > 0 ? (bookings24h / requests24h) * 100 : 0
  const conversionBookingToPayment = bookings24h > 0 ? (approvedPayments24h / bookings24h) * 100 : 0

  return NextResponse.json({
    generatedAt: now.toISOString(),
    funnel24h: {
      searches: searches24h,
      requests: requests24h,
      proposals: proposals24h,
      bookings: bookings24h,
      approvedPayments: approvedPayments24h,
      conversionSearchToRequest: Number(conversionSearchToRequest.toFixed(2)),
      conversionRequestToBooking: Number(conversionRequestToBooking.toFixed(2)),
      conversionBookingToPayment: Number(conversionBookingToPayment.toFixed(2)),
    },
    retention: {
      completedBookings7d,
    },
  })
}
