import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'CLIENT') {
    return NextResponse.json({ bookings: 0, requests: 0, favorites: 0, notifications: 0 })
  }

  const userId = session.user.id

  const [bookings, requests, favoritePartners, favoriteServices, notifications] = await Promise.all([
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
  ])

  return NextResponse.json({
    bookings,
    requests,
    favorites: favoritePartners + favoriteServices,
    notifications,
  })
}
