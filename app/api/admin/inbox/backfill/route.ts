import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { backfillInboxState } from '@/lib/inbox/maintenance'

export const maxDuration = 60

/**
 * Superadmin: computes «Por responder» (customFields.inbox) for every open conversation from its messages.
 * { dryRun?: boolean (default true), fixLastMessageAt?: boolean (default false) }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede hacer esto' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dryRun !== false
  const fixLastMessageAt = body?.fixLastMessageAt === true

  const result = await backfillInboxState({ dryRun, fixLastMessageAt })
  if (!dryRun) {
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action: 'INBOX_BACKFILL', entityType: 'Conversation',
      details: JSON.stringify({ fixLastMessageAt, ...result }), request,
    })
  }
  return NextResponse.json(result)
}
