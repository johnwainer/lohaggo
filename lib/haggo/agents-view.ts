import type { busOverview } from '@/lib/agents/bus'
import type { AgentLive } from '@/lib/agents/live'

export type AgentsSnapshot = {
  /** Open, unexpired notes addressed to Haggo and how many of them are high priority */
  notesOpenForHaggo: number
  notesHigh: number
  /** Hours since the oldest open note addressed to an agent other than Haggo (null when there is none) */
  oldestOpenHours: number | null
  /** Agents whose live state is «attention» (numbers only, never customer text) */
  attention: Array<{ key: string; headline: string }>
  tablesReady: boolean
}

type Overview = Pick<Awaited<ReturnType<typeof busOverview>>, 'open' | 'tablesReady'>

/** Pure: the compact picture of the agent team for the snapshot. */
export function buildAgentsSnapshot(bus: Overview, live: Array<Pick<AgentLive, 'key' | 'status' | 'headline'>>, now = new Date()): AgentsSnapshot {
  const forHaggo = bus.open.filter((o) => o.toAgent === 'haggo')
  const others = bus.open.filter((o) => o.toAgent && o.toAgent !== 'haggo')
  const oldest = others.map((o) => o._min.createdAt?.getTime()).filter((t): t is number => typeof t === 'number')
  return {
    notesOpenForHaggo: forHaggo.reduce((a, o) => a + o._count._all, 0),
    notesHigh: forHaggo.filter((o) => o.priority === 'high').reduce((a, o) => a + o._count._all, 0),
    oldestOpenHours: oldest.length ? Math.max(0, Math.round((now.getTime() - Math.min(...oldest)) / 3_600_000)) : null,
    attention: live.filter((l) => l.status === 'attention').map((l) => ({ key: l.key, headline: l.headline.slice(0, 160) })),
    tablesReady: bus.tablesReady,
  }
}
