import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const before = request.nextUrl.searchParams.get('before') // cursor: sentAt ISO string
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 60), 100)

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true, phone: true, excludedFromMarketing: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { sentAt: 'desc' },
        take: limit,
        ...(before ? { where: { sentAt: { lt: new Date(before) } } } : {}),
        include: { sentBy: { select: { id: true, name: true } } },
      },
    },
  })

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverse to chronological order
  const messages = [...conversation.messages].reverse()
  const hasMore = conversation.messages.length === limit

  // Mark as read only on initial load (no before cursor)
  if (!before) {
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } })
  }

  return NextResponse.json({ conversation: { ...conversation, messages }, hasMore })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status as ConversationStatus
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null
  if (body.contactName !== undefined) data.contactName = body.contactName
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : []

  const conversation = await prisma.conversation.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ conversation })
}
