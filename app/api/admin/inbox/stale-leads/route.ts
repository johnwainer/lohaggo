import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { sweepStaleLeads } from '@/lib/inbox/stale-leads'

export const maxDuration = 300

/**
 * Superadmin: «Leads sin respuesta». { dryRun?: boolean (default true), notify?: boolean (default true) } → what
 * the daily sweep does now: the AI answers inside the window, the rest goes back to «Por responder» tagged.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede hacer esto' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dryRun !== false

  const result = await sweepStaleLeads({ dryRun, notify: body?.notify !== false })
  if (!dryRun) {
    const { items, ...summary } = result
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action: 'INBOX_STALE_LEADS', entityType: 'Conversation',
      details: JSON.stringify({ ...summary, ids: items.filter((i) => i.done).map((i) => i.id).slice(0, 100) }).slice(0, 4000), request,
    })
  }
  return NextResponse.json(result)
}
