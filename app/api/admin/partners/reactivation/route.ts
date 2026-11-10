import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getReactivationSettings, getReactivationSettingsMeta, saveReactivationSettings } from '@/lib/partners/reactivation-settings'
import { DEFAULT_REACTIVATION_CONFIG } from '@/lib/partners/reactivation-core'

export const dynamic = 'force-dynamic'

/** Every admin reads it; only a superadmin changes it. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const meta = await getReactivationSettingsMeta()
  return NextResponse.json({ config: meta.value, defaults: DEFAULT_REACTIVATION_CONFIG, updatedAt: meta.updatedAt, updatedByEmail: meta.updatedByEmail, canEdit: Boolean(admin.isSuperAdmin) })
}

async function save(request: NextRequest, raw: unknown, action: string) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede cambiar la campaña de reactivación' }, { status: 403 })
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 })
  const before = await getReactivationSettings()
  try {
    const config = await saveReactivationSettings(raw, admin.email)
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action, entityType: 'PartnerReactivationSettings', entityId: 'platform',
      route: '/api/admin/partners/reactivation', details: JSON.stringify({ before, after: config }).slice(0, 4000), request,
    })
    return NextResponse.json({ config })
  } catch {
    // Most likely the PartnerReactivationSettings table does not exist yet (SQL not applied)
    return NextResponse.json({ error: 'No se pudo guardar. ¿Ya se aplicó el SQL de PartnerReactivationSettings en Supabase? Mientras tanto la campaña usa los valores por defecto.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const raw = body && typeof body === 'object' && 'config' in body ? (body as { config: unknown }).config : body
  return save(request, raw, 'PARTNER_REACTIVATION_SETTINGS_UPDATED')
}

/** The pause switch: `{ paused: boolean }` keeps the rest of the config. */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof (body as { paused?: unknown }).paused !== 'boolean') {
    return NextResponse.json({ error: 'Envía { paused: true | false }' }, { status: 400 })
  }
  const current = await getReactivationSettings()
  const paused = (body as { paused: boolean }).paused
  return save(request, { ...current, paused }, paused ? 'PARTNER_REACTIVATION_PAUSED' : 'PARTNER_REACTIVATION_RESUMED')
}
