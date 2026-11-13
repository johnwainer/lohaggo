import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { AGENTS } from '@/lib/agents/registry'
import { agentsLive } from '@/lib/agents/live'
import { busOverview } from '@/lib/agents/bus'

export const dynamic = 'force-dynamic'

/** The agent team: registry + live state + note traffic. Every admin reads it; only a superadmin edits. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [live, bus] = await Promise.all([agentsLive(), busOverview()])
  const byKey = new Map(live.map((l) => [l.key, l]))
  const agents = AGENTS.map((a) => ({ ...a, live: byKey.get(a.key) ?? { key: a.key, status: 'unknown' as const, headline: 'Sin datos', details: [] } }))
  return NextResponse.json(JSON.parse(JSON.stringify({ agents, bus, canEdit: Boolean(admin.isSuperAdmin) })))
}
