import { getAgent } from '@/lib/agents/registry'
import { notesPromptBlock } from '@/lib/agents/bus-core'
import { openNotesFor } from '@/lib/agents/bus'

export const PEER_NOTE_TOPICS = ['new_guide', 'alert', 'answer', 'seo_guidance']
const PEER_NOTE_LIMIT = 5
const TTL_MS = 5 * 60_000
const TIMEOUT_MS = 1500

let cached: { at: number; block: string | null } | null = null

/** For tests. */
export function resetPeerNotesCache() {
  cached = null
}

/**
 * Notes from other agents for the inbox agent. Read WITHOUT marking them read (a broadcast must reach every
 * conversation of the period, not just the first one) and cached 5 minutes per instance. Never throws or waits long.
 */
export async function peerNotesFor(now = Date.now()): Promise<string | undefined> {
  if (cached && now - cached.at < TTL_MS) return cached.block ?? undefined
  try {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), TIMEOUT_MS) })
    const notes = await Promise.race([openNotesFor('inbox', { topics: PEER_NOTE_TOPICS, limit: PEER_NOTE_LIMIT }), timeout])
    clearTimeout(timer)
    if (!notes) return undefined // slow: no cache, the next turn tries again
    const block = notesPromptBlock('inbox', notes, (k) => getAgent(k)?.name ?? k)
    cached = { at: now, block }
    return block ?? undefined
  } catch {
    return undefined
  }
}
