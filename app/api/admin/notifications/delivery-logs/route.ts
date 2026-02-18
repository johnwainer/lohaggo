import { NextRequest, NextResponse } from 'next/server'
import type { MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

const VALID_CHANNELS: MessagingChannel[] = ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH']
const VALID_STATUSES: NotificationDispatchStatus[] = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'OPENED',
  'CLICKED',
  'UNSUBSCRIBED',
  'SKIPPED',
]
const VALID_ROLES: UserRole[] = ['CLIENT', 'PARTNER', 'ADMIN']

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelParam = request.nextUrl.searchParams.get('channel')
  const statusParam = request.nextUrl.searchParams.get('status')
  const roleParam = request.nextUrl.searchParams.get('role')
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 100)
  const limit = Math.max(10, Math.min(limitRaw, 300))

  const channel = channelParam && VALID_CHANNELS.includes(channelParam as MessagingChannel) ? (channelParam as MessagingChannel) : null
  const status = statusParam && VALID_STATUSES.includes(statusParam as NotificationDispatchStatus)
    ? (statusParam as NotificationDispatchStatus)
    : null
  const role = roleParam && VALID_ROLES.includes(roleParam as UserRole) ? (roleParam as UserRole) : null

  const from7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [logs, grouped7d] = await Promise.all([
    (prisma as any).notificationDispatchLog.findMany({
      where: {
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
        ...(role ? { userRole: role } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        notification: { select: { id: true, title: true, message: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    (prisma as any).notificationDispatchLog.groupBy({
      by: ['channel', 'status'],
      where: { createdAt: { gte: from7d } },
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({
    logs,
    summary7d: (grouped7d as Array<{ channel: MessagingChannel; status: NotificationDispatchStatus; _count: { _all: number } }>).map((row) => ({
      channel: row.channel,
      status: row.status,
      count: row._count._all,
    })),
  })
}
type NotificationDispatchStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'OPENED' | 'CLICKED' | 'UNSUBSCRIBED' | 'SKIPPED'
