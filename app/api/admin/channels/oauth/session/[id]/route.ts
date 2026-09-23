export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { completeOAuthSelection, getOAuthSessionCandidates } from '@/lib/messaging/meta-channels'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  try {
    const result = await getOAuthSessionCandidates(id, admin.id)
    if (!result) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    return NextResponse.json({
      session: { id: result.session.id, channel: result.session.channel, status: result.session.status, expiresAt: result.session.expiresAt, workspace: result.session.workspace },
      candidates: result.candidates,
      error: result.error,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error leyendo la sesión' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const selectedIds: string[] = Array.isArray(body.selectedIds) ? body.selectedIds.map(String) : []
  if (selectedIds.length === 0) return NextResponse.json({ error: 'Selecciona al menos una cuenta' }, { status: 400 })

  // Re-check management rights at completion time (ownership may have been revoked since oauth/start)
  const session = await prisma.channelOAuthSession.findUnique({ where: { id }, select: { adminId: true, workspaceId: true } })
  if (!session || session.adminId !== admin.id) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, session.workspaceId)) return NextResponse.json({ error: 'Ya no eres propietario de este workspace' }, { status: 403 })

  try {
    const result = await completeOAuthSelection({ sessionId: id, adminId: admin.id, adminEmail: admin.email, selectedIds })
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'channels.connect',
      entityType: 'ChannelConnection',
      route: `/api/admin/channels/oauth/session/${id}`,
      details: `${result.channel}: ${result.results.map((r) => `${r.name}${r.error ? ` (error: ${r.error})` : ''}`).join(', ')}`,
      request,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo completar la conexión' }, { status: 400 })
  }
}
