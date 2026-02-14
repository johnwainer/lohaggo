import { NextRequest, NextResponse } from 'next/server'
import type { City, MessagingCampaignStatus, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

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

  if (!body?.name || !body?.channel || !body?.customBody) {
    return NextResponse.json({ error: 'name, channel y customBody requeridos' }, { status: 400 })
  }

  const campaign = await prisma.messagingCampaign.create({
    data: {
      name: String(body.name),
      channel: body.channel as MessagingChannel,
      status: (body.status as MessagingCampaignStatus) || 'DRAFT',
      templateId: body.templateId || null,
      targetRole: body.targetRole ? (body.targetRole as UserRole) : null,
      targetCity: body.targetCity ? (body.targetCity as City) : null,
      customSubject: body.customSubject || null,
      customBody: String(body.customBody),
      abTestEnabled: Boolean(body.abTestEnabled),
      abTestConfig: body.abTestConfig ? JSON.stringify(body.abTestConfig) : null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      createdById: admin.id,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
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
      ...(body.metadata !== undefined ? { metadata: body.metadata ? JSON.stringify(body.metadata) : null } : {}),
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
