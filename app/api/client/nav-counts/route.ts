import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const EMPTY = { bookings: 0, requests: 0, favorites: 0, notifications: 0, messages: 0, action: 0 }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'CLIENT') {
    return NextResponse.json(EMPTY)
  }

  const userId = session.user.id

  const [
    bookings,
    requests,
    favoritePartners,
    favoriteServices,
    notifications,
    messages,
    pendingProposals,
    unpaidBookings,
    unratedBookings,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        userId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    }),
    prisma.serviceRequest.count({
      where: { userId, status: 'ACTIVE' },
    }),
    prisma.favoritePartner.count({ where: { userId } }),
    prisma.favoriteService.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
    // Same rule as /api/client/messages: messages in the client's chats sent by the other side and not read
    prisma.chatMessage.count({
      where: { chat: { clientId: userId }, senderId: { not: userId }, read: false },
    }),
    prisma.proposal.count({
      where: { status: 'PENDING', serviceRequest: { userId, status: 'ACTIVE' } },
    }),
    // Done but not paid yet, and the next move is the client's (not waiting on the partner)
    prisma.booking.count({
      where: {
        userId,
        status: 'COMPLETED',
        OR: [
          { payment: { is: null } },
          {
            payment: {
              is: {
                status: { notIn: ['APPROVED', 'REFUNDED'] },
                confirmationStatus: { in: ['NONE', 'PARTNER_REPORTED', 'REJECTED_BY_PARTNER'] },
              },
            },
          },
        ],
      },
    }),
    // Paid (online or confirmed offline) and the client has not rated the partner
    prisma.booking.count({
      where: {
        userId,
        status: 'COMPLETED',
        payment: {
          is: {
            status: { not: 'REFUNDED' },
            OR: [{ status: 'APPROVED' }, { confirmationStatus: 'CONFIRMED' }],
          },
        },
        OR: [{ review: { is: null } }, { review: { is: { clientToPartnerRating: null } } }],
      },
    }),
  ])

  return NextResponse.json({
    bookings,
    requests,
    favorites: favoritePartners + favoriteServices,
    notifications,
    messages,
    action: pendingProposals + unpaidBookings + unratedBookings,
  })
}
