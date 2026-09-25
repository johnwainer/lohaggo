import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { systemOverview } from '@/lib/system/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json(await systemOverview(), { headers: { 'Cache-Control': 'no-store' } })
}

/** Mark error groups as resolved (they reopen by themselves if the error happens again). */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.errorIds) ? body.errorIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 100) : []
  if (!ids.length) return NextResponse.json({ error: 'Nada que resolver' }, { status: 400 })
  const r = await prisma.appErrorGroup.updateMany({ where: { id: { in: ids } }, data: { resolvedAt: new Date() } })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'SYSTEM_ERRORS_RESOLVE', entityType: 'AppErrorGroup', details: `${r.count} grupos`, request })
  return NextResponse.json({ ok: true, resolved: r.count })
}
