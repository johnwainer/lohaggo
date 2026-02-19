import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const campaign = await prisma.messagingCampaign.findUnique({
    where: { id },
    select: { id: true, name: true, channel: true, totalFailed: true },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const limitParam = Number(request.url ? new URL(request.url).searchParams.get('limit') || '150' : '150')
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(500, Math.floor(limitParam))) : 150

  const failedDeliveries = await prisma.messagingDelivery.findMany({
    where: {
      campaignId: id,
      status: 'FAILED',
    },
    select: {
      id: true,
      destination: true,
      status: true,
      provider: true,
      providerMessageId: true,
      errorCode: true,
      errorMessage: true,
      sentAt: true,
      deliveredAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  })

  return NextResponse.json({
    campaign,
    failedDeliveries,
  })
}
