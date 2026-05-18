import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import {
  ensureDefaultNotificationEmailTemplates,
  resetTemplatesCache,
  DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES,
} from '@/lib/notifications/email-templates'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PUT /api/admin/notifications/email-templates/seed
// Force-upserts all default templates, resetting the in-memory cache first.
export async function PUT() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  resetTemplatesCache()
  await ensureDefaultNotificationEmailTemplates()

  const templates = await (prisma as any).notificationEmailTemplate.findMany({
    orderBy: [{ channel: 'asc' }, { notificationType: 'asc' }],
  })

  return NextResponse.json({
    ok: true,
    seeded: DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES.length,
    total: templates.length,
  })
}
