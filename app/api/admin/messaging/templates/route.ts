import { NextRequest, NextResponse } from 'next/server'
import type { MessagingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.messagingTemplate.findMany({
    orderBy: [{ channel: 'asc' }, { updatedAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()

  if (!body?.key || !body?.name || !body?.channel || !body?.body) {
    return NextResponse.json({ error: 'key, name, channel y body requeridos' }, { status: 400 })
  }

  const template = await prisma.messagingTemplate.create({
    data: {
      key: String(body.key).trim(),
      name: String(body.name).trim(),
      channel: body.channel as MessagingChannel,
      subject: body.subject ? String(body.subject) : null,
      body: String(body.body),
      isActive: body.isActive ?? true,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_template.create',
    entityType: 'MessagingTemplate',
    entityId: template.id,
    route: '/api/admin/messaging/templates',
    details: template.key,
    request,
  })

  return NextResponse.json({ template }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const template = await prisma.messagingTemplate.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.subject !== undefined ? { subject: body.subject ? String(body.subject) : null } : {}),
      ...(body.body !== undefined ? { body: String(body.body) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata ? JSON.stringify(body.metadata) : null } : {}),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_template.update',
    entityType: 'MessagingTemplate',
    entityId: template.id,
    route: '/api/admin/messaging/templates',
    details: template.key,
    request,
  })

  return NextResponse.json({ template })
}
