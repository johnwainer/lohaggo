export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { runCapabilityDiagnostics } from '@/lib/messaging/meta-channels'
import { canManage, canView, getWorkspaceAccess } from '@/lib/workspaces'
import { checkConnectionToken } from '@/lib/marketing/token-health'
import { refreshWorkspaceAgents } from '@/lib/marketing/agent'
import { adoptOrphans } from '@/lib/marketing/reconnect'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const conn = await prisma.channelConnection.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conn.workspaceId)) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })

  try {
    const capabilities = await runCapabilityDiagnostics(id)
    if (!capabilities) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
    // Publications left without account by a disconnect come back, and an agent forced to copilot by this account returns to its mode now
    const full = await prisma.channelConnection.findUnique({ where: { id } })
    // The token state is checked again now (a stale «token broken» blocks every send until the daily check)
    if (full) await checkConnectionToken(full).catch(() => null)
    // Re-attaching publications can re-queue sends: only who manages the workspace
    if (full && canManage(access, conn.workspaceId)) await adoptOrphans(full).catch(() => null)
    await refreshWorkspaceAgents(conn.workspaceId).catch(() => null)
    return NextResponse.json({ ok: true, capabilities })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error en el diagnóstico' }, { status: 500 })
  }
}
