import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig, upsertProviderConfig } from '@/lib/messaging/provider-config'
import { prisma } from '@/lib/prisma'

const CAMPAIGN_ID = 'cmph1g68r0003wbwgcxz9ppn9' // Lanzamiento Medellín

const TEMPLATE_BODY =
  'Hola, te escribimos del equipo LoHaggo 👋\n\nQueremos contarte que la plataforma en *{{1}}* entra en operación el *{{2}}*. A partir de esa fecha comenzarás a recibir solicitudes de clientes directamente.\n\nGracias por tu paciencia. ¡Estamos listos para arrancar juntos! 🚀'

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const twilio = runtimeConfig.twilio.config
  if (!twilio?.accountSid || !twilio?.authToken) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  // Step 1: Create the lanzamiento_ciudad template in Twilio Content API
  const authHeader = `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64')}`

  const createRes = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      friendly_name: 'lanzamiento_ciudad',
      language: 'es_CO',
      variables: { '1': 'ciudad', '2': 'fecha' },
      types: {
        'twilio/text': { body: TEMPLATE_BODY },
      },
    }),
  })

  const createData = await createRes.json()
  if (!createRes.ok) {
    return NextResponse.json({ error: 'Failed to create Twilio template', detail: createData }, { status: 500 })
  }

  const hxSid: string = createData.sid

  // Step 2: Submit for WhatsApp approval
  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${hxSid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'lanzamiento_ciudad',
      category: 'UTILITY',
    }),
  })
  const approvalData = await approvalRes.json()

  // Step 3: Update campaign metadata to use the new Twilio SID
  const campaign = await prisma.messagingCampaign.findUnique({ where: { id: CAMPAIGN_ID } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found', hxSid }, { status: 404 })
  }

  const meta = campaign.metadata ? JSON.parse(campaign.metadata) : {}
  meta.waContentSid = hxSid
  meta.source = 'wa_template'

  await prisma.messagingCampaign.update({
    where: { id: CAMPAIGN_ID },
    data: {
      metadata: JSON.stringify(meta),
      status: 'DRAFT',
      totalSent: 0,
      totalFailed: 0,
      startedAt: null,
      completedAt: null,
    },
  })

  // Step 4: Deactivate META_WHATSAPP
  const existingMetaConf = (runtimeConfig.metaWhatsApp.config ?? {}) as Record<string, unknown>
  await upsertProviderConfig({
    provider: 'META_WHATSAPP',
    isActive: false,
    config: existingMetaConf,
    updatedByEmail: admin.email,
  })

  // Step 5: Delete the FAILED deliveries so the campaign can be re-run cleanly
  await prisma.messagingDelivery.deleteMany({ where: { campaignId: CAMPAIGN_ID } })

  return NextResponse.json({
    ok: true,
    hxSid,
    approvalStatus: approvalData?.status ?? approvalData,
    campaignReset: true,
    metaWhatsAppDeactivated: true,
  })
}
