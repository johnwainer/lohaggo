import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { cleanupInactiveConversations } from '@/lib/inbox/maintenance'

export const maxDuration = 60

/**
 * Superadmin: «Cerrar conversaciones inactivas». { dryRun?: boolean (default true) } → counts per reason;
 * with dryRun false it closes them (status CLOSED) and logs an event in each thread.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede hacer esto' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dryRun !== false

  const result = await cleanupInactiveConversations({ dryRun, actor: { id: admin.id, name: admin.name } })
  if (!dryRun) {
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action: 'INBOX_CLEANUP', entityType: 'Conversation',
      details: JSON.stringify(result), request,
    })
  }
  return NextResponse.json(result)
}
