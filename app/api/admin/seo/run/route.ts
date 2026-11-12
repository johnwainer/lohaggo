import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { runSeoCycle } from '@/lib/seo/agent/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** «Ejecutar ahora»: a full cycle. `withAi: true` also writes briefs and the weekly report (spends model budget). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const withAi = body?.withAi === true
  if (withAi && !admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede ejecutar el agente con IA (gasta presupuesto)' }, { status: 403 })
  const result = await runSeoCycle({ trigger: 'manual', force: true, withAi })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'SEO_CYCLE_RUN', entityType: 'SeoRun', entityId: result.runId ?? null, route: '/api/admin/seo/run', details: JSON.stringify({ withAi, summary: result.summary }).slice(0, 1000), request })
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
