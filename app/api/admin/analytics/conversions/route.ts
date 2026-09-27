import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { ConversionSettingsError, conversionStats, getConversionSettings, saveConversionSettings } from '@/lib/analytics/conversions'

export const dynamic = 'force-dynamic'

/** Meta pixel / Conversions API and GA4 Measurement Protocol: anyone in the admin sees the state; secrets never go back. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const [s, stats] = await Promise.all([getConversionSettings(true), conversionStats(30)])
  return NextResponse.json({
    metaPixelId: s.metaPixelId,
    metaTokenSet: Boolean(s.metaToken),
    metaTestEventCode: s.metaTestEventCode,
    metaWabaId: s.metaWabaId,
    ga4MeasurementId: s.ga4MeasurementId,
    ga4ApiSecretSet: Boolean(s.ga4ApiSecret),
    // The providers' error text only for the superadmin
    stats: admin.isSuperAdmin ? stats : { ...stats, lastFailed: stats.lastFailed ? { ...stats.lastFailed, detail: 'Error al enviar (detalle solo para superadmin)' } : null },
    canEdit: Boolean(admin.isSuperAdmin),
  })
}

const FIELDS = ['metaPixelId', 'metaToken', 'metaTestEventCode', 'metaWabaId', 'ga4MeasurementId', 'ga4ApiSecret'] as const

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin conecta las conversiones' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const input: Record<string, string | null> = {}
  for (const f of FIELDS) if (typeof body[f] === 'string' || body[f] === null) input[f] = body[f]
  try {
    await saveConversionSettings(input, admin.email)
  } catch (err) {
    return NextResponse.json({ error: err instanceof ConversionSettingsError ? err.message : 'No se pudo guardar' }, { status: 400 })
  }
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'ANALYTICS_CONVERSIONS_UPDATE', entityType: 'AnalyticsSettings', entityId: 'platform', details: `campos: ${Object.keys(input).join(', ')}`, request })
  return GET()
}
