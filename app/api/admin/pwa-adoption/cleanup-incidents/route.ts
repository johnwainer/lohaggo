import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { resolveAllPwaAlertIncidents } from '@/lib/pwa/adoption-alerts'

export const dynamic = 'force-dynamic'

/** Superadmin one-off: closes the open «pwa-adoption-alerts» incidents (the detector keeps one per condition from now on). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo el superadmin puede hacer esto' }, { status: 403 })
  const resolved = await resolveAllPwaAlertIncidents(admin.email ?? 'superadmin')
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'incident.pwa-cleanup', entityType: 'AdminIncident', route: '/api/admin/pwa-adoption/cleanup-incidents', details: `${resolved} incidentes cerrados`, request })
  return NextResponse.json({ ok: true, resolved })
}
