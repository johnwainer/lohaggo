import { NextRequest, NextResponse } from 'next/server'
import { marketingAuth, mkCan, mkWorkspacesWith } from '@/lib/marketing/permissions'
import { workspaceStats } from '@/lib/marketing/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const sp = request.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId')
  if (workspaceId && !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const to = sp.get('to') ? new Date(`${sp.get('to')}T23:59:59.999Z`) : new Date()
  const from = sp.get('from') ? new Date(`${sp.get('from')}T00:00:00.000Z`) : new Date(to.getTime() - 30 * 24 * 3600_000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  const workspaceIds = workspaceId ? [workspaceId] : mkWorkspacesWith(auth.access, 'marketing.view')
  return NextResponse.json(await workspaceStats({ workspaceIds, from, to, campaignId: sp.get('campaignId'), channel: sp.get('channel') }))
}
