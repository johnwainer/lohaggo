import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

/** Monthly AI cap per workspace (its "plan"). Platform administrator only. */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId requerido' }, { status: 400 })

  const parse = (v: unknown, int: boolean) => {
    if (v === null || v === '' || v === undefined) return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return NaN
    return int ? Math.floor(n) : n
  }
  const costCap = parse(body.costCapUsd, false)
  const callCap = parse(body.callCap, true)
  if (Number.isNaN(costCap) || Number.isNaN(callCap)) return NextResponse.json({ error: 'Topes inválidos' }, { status: 400 })

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { aiMonthlyCostCapUsd: costCap, aiMonthlyCallCap: callCap, aiCapWarnedPeriod: null },
  })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'AI_LIMITS_UPDATE', entityType: 'Workspace', entityId: workspaceId, details: JSON.stringify({ costCap, callCap }), request })
  return NextResponse.json({ ok: true })
}
