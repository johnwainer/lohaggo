import { NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { runAiProbeCycle } from '@/lib/seo/agent/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** «Medir ahora»: the weekly AI-answers probe on demand (spends model budget: about US$ 0,20–0,50). Superadmin only. */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede medir en las IA (gasta presupuesto)' }, { status: 403 })
  const r = await runAiProbeCycle({ trigger: 'manual', force: true })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'SEO_AI_PROBE_RUN', entityType: 'SeoRun', entityId: r.runId ?? null, route: '/api/admin/seo/ai-probe', details: r.summary.slice(0, 500) })
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
