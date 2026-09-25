import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { processCampaign } from '@/lib/messaging/campaign-service'
import { cronRoute } from '@/lib/system/cron'

async function runScheduled() {
  const now = new Date()
  const scheduled = await prisma.messagingCampaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  })

  const results: Array<{ id: string; status: string; sent: number; failed: number }> = []
  for (const campaign of scheduled) {
    const processed = await processCampaign(campaign.id)
    results.push({
      id: processed.id,
      status: processed.status,
      sent: processed.totalSent,
      failed: processed.totalFailed,
    })
  }
  return results
}

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
