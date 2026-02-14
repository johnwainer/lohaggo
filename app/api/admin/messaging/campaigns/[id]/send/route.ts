import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { processCampaign } from '@/lib/messaging/campaign-service'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const campaign = await prisma.messagingCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const processed = await processCampaign(id)

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_campaign.send',
    entityType: 'MessagingCampaign',
    entityId: id,
    route: '/api/admin/messaging/campaigns/[id]/send',
    details: `${processed.totalSent}/${processed.totalRecipients}`,
    request,
  })

  return NextResponse.json({ campaign: processed })
}
