import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { listGuaranteeClaims, guaranteeStats, type ClaimFilter } from '@/lib/guarantee/ops'
import { isGuaranteeType } from '@/lib/guarantee/policy'

const STATUS_FILTERS = ['active', 'overdue', 'closed', 'all', 'OPEN', 'REDO_SCHEDULED', 'REASSIGNED', 'REFUND_REVIEW', 'RESOLVED', 'REJECTED']

/** GET ?status=active|overdue|closed|all|<STATUS>&type=NO_SHOW|BAD_WORK|DAMAGE&partnerId= */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = request.nextUrl.searchParams
  const status = sp.get('status') ?? 'active'
  const type = sp.get('type')
  const filter: ClaimFilter = {
    status: (STATUS_FILTERS.includes(status) ? status : 'active') as ClaimFilter['status'],
    ...(type && isGuaranteeType(type) ? { type } : {}),
    ...(sp.get('partnerId') ? { partnerId: sp.get('partnerId')! } : {}),
  }
  try {
    const [claims, stats] = await Promise.all([listGuaranteeClaims(filter), guaranteeStats()])
    return NextResponse.json({ claims, stats })
  } catch {
    // Before the GuaranteeClaim SQL runs the table does not exist: an empty queue, not a 500
    return NextResponse.json({ claims: [], stats: { open: 0, overdue: 0, strikesLast90: 0, partnersAtLimit: [] }, unavailable: true })
  }
}
