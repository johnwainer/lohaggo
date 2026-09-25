import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { Ga4Error, getGa4Settings, saveGa4Settings } from '@/lib/analytics/ga4'

export const dynamic = 'force-dynamic'

/** GA4 connection: anyone in the admin sees whether it is set; only a superadmin changes it. The key never goes back to the browser. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const s = await getGa4Settings()
  return NextResponse.json({ propertyId: s.propertyId, serviceAccountEmail: s.account?.client_email ?? null, updatedByEmail: s.updatedByEmail, updatedAt: s.updatedAt, canEdit: Boolean(admin.isSuperAdmin) })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin conecta Google Analytics' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  try {
    await saveGa4Settings({
      propertyId: typeof body.propertyId === 'string' || body.propertyId === null ? body.propertyId : undefined,
      credentials: typeof body.credentials === 'string' || body.credentials === null ? body.credentials : undefined,
      email: admin.email,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Ga4Error ? err.message : 'No se pudo guardar' }, { status: 400 })
  }
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'ANALYTICS_GA4_UPDATE', entityType: 'AnalyticsSettings', entityId: 'platform', details: body.credentials === null ? 'credenciales quitadas' : 'actualizado', request })
  return GET()
}
