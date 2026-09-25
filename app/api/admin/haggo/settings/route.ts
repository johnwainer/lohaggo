import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { getHaggoConfig, saveHaggoConfig } from '@/lib/haggo/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json({ config: await getHaggoConfig() })
}

/** Partial update; anything invalid keeps its previous value. Every change is audited. */
export async function PUT(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const before = await getHaggoConfig()
  const config = await saveHaggoConfig(body as Record<string, unknown>, auth.admin.email)
  const changed = Object.keys(config).filter((k) => JSON.stringify(config[k as keyof typeof config]) !== JSON.stringify(before[k as keyof typeof before]))
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_SETTINGS_UPDATE', entityType: 'HaggoSettings', entityId: 'platform', details: JSON.stringify({ changed, enabled: config.enabled, mode: config.mode }), request })
  return NextResponse.json({ ok: true, config })
}
