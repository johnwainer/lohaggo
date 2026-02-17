import { NextRequest, NextResponse } from 'next/server'
import type { City, MessagingCampaignStatus, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import {
  mergeCampaignAudienceMetadata,
  mergeRecipientControlMetadata,
  parseCampaignAudience,
  parseRecipientControl,
} from '@/lib/messaging/campaign-recipients'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as MessagingCampaignStatus | null
  const channel = request.nextUrl.searchParams.get('channel') as MessagingChannel | null

  const campaigns = await prisma.messagingCampaign.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
    },
    include: {
      template: { select: { id: true, key: true, name: true } },
      createdBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return NextResponse.json({ campaigns })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()

  if (!body?.name || !body?.channel) {
    return NextResponse.json({ error: 'name y channel requeridos' }, { status: 400 })
  }

  const contentMode = body.contentMode === 'CUSTOM' ? 'CUSTOM' : 'TEMPLATE'
  let finalBody = body.customBody ? String(body.customBody).trim() : ''
  let finalSubject = body.customSubject ? String(body.customSubject) : null

  if (contentMode === 'TEMPLATE') {
    if (!body.templateId) {
      return NextResponse.json({ error: 'templateId es requerido cuando usas modo plantilla' }, { status: 400 })
    }
    const template = await prisma.messagingTemplate.findUnique({
      where: { id: body.templateId },
      select: { id: true, channel: true, body: true, subject: true, isActive: true },
    })
    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Plantilla no encontrada o inactiva' }, { status: 400 })
    }
    if (template.channel !== body.channel) {
      return NextResponse.json({ error: 'La plantilla no corresponde al canal seleccionado' }, { status: 400 })
    }
    if (!finalBody) finalBody = template.body
    if (!finalSubject && template.subject) finalSubject = template.subject
  }

  if (!finalBody) {
    return NextResponse.json({ error: 'El contenido del mensaje es requerido' }, { status: 400 })
  }

  const metadataWithControl = mergeRecipientControlMetadata(
    body.metadata ? JSON.stringify(body.metadata) : null,
    {
      includeUserIds: Array.isArray(body.includeUserIds) ? body.includeUserIds : [],
      excludeUserIds: Array.isArray(body.excludeUserIds) ? body.excludeUserIds : [],
    }
  )
  const metadata = mergeCampaignAudienceMetadata(metadataWithControl, {
    partnerServiceIds: Array.isArray(body.partnerServiceIds) ? body.partnerServiceIds : [],
  })

  const campaign = await prisma.messagingCampaign.create({
    data: {
      name: String(body.name),
      channel: body.channel as MessagingChannel,
      status: (body.status as MessagingCampaignStatus) || 'DRAFT',
      templateId: body.templateId || null,
      targetRole: body.targetRole ? (body.targetRole as UserRole) : null,
      targetCity: body.targetCity ? (body.targetCity as City) : null,
      customSubject: finalSubject,
      customBody: finalBody,
      abTestEnabled: Boolean(body.abTestEnabled),
      abTestConfig: body.abTestConfig ? JSON.stringify(body.abTestConfig) : null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      createdById: admin.id,
      metadata,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_campaign.create',
    entityType: 'MessagingCampaign',
    entityId: campaign.id,
    route: '/api/admin/messaging/campaigns',
    details: campaign.name,
    request,
  })

  return NextResponse.json({ campaign }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const current = await prisma.messagingCampaign.findUnique({
    where: { id: body.id },
    select: { id: true, metadata: true },
  })
  if (!current) return NextResponse.json({ error: 'campaign no encontrada' }, { status: 404 })

  const metadata =
    body.metadata !== undefined ||
    body.includeUserIds !== undefined ||
    body.excludeUserIds !== undefined ||
    body.partnerServiceIds !== undefined
      ? mergeCampaignAudienceMetadata(
          mergeRecipientControlMetadata(
          body.metadata ? JSON.stringify(body.metadata) : current.metadata,
          {
            includeUserIds: Array.isArray(body.includeUserIds)
              ? body.includeUserIds
              : parseRecipientControl(current.metadata).includeUserIds,
            excludeUserIds: Array.isArray(body.excludeUserIds)
              ? body.excludeUserIds
              : parseRecipientControl(current.metadata).excludeUserIds,
          }),
          {
            partnerServiceIds: Array.isArray(body.partnerServiceIds)
              ? body.partnerServiceIds
              : parseCampaignAudience(current.metadata).partnerServiceIds,
          },
        )
      : undefined

  const campaign = await prisma.messagingCampaign.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.status !== undefined ? { status: body.status as MessagingCampaignStatus } : {}),
      ...(body.templateId !== undefined ? { templateId: body.templateId || null } : {}),
      ...(body.targetRole !== undefined ? { targetRole: body.targetRole ? (body.targetRole as UserRole) : null } : {}),
      ...(body.targetCity !== undefined ? { targetCity: body.targetCity ? (body.targetCity as City) : null } : {}),
      ...(body.customSubject !== undefined ? { customSubject: body.customSubject || null } : {}),
      ...(body.customBody !== undefined ? { customBody: String(body.customBody) } : {}),
      ...(body.abTestEnabled !== undefined ? { abTestEnabled: Boolean(body.abTestEnabled) } : {}),
      ...(body.abTestConfig !== undefined ? { abTestConfig: body.abTestConfig ? JSON.stringify(body.abTestConfig) : null } : {}),
      ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_campaign.update',
    entityType: 'MessagingCampaign',
    entityId: campaign.id,
    route: '/api/admin/messaging/campaigns',
    details: campaign.name,
    request,
  })

  return NextResponse.json({ campaign })
}
