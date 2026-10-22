import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getWorkspaceAccess } from '@/lib/workspaces'
import { computeInboxMetrics } from '@/lib/inbox/metrics'
import { parsePeriod } from '@/lib/inbox/metrics-core'

/** ?days=7|30 — first response, AI resolution, handoff reasons, reopened conversations and CSAT. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getWorkspaceAccess(admin)
  const metrics = await computeInboxMetrics(parsePeriod(request.nextUrl.searchParams.get('days')), access.workspaceIds)
  return NextResponse.json(metrics)
}
