import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getInboxSettings, saveInboxSettings } from '@/lib/inbox/settings'
import { DEFAULT_INBOX_CONFIG, sanitizeInboxConfig, waitingRuleOf } from '@/lib/inbox/settings-core'

/** Every admin reads it (the list colors «espera hace…» with it); only a superadmin edits it. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await getInboxSettings()
  return NextResponse.json({ config, defaults: DEFAULT_INBOX_CONFIG, waitingRule: waitingRuleOf(config), canEdit: Boolean(admin.isSuperAdmin) })
}

/** Paths whose submitted value (blank = default, not reported) was changed by the sanitizer (out of range, wrong type): shown to the admin. */
function adjustedPaths(raw: unknown, clean: unknown, prefix = ''): string[] {
  if (!clean || typeof clean !== 'object') return []
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.entries(clean as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') return adjustedPaths(r[k], v, path)
    if (!(k in r) || r[k] === '' || r[k] === null) return []
    const given = typeof v === 'number' && typeof r[k] === 'string' ? Number(r[k]) : r[k]
    return given === v ? [] : [path]
  })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede cambiar la configuración de la bandeja' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const raw = body && typeof body === 'object' && 'config' in body ? (body as { config: unknown }).config : body
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 })

  const before = await getInboxSettings()
  const adjusted = adjustedPaths(raw, sanitizeInboxConfig(raw))
  try {
    const config = await saveInboxSettings(raw, admin.email)
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action: 'INBOX_SETTINGS_UPDATED', entityType: 'InboxSettings', entityId: 'platform',
      route: '/api/admin/inbox/settings', details: JSON.stringify({ before, after: config }).slice(0, 4000), request,
    })
    return NextResponse.json({ config, waitingRule: waitingRuleOf(config), adjusted })
  } catch {
    // Most likely the InboxSettings table does not exist yet (SQL not applied)
    return NextResponse.json({ error: 'No se pudo guardar. ¿Ya se aplicó el SQL de InboxSettings en Supabase?' }, { status: 500 })
  }
}
