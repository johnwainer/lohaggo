import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getWorkspaceAccess } from '@/lib/workspaces'
import { computeInboxMetrics } from '@/lib/inbox/metrics'
import { metricsToCsv, parseChannel, parsePeriod } from '@/lib/inbox/metrics-core'

/** CSV of the inbox metrics: aggregates with team members' and agents' names only, never contacts. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getWorkspaceAccess(admin)
  const sp = request.nextUrl.searchParams
  const days = parsePeriod(sp.get('days'))
  const channel = parseChannel(sp.get('channel'))
  const metrics = await computeInboxMetrics({ days, channel, workspaceIds: access.workspaceIds })
  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'INBOX_METRICS_EXPORT',
    entityType: 'Conversation',
    route: '/api/admin/inbox/metrics/export',
    details: JSON.stringify({ days, channel, conversations: metrics.conversations }),
    request,
  })
  const name = `metricas-bandeja-${days}d${channel ? `-${channel.toLowerCase()}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(metricsToCsv(metrics), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
