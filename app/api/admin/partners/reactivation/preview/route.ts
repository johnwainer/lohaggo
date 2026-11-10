import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { previewPartnerReactivation } from '@/lib/partners/reactivation'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const logger = createLogger('admin-partner-reactivation-preview')

/** Dry run: who gets what next, counts per segment and action. Sends nothing. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await previewPartnerReactivation())
  } catch (err) {
    logger.error('Reactivation preview failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'No se pudo calcular la vista previa' }, { status: 500 })
  }
}
