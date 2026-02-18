import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import {
  type NotificationAutomationTarget,
  getNotificationAutomationSnapshot,
  upsertNotificationAutomationConfig,
} from '@/lib/notifications/automation-config'

const VALID_TARGETS: NotificationAutomationTarget[] = ['GLOBAL', 'CLIENT', 'PARTNER', 'ADMIN']

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await getNotificationAutomationSnapshot()
  return NextResponse.json({ configs })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !VALID_TARGETS.includes(body.target)) {
    return NextResponse.json({ error: 'target inválido' }, { status: 400 })
  }

  const payload = {
    target: body.target as NotificationAutomationTarget,
    pushEnabled: Boolean(body.pushEnabled),
    emailEnabled: Boolean(body.emailEnabled),
    whatsappEnabled: Boolean(body.whatsappEnabled),
    smsEnabled: Boolean(body.smsEnabled),
    updatedByEmail: admin.email,
  }

  await upsertNotificationAutomationConfig(payload)

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'notifications_automation.update',
    entityType: 'NotificationAutomationConfig',
    entityId: payload.target,
    route: '/api/admin/notifications/automation',
    details: JSON.stringify(payload),
    request,
  })

  const configs = await getNotificationAutomationSnapshot()
  return NextResponse.json({ ok: true, configs })
}
