import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { sendVerificationReminders } from '@/lib/messaging/wa-scheduled'

export const maxDuration = 60

const ROUTE = '/api/admin/partners/verification-reminder'

/**
 * Sends the «falta tu documento» WhatsApp reminder to unverified partners without an identity document.
 * `dryRun` only counts. Call again while `done` is false: each partner gets it at most once a day.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const excludeUserIds = Array.isArray(body.excludeUserIds) ? body.excludeUserIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 500) : []
  const result = await sendVerificationReminders({
    limit: Number(body.limit) || undefined,
    excludeUserIds,
    dryRun: body.dryRun === true,
  })

  if (!body.dryRun) {
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'PARTNER_VERIFICATION_REMINDER_SENT',
      entityType: 'PartnerProfile',
      route: ROUTE,
      details: JSON.stringify({ ...result, excluded: excludeUserIds.length }),
    }).catch(() => {})
  }
  return NextResponse.json(result)
}
