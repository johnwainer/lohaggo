import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { processCampaign } from '@/lib/messaging/campaign-service'

function isAuthorized(request: NextRequest) {
  const headerToken = request.headers.get('x-internal-token')
  if (!env.SECURITY_INTERNAL_TOKEN) return false
  return headerToken === env.SECURITY_INTERNAL_TOKEN
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const scheduled = await prisma.messagingCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
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

  return NextResponse.json({ ok: true, processed: results.length, results })
}
