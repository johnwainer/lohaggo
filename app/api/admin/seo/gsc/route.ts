import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { Ga4Error, getGa4Settings, saveGa4Settings } from '@/lib/analytics/ga4'
import { fetchSearchConsole } from '@/lib/seo/agent/gsc'
import { getSeoSettings } from '@/lib/seo/agent/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function probe() {
  const [config, { account }] = await Promise.all([getSeoSettings(), getGa4Settings()])
  const r = await fetchSearchConsole(config.gsc.siteUrl, 28)
  return {
    serviceEmail: account?.client_email ?? null, siteUrl: config.gsc.siteUrl,
    test: r.ok ? { ok: true as const, message: `Conectado: ${r.rows.length} combinaciones de búsqueda y página entre ${r.from} y ${r.to}. Pulsa «Ejecutar ahora» para traer los datos al panel.`, rows: r.rows.length } : { ok: false as const, reason: r.reason, message: r.message },
  }
}

/** Is Search Console reachable with the connected Google account? (any admin) */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await probe())
}

/**
 * Connects the Google service account (the same one GA4 reads with; stored encrypted, never returned) and tests it.
 * Only a superadmin. The Analytics property id is left as it is: Search Console does not need it.
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin conecta la cuenta de Google' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (typeof body?.credentials !== 'string' || !body.credentials.trim()) return NextResponse.json({ error: 'Pega la clave JSON de la cuenta de servicio' }, { status: 400 })
  try {
    await saveGa4Settings({ credentials: body.credentials, email: admin.email })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Ga4Error ? err.message : 'No se pudo guardar' }, { status: 400 })
  }
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'SEO_GSC_CONNECT', entityType: 'AnalyticsSettings', entityId: 'platform', route: '/api/admin/seo/gsc', details: 'cuenta de servicio guardada', request })
  return NextResponse.json(await probe())
}
