import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus, MessagingChannel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess, listAccessibleWorkspaces, workspaceScope } from '@/lib/workspaces'

export const dynamic = 'force-dynamic'

const CHANNELS: MessagingChannel[] = ['WHATSAPP', 'SMS', 'MESSENGER', 'INSTAGRAM']
const STATUSES: ConversationStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
type SortKey = 'recent' | 'unread' | 'waiting' | 'oldest'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const statusParam = searchParams.get('status') as ConversationStatus | null
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : null
  const channelParam = searchParams.get('channel') as MessagingChannel | null
  const channel = channelParam && CHANNELS.includes(channelParam) ? channelParam : null
  const assignedToId = searchParams.get('assignedToId')
  const connectionId = searchParams.get('connectionId')
  const tag = searchParams.get('tag')?.trim() || ''
  const search = searchParams.get('search')?.trim().slice(0, 100) || ''
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const workspaceId = searchParams.get('workspaceId')
  const sortParam = (searchParams.get('sort') || 'unread') as SortKey
  const sort: SortKey = ['recent', 'unread', 'waiting', 'oldest'].includes(sortParam) ? sortParam : 'unread'

  const access = await getWorkspaceAccess(admin)
  if (workspaceId && !canView(access, workspaceId)) {
    return NextResponse.json({ error: 'Sin acceso a este workspace' }, { status: 403 })
  }

  const searchDigits = search.replace(/\D/g, '')
  // Every filter except channel: used both for the list and for the per-channel counters
  const baseWhere: Prisma.ConversationWhereInput = {
    ...(workspaceId ? { workspaceId } : workspaceScope(access)),
    ...(status ? { status } : {}),
    ...(assignedToId === 'none' ? { assignedToId: null, aiHandled: false } : assignedToId === 'ai' ? { aiHandled: true } : assignedToId ? { assignedToId } : {}),
    ...(connectionId ? { connectionId } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { contactPhone: { contains: search } },
            ...(searchDigits.length >= 4 ? [{ contactPhone: { contains: searchDigits } }] : []),
            { contactName: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { tags: { has: search.toLowerCase() } },
            { messages: { some: { body: { contains: search, mode: 'insensitive' }, isInternal: false } } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.ConversationOrderByWithRelationInput[] =
    sort === 'recent'
      ? [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }]
      : sort === 'oldest'
      ? [{ lastMessageAt: { sort: 'asc', nulls: 'last' } }]
      : sort === 'waiting'
      ? [{ unreadCount: 'desc' }, { lastMessageAt: { sort: 'asc', nulls: 'last' } }]
      : [{ unreadCount: 'desc' }, { lastMessageAt: { sort: 'desc', nulls: 'last' } }]

  const [conversations, channelGroups, agents, workspaces, connections, tagRows, aiAgents] = await Promise.all([
    prisma.conversation.findMany({
      where: { ...baseWhere, ...(channel ? { channel } : {}) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
        connection: { select: { id: true, name: true, channel: true } },
        _count: { select: { messages: true } },
      },
      orderBy,
      take: 200,
    }),
    prisma.conversation.groupBy({ by: ['channel'], where: baseWhere, _count: { _all: true } }),
    // Agents for assignment: admins in a workspace the caller can see (superadmin: all admins)
    prisma.user.findMany({
      where: {
        role: 'ADMIN',
        ...(access.workspaceIds === null ? {} : { workspaceMemberships: { some: { workspaceId: { in: access.workspaceIds } } } }),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    listAccessibleWorkspaces(access),
    prisma.channelConnection.findMany({
      where: workspaceScope(access),
      select: { id: true, name: true, channel: true },
      orderBy: [{ channel: 'asc' }, { name: 'asc' }],
    }),
    prisma.conversation.findMany({
      where: { ...(workspaceId ? { workspaceId } : workspaceScope(access)), tags: { isEmpty: false } },
      select: { tags: true },
      take: 1000,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.aiAgent.findMany({
      // Agents a conversation can be handed to: autopilot or copilot on some channel
      where: { status: 'active', OR: [{ autopilot: true }, { NOT: { copilotChannels: { isEmpty: true } } }], ...workspaceScope(access) },
      select: { id: true, name: true, workspaceId: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const channelCounts: Record<string, number> = {}
  for (const g of channelGroups) channelCounts[g.channel] = g._count._all
  const tags = Array.from(new Set(tagRows.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, 'es'))

  return NextResponse.json({
    conversations,
    agents,
    aiAgents,
    workspaces,
    connections,
    tags,
    channelCounts,
    total: Object.values(channelCounts).reduce((a, b) => a + b, 0),
    isSuperAdmin: access.isSuperAdmin,
  })
}
