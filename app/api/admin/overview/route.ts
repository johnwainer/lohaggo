import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'
import { platformOverview, type PlatformOverview } from '@/lib/admin/overview'

export const dynamic = 'force-dynamic'

const logger = createLogger('admin-overview')

/** Several screens (a TV, admins' laptops) refresh every 30 s: one computation serves them all for 15 s. */
let cache: { at: number; data: PlatformOverview } | null = null
let inflight: Promise<PlatformOverview> | null = null

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    if (!cache || Date.now() - cache.at > 15_000) {
      inflight ??= platformOverview().finally(() => { inflight = null })
      cache = { at: Date.now(), data: await inflight }
    }
    return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    logger.error('Overview failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'No se pudo cargar el resumen' }, { status: 500 })
  }
}
