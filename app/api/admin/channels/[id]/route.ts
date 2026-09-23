export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))

  const data: { enabled?: boolean; name?: string } = {}
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120)
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const conn = await prisma.channelConnection.update({ where: { id }, data }).catch(() => null)
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'channels.update',
    entityType: 'ChannelConnection',
    entityId: id,
    route: `/api/admin/channels/${id}`,
    details: JSON.stringify(data),
    request,
  })
  return NextResponse.json({ ok: true, connection: { id: conn.id, enabled: conn.enabled, name: conn.name } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const conn = await prisma.channelConnection.delete({ where: { id } }).catch(() => null)
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'channels.disconnect',
    entityType: 'ChannelConnection',
    entityId: id,
    route: `/api/admin/channels/${id}`,
    details: `${conn.channel} ${conn.name} (${conn.externalId})`,
    request,
  })
  return NextResponse.json({ ok: true })
}
