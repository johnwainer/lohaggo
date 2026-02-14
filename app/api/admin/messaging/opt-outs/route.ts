import { NextRequest, NextResponse } from 'next/server'
import type { MessagingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channel = request.nextUrl.searchParams.get('channel') as MessagingChannel | null

  const optOuts = await prisma.messagingOptOut.findMany({
    where: channel ? { channel } : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  })
  return NextResponse.json({ optOuts })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()

  if (!body?.channel || !body?.destination) {
    return NextResponse.json({ error: 'channel y destination requeridos' }, { status: 400 })
  }

  const optOut = await prisma.messagingOptOut.upsert({
    where: {
      channel_destination: {
        channel: body.channel as MessagingChannel,
        destination: String(body.destination),
      },
    },
    update: {
      isActive: true,
      reason: body.reason || 'admin opt-out',
      source: 'admin',
      userId: body.userId || null,
    },
    create: {
      channel: body.channel as MessagingChannel,
      destination: String(body.destination),
      reason: body.reason || 'admin opt-out',
      source: 'admin',
      userId: body.userId || null,
      isActive: true,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_optout.create',
    entityType: 'MessagingOptOut',
    entityId: optOut.id,
    route: '/api/admin/messaging/opt-outs',
    details: `${optOut.channel}:${optOut.destination}`,
    request,
  })

  return NextResponse.json({ optOut }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const optOut = await prisma.messagingOptOut.update({
    where: { id: body.id },
    data: {
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.reason !== undefined ? { reason: body.reason ? String(body.reason) : null } : {}),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_optout.update',
    entityType: 'MessagingOptOut',
    entityId: optOut.id,
    route: '/api/admin/messaging/opt-outs',
    details: `${optOut.channel}:${optOut.destination} active=${optOut.isActive}`,
    request,
  })

  return NextResponse.json({ optOut })
}
