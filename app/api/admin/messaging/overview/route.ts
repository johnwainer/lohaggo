import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [campaigns, deliveries] = await Promise.all([
    prisma.messagingCampaign.findMany({
      select: { id: true, channel: true, status: true, totalRecipients: true, totalSent: true, totalFailed: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.messagingDelivery.groupBy({
      by: ['channel', 'status'],
      _count: { _all: true },
    }),
  ])

  const totals = campaigns.reduce(
    (acc, item) => {
      acc.recipients += item.totalRecipients
      acc.sent += item.totalSent
      acc.failed += item.totalFailed
      return acc
    },
    { recipients: 0, sent: 0, failed: 0 }
  )

  const deliverabilityRate = totals.recipients > 0 ? Number(((totals.sent / totals.recipients) * 100).toFixed(2)) : 0

  return NextResponse.json({
    totals: {
      campaigns: campaigns.length,
      recipients: totals.recipients,
      sent: totals.sent,
      failed: totals.failed,
      deliverabilityRate,
    },
    groupedDeliveries: deliveries.map((row) => ({
      channel: row.channel,
      status: row.status,
      count: row._count._all,
    })),
  })
}
