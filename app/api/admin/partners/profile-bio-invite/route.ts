import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { sendProfileBioInvites } from '@/lib/messaging/wa-scheduled'

export const maxDuration = 60

const ROUTE = '/api/admin/partners/profile-bio-invite'

/**
 * Invites verified partners with no «Sobre mí» by WhatsApp to write it with the profile assistant.
 * `dryRun` only counts. Call again while `done` is false: each partner gets it at most once every 45 days.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const result = await sendProfileBioInvites({
    limit: Number(body.limit) || undefined,
    dryRun: body.dryRun === true,
  })

  if (!body.dryRun) {
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'PARTNER_PROFILE_BIO_INVITE_SENT',
      entityType: 'PartnerProfile',
      route: ROUTE,
      details: JSON.stringify(result),
    }).catch(() => {})
  }
  return NextResponse.json(result)
}
