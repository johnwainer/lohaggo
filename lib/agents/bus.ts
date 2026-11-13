/**
 * The agent bus: post a note, read what is addressed to you, answer, resolve. Never throws into an agent's run
 * (a missing table or a database blip only means «no notes»): sharing information must not break an agent.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { DAILY_POSTS_PER_AUTHOR, OPEN_PER_READER, notesPromptBlock, prepareNote, sortNotes, type NoteInput, type NoteView } from '@/lib/agents/bus-core'
import { getAgent, type AgentKey } from '@/lib/agents/registry'

const logger = createLogger('agent-bus')
const DAY = 86_400_000

export type PostResult = { ok: true; id: string; duplicate?: boolean } | { ok: false; error: string }

/** Leaves a note. A repeated dedupeKey does nothing (returns the existing id). Limits per author and per reader. */
export async function postNote(input: NoteInput, now = new Date()): Promise<PostResult> {
  const p = prepareNote(input, now)
  if (!p.ok) return p
  const n = p.note
  try {
    if (n.dedupeKey) {
      const dup = await prisma.agentNote.findUnique({ where: { dedupeKey: n.dedupeKey }, select: { id: true } })
      if (dup) return { ok: true, id: dup.id, duplicate: true }
    }
    const [today, held] = await Promise.all([
      prisma.agentNote.count({ where: { fromAgent: n.fromAgent, createdAt: { gte: new Date(now.getTime() - DAY) } } }),
      n.toAgent ? prisma.agentNote.count({ where: { toAgent: n.toAgent, status: 'open', expiresAt: { gt: now } } }) : Promise.resolve(0),
    ])
    if (today >= DAILY_POSTS_PER_AUTHOR) return { ok: false, error: 'Este agente ya dejó el máximo de notas de hoy' }
    if (held >= OPEN_PER_READER) return { ok: false, error: 'El destinatario ya tiene demasiadas notas sin atender' }
    const row = await prisma.agentNote.create({
      data: {
        fromAgent: n.fromAgent, fromRef: n.fromRef ?? null, toAgent: n.toAgent ?? null, topic: n.topic, kind: n.kind, title: n.title, body: n.body,
        data: n.data ? (n.data as Prisma.InputJsonValue) : undefined, priority: n.priority, dedupeKey: n.dedupeKey, inReplyTo: n.inReplyTo ?? null, expiresAt: n.expiresAt,
      },
      select: { id: true },
    })
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: true, id: '', duplicate: true }
    logger.warn('Note not posted', { from: input.fromAgent, err: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: 'No se pudo dejar la nota' }
  }
}

const select = { id: true, fromAgent: true, toAgent: true, topic: true, kind: true, title: true, body: true, priority: true, createdAt: true, data: true } as const

/** Open notes for a reader: addressed to it or to everyone, not expired, and (for broadcasts) not read by it yet. */
export async function openNotesFor(reader: AgentKey, opts: { topics?: string[]; limit?: number; now?: Date } = {}): Promise<NoteView[]> {
  const now = opts.now ?? new Date()
  try {
    const rows = await prisma.agentNote.findMany({
      where: {
        status: 'open', expiresAt: { gt: now }, fromAgent: { not: reader },
        OR: [{ toAgent: reader }, { toAgent: null, NOT: { readBy: { has: reader } } }],
        ...(opts.topics?.length ? { topic: { in: opts.topics } } : {}),
      },
      orderBy: { createdAt: 'desc' }, take: 50, select,
    })
    // Priority first over the 50 newest, so a flood of low-priority notes cannot hide an important one
    return sortNotes(rows).slice(0, Math.min(50, opts.limit ?? 20))
  } catch {
    return []
  }
}

/** Marks notes as read by this reader (a broadcast stops showing to it; a directed one stays open until resolved). */
export async function markRead(reader: AgentKey, ids: string[]) {
  if (!ids.length) return
  try {
    await Promise.all(ids.map((id) => prisma.agentNote.updateMany({ where: { id, NOT: { readBy: { has: reader } } }, data: { readBy: { push: reader } } })))
  } catch { /* the note simply shows once more */ }
}

/** The prompt block for an agent (and marks those notes read). Null when there is nothing to say. */
export async function notesBlock(reader: AgentKey, opts: { topics?: string[]; limit?: number } = {}): Promise<string | null> {
  const notes = await openNotesFor(reader, { ...opts, limit: opts.limit ?? 8 })
  if (!notes.length) return null
  await markRead(reader, notes.map((n) => n.id))
  return notesPromptBlock(reader, notes, (k) => getAgent(k)?.name ?? k)
}

/** The reader handled it: closes a directed note (and can leave an answer addressed to the author). */
export async function resolveNote(id: string, by: AgentKey, answer?: { title: string; body?: string | null }) {
  try {
    const note = await prisma.agentNote.findUnique({ where: { id }, select: { id: true, fromAgent: true, topic: true, status: true, toAgent: true } })
    if (!note || note.status !== 'open') return false
    // Only the addressee closes a note (a broadcast is never closed by one reader)
    if (note.toAgent !== by) return false
    await prisma.agentNote.update({ where: { id }, data: { status: 'done', resolvedAt: new Date(), resolvedBy: by } })
    if (answer && note.fromAgent !== by) await postNote({ fromAgent: by, toAgent: note.fromAgent as AgentKey, topic: 'answer', kind: 'answer', title: answer.title, body: answer.body ?? null, inReplyTo: id, ttlDays: 7 })
    return true
  } catch {
    return false
  }
}

/** Expired notes close; old closed ones go after 60 days. Cheap: safe to call from any cron. */
export async function sweepNotes(now = new Date()) {
  try {
    const expired = await prisma.agentNote.updateMany({ where: { status: 'open', expiresAt: { lte: now } }, data: { status: 'expired' } })
    const old = await prisma.agentNote.deleteMany({ where: { status: { in: ['done', 'expired'] }, createdAt: { lt: new Date(now.getTime() - 60 * DAY) } } })
    return { expired: expired.count, deleted: old.count }
  } catch {
    return { expired: 0, deleted: 0 }
  }
}

/** Traffic between agents for the panel and Haggo: open notes by reader, recent notes, and the oldest unattended one. */
export async function busOverview(now = new Date()) {
  try {
    const [open, recent, byPair] = await Promise.all([
      prisma.agentNote.groupBy({ by: ['toAgent', 'priority'], where: { status: 'open', expiresAt: { gt: now } }, _count: { _all: true }, _min: { createdAt: true } }),
      prisma.agentNote.findMany({ orderBy: { createdAt: 'desc' }, take: 40, select: { ...select, status: true, readBy: true, resolvedBy: true } }),
      prisma.agentNote.groupBy({ by: ['fromAgent', 'toAgent'], where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }, _count: { _all: true } }),
    ])
    return { tablesReady: true as const, open, recent, flows7d: byPair.map((p) => ({ from: p.fromAgent, to: p.toAgent, count: p._count._all })) }
  } catch {
    return { tablesReady: false as const, open: [], recent: [], flows7d: [] }
  }
}
