import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getSeoSettings, saveSeoSettings } from '@/lib/seo/agent/settings'
import { DEFAULT_SEO_CONFIG } from '@/lib/seo/agent/settings-core'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ config: await getSeoSettings(), defaults: DEFAULT_SEO_CONFIG, canEdit: Boolean(admin.isSuperAdmin) })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede cambiar la configuración del agente de SEO' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const raw = body && typeof body === 'object' && 'config' in body ? (body as { config: unknown }).config : body
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 })
  const before = await getSeoSettings()
  try {
    const config = await saveSeoSettings(raw, admin.email)
    await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'SEO_SETTINGS_UPDATED', entityType: 'SeoSettings', entityId: 'platform', route: '/api/admin/seo/settings', details: JSON.stringify({ before, after: config }).slice(0, 4000), request })
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar. ¿Ya se aplicó el SQL del agente de SEO en Supabase?' }, { status: 500 })
  }
}
