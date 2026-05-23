import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat-unread-counts')

const MAX_BATCH = 500

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const proposalIds: unknown = body?.proposalIds

    if (
      !Array.isArray(proposalIds) ||
      proposalIds.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 64)
    ) {
      return NextResponse.json(
        { error: 'proposalIds debe ser un array de strings (max 64 chars cada uno)' },
        { status: 400 }
      )
    }

    if (proposalIds.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    if (proposalIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `Máximo ${MAX_BATCH} proposalIds por request` }, { status: 400 })
    }

    const uniqueIds = Array.from(new Set(proposalIds as string[]))

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { partnerProfile: { select: { id: true } } }
    })

    const accessFilters = []
    accessFilters.push({ clientId: session.user.id })
    if (user?.partnerProfile?.id) {
      accessFilters.push({ partnerId: user.partnerProfile.id })
    }

    const chats = await prisma.chat.findMany({
      where: {
        proposalId: { in: uniqueIds },
        OR: accessFilters,
      },
      select: { id: true, proposalId: true },
    })

    const chatIds = chats.map((c) => c.id)
    const counts: Record<string, number> = {}
    for (const id of uniqueIds) counts[id] = 0

    if (chatIds.length === 0) {
      return NextResponse.json({ counts })
    }

    const grouped = await prisma.chatMessage.groupBy({
      by: ['chatId'],
      where: {
        chatId: { in: chatIds },
        senderId: { not: session.user.id },
        read: false,
      },
      _count: { _all: true },
    })

    const countByChatId = new Map(grouped.map((g) => [g.chatId, g._count._all]))
    for (const chat of chats) {
      counts[chat.proposalId] = countByChatId.get(chat.id) || 0
    }

    return NextResponse.json({ counts })
  } catch (error) {
    logger.error('Error fetching unread counts batch', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}
