import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const campaign = await prisma.messagingCampaign.findUnique({
    where: { id },
    include: {
      deliveries: true,
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const byStatus = campaign.deliveries.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})

  const byVariant = campaign.deliveries.reduce<Record<string, number>>((acc, item) => {
    const key = item.abVariant || 'DEFAULT'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const deliverabilityRate = campaign.totalRecipients > 0
    ? Number(((campaign.totalSent / campaign.totalRecipients) * 100).toFixed(2))
    : 0

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      totalRecipients: campaign.totalRecipients,
      totalSent: campaign.totalSent,
      totalFailed: campaign.totalFailed,
    },
    metrics: {
      byStatus,
      byVariant,
      deliverabilityRate,
    },
  })
}
