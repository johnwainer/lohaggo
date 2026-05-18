import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus, MessagingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as ConversationStatus | null
  const channel = searchParams.get('channel') as MessagingChannel | null
  const assignedToId = searchParams.get('assignedToId')
  const search = searchParams.get('search')?.trim() || ''
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
      ...(assignedToId === 'none' ? { assignedToId: null } : assignedToId ? { assignedToId } : {}),
      ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { contactPhone: { contains: search } },
              { contactName: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ unreadCount: 'desc' }, { lastMessageAt: 'desc' }],
    take: 200,
  })

  // Also get admin users for agent assignment
  const agents = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ conversations, agents })
}
