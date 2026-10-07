import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dateOnlyUtc } from '@/lib/bookings/when'
import { listOpenRequestsForPartner } from '@/lib/service-requests/ops'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Badges of the partner panel. «bookings» counts only what needs the partner now: to confirm, services of
 * today or earlier still open, and cash payments the client reported. «requests» is the same list the
 * Oportunidades tab shows, without the ones the partner already answered.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'PARTNER') {
    return NextResponse.json({ bookings: 0, requests: 0, messages: 0 })
  }

  const partner = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, user: { select: { isActive: true } } },
  })
  if (!partner) return NextResponse.json({ bookings: 0, requests: 0, messages: 0 })

  // Start of tomorrow's Bogotá day as stored (date-only at 00:00 UTC)
  const endOfToday = new Date(dateOnlyUtc(new Date()).getTime() + DAY_MS)

  const [bookings, messages, requests] = await Promise.all([
    prisma.booking.count({
      where: {
        partnerId: partner.id,
        OR: [
          { status: 'PENDING' },
          { status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, scheduledDate: { lt: endOfToday } },
          { status: 'COMPLETED', payment: { is: { confirmationStatus: 'CLIENT_REPORTED' } } },
        ],
      },
    }),
    prisma.chatMessage.count({
      where: {
        chat: { partnerId: partner.id },
        read: false,
        senderId: { not: session.user.id },
      },
    }),
    partner.user.isActive
      ? listOpenRequestsForPartner(partner.id).then((rows) => rows.length).catch(() => 0)
      : Promise.resolve(0),
  ])

  return NextResponse.json({ bookings, messages, requests })
}
