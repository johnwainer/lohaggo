import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { partnerReactivationReport } from '@/lib/partners/reactivation'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const logger = createLogger('admin-partner-reactivation-report')

/** Per segment: eligible, enrolled, control; sends per step; conversions treatment vs control. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await partnerReactivationReport())
  } catch (err) {
    logger.error('Reactivation report failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'No se pudo calcular el reporte' }, { status: 500 })
  }
}
