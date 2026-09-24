export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'
import { updateCommentSettings } from '@/lib/messaging/meta-channels'

type RouteContext = { params: Promise<{ id: string }> }

async function loadManageable(adminId: string, isSuperAdmin: boolean | undefined, email: string, id: string) {
  const conn = await prisma.channelConnection.findUnique({ where: { id }, select: { id: true, workspaceId: true, channel: true, name: true, externalId: true } })
  if (!conn) return { conn: null, allowed: false }
  const access = await getWorkspaceAccess({ id: adminId, email, isSuperAdmin })
  return { conn, allowed: canManage(access, conn.workspaceId) }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))

  const { conn, allowed } = await loadManageable(admin.id, admin.isSuperAdmin, admin.email, id)
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Solo el propietario del workspace puede modificar esta conexión' }, { status: 403 })

  const data: { enabled?: boolean; name?: string } = {}
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120)
  const commentPatch = body.commentSettings && typeof body.commentSettings === 'object' ? (body.commentSettings as Record<string, unknown>) : null
  if (Object.keys(data).length === 0 && !commentPatch) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  // Comments: receive them, include paid ads, Instagram mentions
  let comments: Awaited<ReturnType<typeof updateCommentSettings>> | null = null
  if (commentPatch) {
    const pick = (k: string) => (typeof commentPatch[k] === 'boolean' ? (commentPatch[k] as boolean) : undefined)
    try {
      comments = await updateCommentSettings(id, { enabled: pick('enabled'), includeAds: pick('includeAds'), mentions: pick('mentions') })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo guardar' }, { status: 400 })
    }
  }

  const updated = Object.keys(data).length ? await prisma.channelConnection.update({ where: { id }, data }) : await prisma.channelConnection.findUniqueOrThrow({ where: { id } })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'channels.update',
    entityType: 'ChannelConnection',
    entityId: id,
    route: `/api/admin/channels/${id}`,
    details: JSON.stringify({ ...data, ...(comments ? { commentSettings: { enabled: comments.settings.enabled, includeAds: comments.settings.includeAds, mentions: comments.settings.mentions } } : {}) }),
    request,
  })
  return NextResponse.json({
    ok: true,
    connection: { id: updated.id, enabled: updated.enabled, name: updated.name, commentSettings: updated.commentSettings },
    warning: comments?.warning ?? null,
  })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const { conn, allowed } = await loadManageable(admin.id, admin.isSuperAdmin, admin.email, id)
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Solo el propietario del workspace puede desconectar esta cuenta' }, { status: 403 })

  await prisma.channelConnection.delete({ where: { id } })

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
