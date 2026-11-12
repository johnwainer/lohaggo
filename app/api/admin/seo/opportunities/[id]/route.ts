import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { SeoError, briefOpportunity, dismissOpportunity, markOpportunityDone, reopenOpportunity, sendOpportunityToMarketing } from '@/lib/seo/agent/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ACTIONS = ['brief', 'send', 'dismiss', 'done', 'reopen'] as const

/** One action on an opportunity: write its brief, send it to marketing, dismiss (with reason), mark done or reopen. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action as (typeof ACTIONS)[number]
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  try {
    let result: unknown = { ok: true }
    if (action === 'brief') result = { brief: await briefOpportunity(id) }
    else if (action === 'send') result = await sendOpportunityToMarketing(id)
    else if (action === 'dismiss') await dismissOpportunity(id, typeof body?.reason === 'string' ? body.reason : null)
    else if (action === 'done') await markOpportunityDone(id)
    else await reopenOpportunity(id)
    await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: `SEO_OPPORTUNITY_${action.toUpperCase()}`, entityType: 'SeoOpportunity', entityId: id, route: '/api/admin/seo/opportunities', request })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SeoError) return NextResponse.json({ error: err.message }, { status: 400 })
    return NextResponse.json({ error: 'No se pudo completar la acción' }, { status: 500 })
  }
}
