import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { sentAt: 'asc' },
        include: { sentBy: { select: { id: true, name: true } } },
        take: 300,
      },
    },
  })

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark as read
  await prisma.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
  })

  return NextResponse.json({ conversation })
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

  const conversation = await prisma.conversation.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ conversation })
}
