import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'PARTNER') {
    return NextResponse.json({ bookings: 0, requests: 0, messages: 0 })
  }

  const partner = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!partner) return NextResponse.json({ bookings: 0, requests: 0, messages: 0 })

  const [bookings, messages] = await Promise.all([
    prisma.booking.count({
      where: {
        partnerId: partner.id,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    }),
    prisma.chatMessage.count({
      where: {
        chat: { partnerId: partner.id },
        read: false,
        senderId: { not: session.user.id },
      },
    }),
  ])

  return NextResponse.json({ bookings, messages })
}
