import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getWorkspaceAccess } from '@/lib/workspaces'
import { computeInboxMetrics } from '@/lib/inbox/metrics'
import { parseChannel, parsePeriod } from '@/lib/inbox/metrics-core'

/** ?days=7|30|90&channel=WHATSAPP… — first response (AI / person), resolution, handoffs, CSAT, conversion, people and agents. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getWorkspaceAccess(admin)
  const sp = request.nextUrl.searchParams
  const metrics = await computeInboxMetrics({ days: parsePeriod(sp.get('days')), channel: parseChannel(sp.get('channel')), workspaceIds: access.workspaceIds })
  return NextResponse.json(metrics)
}
