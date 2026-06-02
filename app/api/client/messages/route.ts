import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeChatState } from '@/lib/chat-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const chats = await prisma.chat.findMany({
    where: { clientId: session.user.id },
    include: {
      partner: {
        select: {
          id: true,
          verified: true,
          user: { select: { name: true, image: true } },
        },
      },
      proposal: {
        select: {
          status: true,
          serviceRequest: {
            select: {
              status: true,
              service: { select: { name: true, slug: true, icon: true } },
            },
          },
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: { read: false, senderId: { not: session.user.id } },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(
    chats.map((chat) => {
      const bookingStatus = chat.proposal.bookings[0]?.status ?? null
      const state = computeChatState({
        serviceRequestStatus: chat.proposal.serviceRequest.status,
        proposalStatus: chat.proposal.status,
        bookingStatus,
      })
      return {
        id: chat.id,
        proposalId: chat.proposalId,
        partner: {
          name: chat.partner.user.name,
          image: chat.partner.user.image,
          verified: chat.partner.verified,
        },
        service: chat.proposal.serviceRequest.service,
        lastMessage: chat.messages[0] ?? null,
        unreadCount: chat._count.messages,
        updatedAt: chat.updatedAt,
        bookingStatus,
        isActive: state.isActive,
        statusLabel: state.statusLabel,
      }
    })
  )
}
