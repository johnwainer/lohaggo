import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus, MessagingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess, listAccessibleWorkspaces, workspaceScope } from '@/lib/workspaces'
import { INBOX_TABS, channelCountsQuery, connectionCountsQuery, countsQuery, decodeCursor, encodeCursor, pageQuery, parseTab, type InboxTab, type ListFilters } from '@/lib/inbox/list'
import { inboxView } from '@/lib/inbox/state'

export const dynamic = 'force-dynamic'

const CHANNELS: MessagingChannel[] = ['WHATSAPP', 'SMS', 'MESSENGER', 'INSTAGRAM', 'FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT']
const STATUSES: ConversationStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const tab = parseTab(searchParams.get('tab'))
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
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 40, 1), 100)
  const cursorParam = searchParams.get('cursor')
  const cursor = decodeCursor(cursorParam)
  if (cursorParam && !cursor) return NextResponse.json({ error: 'Cursor inválido' }, { status: 400 })
  // «Cargar más» only needs the next page; the first page also brings counters and selectors
  const pageOnly = Boolean(cursor)

  const access = await getWorkspaceAccess(admin)
  if (workspaceId && !canView(access, workspaceId)) {
    return NextResponse.json({ error: 'Sin acceso a este workspace' }, { status: 403 })
  }

  const now = new Date()
  const ctx = { userId: admin.id, nowIso: now.toISOString() }
  const filters: ListFilters = {
    workspaceIds: workspaceId ? [workspaceId] : access.workspaceIds,
    channel, status, assignedToId, connectionId, tag, search, unreadOnly,
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; pinned: boolean; sort_at: Date }>>(pageQuery(tab, filters, ctx, cursor, limit))
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ p: last.pinned, t: new Date(last.sort_at).toISOString(), i: last.id }) : null

  // Background refresh: fresh data of the rows already on screen (updated in place, never moved)
  const watchIds = (searchParams.get('watch') || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 150)
  const wanted = Array.from(new Set([...page.map((r) => r.id), ...watchIds]))
  const found = wanted.length
    ? await prisma.conversation.findMany({
      where: { id: { in: wanted }, ...(workspaceId ? { workspaceId } : workspaceScope(access)) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
        connection: { select: { id: true, name: true, channel: true } },
        _count: { select: { messages: true } },
      },
    })
    : []
  const byId = new Map(found.map((c) => [c.id, c]))
  const conversations = page
    .map((r) => byId.get(r.id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ ...c, inbox: inboxView(c.customFields, admin.id, now) }))
  const watched = watchIds
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ ...c, inbox: inboxView(c.customFields, admin.id, now) }))

  if (pageOnly) return NextResponse.json({ conversations, nextCursor, tab })

  const [countRows, channelRows, connectionRows, agents, workspaces, connections, tagRows, aiAgents] = await Promise.all([
    prisma.$queryRaw<Array<Record<InboxTab, number>>>(countsQuery(filters, ctx)),
    prisma.$queryRaw<Array<{ channel: string; n: number }>>(channelCountsQuery(tab, filters, ctx)),
    prisma.$queryRaw<Array<{ connectionId: string | null; n: number }>>(connectionCountsQuery(tab, filters, ctx)),
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
      where: {
        status: 'active',
        OR: [{ autopilot: true }, { NOT: { copilotChannels: { isEmpty: true } } }, { NOT: { commentChannels: { isEmpty: true } } }, { NOT: { commentCopilotChannels: { isEmpty: true } } }],
        ...workspaceScope(access),
      },
      select: { id: true, name: true, workspaceId: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const tabCounts = Object.fromEntries(INBOX_TABS.map((t) => [t, Number(countRows[0]?.[t] ?? 0)])) as Record<InboxTab, number>
  const channelCounts: Record<string, number> = {}
  for (const g of channelRows) channelCounts[g.channel] = Number(g.n)
  const connectionCounts: Record<string, number> = {}
  for (const g of connectionRows) connectionCounts[g.connectionId ?? 'none'] = Number(g.n)
  const tags = Array.from(new Set(tagRows.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, 'es'))

  return NextResponse.json({
    tab,
    conversations,
    watched,
    nextCursor,
    tabCounts,
    agents,
    aiAgents,
    workspaces,
    connections,
    connectionCounts,
    tags,
    channelCounts,
    total: Object.values(channelCounts).reduce((a, b) => a + b, 0),
    me: admin.id,
    isSuperAdmin: access.isSuperAdmin,
  })
}
