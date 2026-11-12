import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { loadCoverage } from '@/lib/admin/coverage-matrix-data'

export const dynamic = 'force-dynamic'

/** Demand vs supply per service × city × zone (30/90 days) and the searches that found nothing. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await loadCoverage())
}
