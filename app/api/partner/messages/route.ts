import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const partner = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!partner) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const chats = await prisma.chat.findMany({
    where: { partnerId: partner.id },
    include: {
      client: { select: { name: true, image: true } },
      proposal: {
        include: {
          serviceRequest: {
            include: { service: { select: { name: true, icon: true } } },
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
    chats.map((chat) => ({
      id: chat.id,
      proposalId: chat.proposalId,
      client: chat.client,
      service: chat.proposal.serviceRequest.service,
      lastMessage: chat.messages[0] ?? null,
      unreadCount: chat._count.messages,
      updatedAt: chat.updatedAt,
    }))
  )
}
