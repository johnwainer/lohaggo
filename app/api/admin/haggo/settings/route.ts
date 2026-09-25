import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { getHaggoConfig, saveHaggoConfig } from '@/lib/haggo/store'
import { MAX_RISK_ACTION_IDS, actionsByDomain, sanitizeMaxRisk } from '@/lib/haggo/actions/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json({ config: await getHaggoConfig(), actionsByDomain: actionsByDomain(), maxRiskActions: MAX_RISK_ACTION_IDS })
}

/** Partial update; anything invalid keeps its previous value. Every change is audited. */
export async function PUT(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const before = await getHaggoConfig()
  // Only real max-risk actions of the registry can be turned on
  const patch = { ...(body as Record<string, unknown>) }
  if ('maxRiskEnabled' in patch) patch.maxRiskEnabled = sanitizeMaxRisk(patch.maxRiskEnabled)
  const config = await saveHaggoConfig(patch, auth.admin.email)
  const changed = Object.keys(config).filter((k) => JSON.stringify(config[k as keyof typeof config]) !== JSON.stringify(before[k as keyof typeof before]))
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_SETTINGS_UPDATE', entityType: 'HaggoSettings', entityId: 'platform', details: JSON.stringify({ changed, enabled: config.enabled, mode: config.mode }), request })
  return NextResponse.json({ ok: true, config })
}
