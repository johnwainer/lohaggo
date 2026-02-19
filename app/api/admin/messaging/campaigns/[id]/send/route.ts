import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { processCampaign } from '@/lib/messaging/campaign-service'
import { resolveCampaignRecipients, resolveDestination } from '@/lib/messaging/campaign-recipients'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const campaign = await prisma.messagingCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  if (campaign.channel === 'PUSH') {
    const recipients = await resolveCampaignRecipients({
      targetRole: campaign.targetRole,
      targetCity: campaign.targetCity,
      metadata: campaign.metadata,
      take: 5000,
    })
    const eligible = recipients.users.filter((user) => Boolean(resolveDestination('PUSH', user))).length
    if (eligible <= 0) {
      return NextResponse.json(
        {
          error:
            'No hay destinatarios elegibles para PUSH. Deben tener PWA instalada y suscripción push activa.',
          details: {
            totalSegment: recipients.users.length,
            eligiblePush: eligible,
          },
        },
        { status: 400 }
      )
    }
  }

  let processed
  try {
    processed = await processCampaign(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign processing failed'
    if (message.includes('already processing')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

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
