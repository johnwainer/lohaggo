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
    select: {
      id: true,
      services: { select: { serviceId: true } },
    },
  })
  if (!partner) return NextResponse.json({ bookings: 0, requests: 0, messages: 0 })

  const partnerServiceIds = partner.services.map((s) => s.serviceId)

  const [bookings, messages, requests] = await Promise.all([
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
    prisma.serviceRequest.count({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: new Date() },
        proposals: { none: { partnerId: partner.id } },
        OR: [
          { serviceId: { in: partnerServiceIds }, partnerId: null },
          { partnerId: partner.id },
        ],
      },
    }),
  ])

  return NextResponse.json({ bookings, messages, requests })
}
