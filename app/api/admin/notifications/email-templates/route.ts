import { NextRequest, NextResponse } from 'next/server'
import type { MessagingChannel, NotificationType, UserRole } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { ensureDefaultNotificationEmailTemplates } from '@/lib/notifications/email-templates'
import { prisma } from '@/lib/prisma'

const VALID_TYPES: NotificationType[] = [
  'NEW_SERVICE_REQUEST',
  'NEW_PROPOSAL',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_IN_PROGRESS',
  'BOOKING_COMPLETED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'ACHIEVEMENT_UNLOCKED',
  'NEW_MESSAGE',
]

const VALID_ROLES: Array<UserRole | null> = ['CLIENT', 'PARTNER', 'ADMIN', null]
const VALID_CHANNELS: MessagingChannel[] = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureDefaultNotificationEmailTemplates()
  const templates = await (prisma as any).notificationEmailTemplate.findMany({
    orderBy: [{ channel: 'asc' }, { notificationType: 'asc' }, { role: 'asc' }, { updatedAt: 'desc' }],
    take: 800,
  })

  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)

  if (!body?.key || !body?.name || !body?.notificationType || !body?.channel || !body?.bodyTemplate) {
    return NextResponse.json({ error: 'Campos requeridos: key, name, notificationType, channel, bodyTemplate' }, { status: 400 })
  }

  if (!VALID_TYPES.includes(body.notificationType as NotificationType)) {
    return NextResponse.json({ error: 'notificationType inválido' }, { status: 400 })
  }
  if (!VALID_CHANNELS.includes(body.channel as MessagingChannel)) {
    return NextResponse.json({ error: 'channel inválido' }, { status: 400 })
  }

  const role = body.role === '' || body.role === undefined ? null : (body.role as UserRole)
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role inválido' }, { status: 400 })
  }

  try {
    const template = await (prisma as any).notificationEmailTemplate.create({
      data: {
        key: String(body.key).trim(),
        name: String(body.name).trim(),
        notificationType: body.notificationType as NotificationType,
        channel: body.channel as MessagingChannel,
        role,
        subjectTemplate: body.subjectTemplate ? String(body.subjectTemplate) : null,
        bodyTemplate: String(body.bodyTemplate),
        bodyHtmlTemplate: body.bodyHtmlTemplate ? String(body.bodyHtmlTemplate) : null,
        bodyTextTemplate: body.bodyTextTemplate ? String(body.bodyTextTemplate) : null,
        isActive: body.isActive ?? true,
        updatedByEmail: admin.email,
        updatedById: admin.id,
      },
    })

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'notification_template.create',
      entityType: 'NotificationEmailTemplate',
      entityId: template.id,
      route: '/api/admin/notifications/email-templates',
      details: template.key,
      request,
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una plantilla con esta key o combinación tipo/canal/rol' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo crear plantilla' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)

  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  if (body.notificationType && !VALID_TYPES.includes(body.notificationType as NotificationType)) {
    return NextResponse.json({ error: 'notificationType inválido' }, { status: 400 })
  }
  if (body.channel && !VALID_CHANNELS.includes(body.channel as MessagingChannel)) {
    return NextResponse.json({ error: 'channel inválido' }, { status: 400 })
  }
  if (body.role !== undefined) {
    const role = body.role === '' ? null : (body.role as UserRole)
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'role inválido' }, { status: 400 })
    }
  }

  try {
    const template = await (prisma as any).notificationEmailTemplate.update({
      where: { id: body.id },
      data: {
        ...(body.key !== undefined ? { key: String(body.key).trim() } : {}),
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.notificationType !== undefined ? { notificationType: body.notificationType as NotificationType } : {}),
        ...(body.channel !== undefined ? { channel: body.channel as MessagingChannel } : {}),
        ...(body.role !== undefined ? { role: body.role === '' ? null : (body.role as UserRole) } : {}),
        ...(body.subjectTemplate !== undefined ? { subjectTemplate: body.subjectTemplate ? String(body.subjectTemplate) : null } : {}),
        ...(body.bodyTemplate !== undefined ? { bodyTemplate: String(body.bodyTemplate) } : {}),
        ...(body.bodyHtmlTemplate !== undefined ? { bodyHtmlTemplate: body.bodyHtmlTemplate ? String(body.bodyHtmlTemplate) : null } : {}),
        ...(body.bodyTextTemplate !== undefined ? { bodyTextTemplate: body.bodyTextTemplate ? String(body.bodyTextTemplate) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        updatedByEmail: admin.email,
        updatedById: admin.id,
      },
    })

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'notification_template.update',
      entityType: 'NotificationEmailTemplate',
      entityId: template.id,
      route: '/api/admin/notifications/email-templates',
      details: template.key,
      request,
    })

    return NextResponse.json({ template })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Conflicto de key o combinación tipo/canal/rol' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo actualizar plantilla' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const template = await (prisma as any).notificationEmailTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

  await (prisma as any).notificationEmailTemplate.delete({ where: { id } })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'notification_template.delete',
    entityType: 'NotificationEmailTemplate',
    entityId: id,
    route: '/api/admin/notifications/email-templates',
    details: template.key,
    request,
  })

  return NextResponse.json({ ok: true })
}
