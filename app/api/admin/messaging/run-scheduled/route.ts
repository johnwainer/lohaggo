import { NextResponse } from 'next/server'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { runScheduledCampaigns } from '@/lib/messaging/campaign-service'
import { cronRoute } from '@/lib/system/cron'

export const maxDuration = 300

const runScheduled = () => runScheduledCampaigns()

/** Manual run from the admin (audited). */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const results = await runScheduled()
  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_campaign.run_scheduled',
    entityType: 'MessagingCampaign',
    details: `processed=${results.length}`,
  })

  return NextResponse.json({ ok: true, processed: results.length, results })
}

/** Vercel cron (GET with CRON_SECRET): before, the schedule hit an admin-only POST and never ran. */
export const GET = cronRoute('admin-messaging-run-scheduled', async () => {
  const results = await runScheduled()
  return NextResponse.json({ ok: true, processed: results.length, results })
})
