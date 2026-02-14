import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { processCampaign } from '@/lib/messaging/campaign-service'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_campaign.run_scheduled',
    entityType: 'MessagingCampaign',
    details: `processed=${results.length}`,
  })

  return NextResponse.json({ ok: true, processed: results.length, results })
}
