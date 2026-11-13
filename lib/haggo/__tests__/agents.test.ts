import { describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ note: null as Record<string, unknown> | null, update: [] as unknown[] }))
const bus = vi.hoisted(() => ({ postNote: vi.fn(async (_i: unknown) => ({ ok: true as const, id: 'note_abcdef' })), resolveNote: vi.fn(async () => true) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentNote: {
      findUnique: async () => db.note,
      updateMany: async (a: unknown) => { db.update.push(a); return { count: 1 } },
    },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/agents/live', () => ({ agentsLive: async () => [] }))
vi.mock('@/lib/agents/bus', () => ({ postNote: bus.postNote, resolveNote: bus.resolveNote, markRead: async () => {}, openNotesFor: async () => [], busOverview: async () => ({ tablesReady: false, open: [], recent: [], flows7d: [] }) }))

import { buildAgentsSnapshot } from '@/lib/haggo/agents-view'
import { getAction } from '@/lib/haggo/actions/registry'
import { REVIEW_CHECKLIST, SYSTEM_PROMPT } from '@/lib/haggo/prompt'
import { PLATFORM_CHANGELOG } from '@/lib/haggo/platform-facts'
import { READ_TOOLS } from '@/lib/haggo/tools/read'
import { registryText } from '@/lib/agents/registry'

describe('foto de agentes', () => {
  it('cuenta las notas de Haggo, las de prioridad alta y la más vieja de otros', () => {
    const now = new Date('2026-11-13T12:00:00Z')
    const open = [
      { toAgent: 'haggo', priority: 'high', _count: { _all: 2 }, _min: { createdAt: new Date('2026-11-01T00:00:00Z') } },
      { toAgent: 'haggo', priority: 'normal', _count: { _all: 1 }, _min: { createdAt: new Date('2026-11-12T00:00:00Z') } },
      { toAgent: 'seo', priority: 'normal', _count: { _all: 4 }, _min: { createdAt: new Date('2026-11-10T12:00:00Z') } },
    ]
    const live = [{ key: 'seo' as const, status: 'ok' as const, headline: 'x' }, { key: 'inbox' as const, status: 'attention' as const, headline: 'sin agentes' }]
    expect(buildAgentsSnapshot({ tablesReady: true, open } as never, live, now)).toEqual({ notesOpenForHaggo: 3, notesHigh: 2, oldestOpenHours: 72, attention: [{ key: 'inbox', headline: 'sin agentes' }], tablesReady: true })
    expect(buildAgentsSnapshot({ tablesReady: false, open: [] } as never, [], now)).toMatchObject({ tablesReady: false, oldestOpenHours: null })
  })
})

describe('acciones agents.*', () => {
  const post = getAction('agents.post_note')!
  const resolve = getAction('agents.resolve_note')!

  it('están registradas, son de riesgo bajo y de agentes IA', () => {
    for (const a of [post, resolve]) { expect(a.risk).toBe('low'); expect(a.domain).toBe('ai_agents'); expect(a.undo).toBeDefined(); expect(a.unchanged).toBeDefined() }
  })

  it('post_note: parse valida destinatario, tema y tipo', () => {
    const good = { toAgent: 'marketing', topic: 'alert', kind: 'alert', title: 'Plomería sin socios hoy en Bello', body: 'Detalle' }
    expect(post.parse(good)).toMatchObject({ ok: true, params: { toAgent: 'marketing', body: 'Detalle' } })
    expect(post.parse({ ...good, toAgent: 'nadie' }).ok).toBe(false)
    expect(post.parse({ ...good, topic: 'answer' }).ok).toBe(false)
    expect(post.parse({ ...good, kind: 'otra' }).ok).toBe(false)
    expect(post.parse({ ...good, title: 'ab' }).ok).toBe(false)
    expect(post.parse({ ...good, body: undefined })).toMatchObject({ ok: true })
  })

  it('post_note: no a haggo, sí a otros; ejecuta con fromAgent haggo; undo expira solo si sigue abierta', async () => {
    const p = (post.parse({ toAgent: 'seo', topic: 'content_request', kind: 'request', title: 'Falta una guía' }) as unknown as { params: never }).params
    expect(await post.preconditions({ ...(p as object), toAgent: 'haggo' } as never)).toMatchObject({ ok: false })
    expect(await post.preconditions({ ...(p as object), toAgent: 'zzz' } as never)).toMatchObject({ ok: false })
    const pre = await post.preconditions(p)
    expect(pre).toMatchObject({ ok: true })
    const r = await post.execute(p, { actionId: 'a', approverId: 'u', approverEmail: null }, (pre as { before: unknown }).before)
    expect(bus.postNote).toHaveBeenCalledWith(expect.objectContaining({ fromAgent: 'haggo', toAgent: 'seo', topic: 'content_request' }))
    expect(r.after).toEqual({ noteId: 'note_abcdef', duplicate: false })
    db.update.length = 0
    await post.undo!(p, null, r.after)
    expect(db.update[0]).toMatchObject({ where: { id: 'note_abcdef', status: 'open' }, data: { status: 'expired' } })
  })

  it('resolve_note: solo notas abiertas para Haggo o para todos', async () => {
    const p = { noteId: 'note_123456' }
    expect(resolve.parse({}).ok).toBe(false)
    db.note = null
    expect(await resolve.preconditions(p)).toMatchObject({ ok: false })
    db.note = { title: 'Aviso', status: 'done', toAgent: 'haggo', fromAgent: 'seo' }
    expect(await resolve.preconditions(p)).toMatchObject({ ok: false })
    db.note = { title: 'Aviso', status: 'open', toAgent: 'marketing', fromAgent: 'seo' }
    expect(await resolve.preconditions(p)).toMatchObject({ ok: false })
    db.note = { title: 'Aviso', status: 'open', toAgent: 'haggo', fromAgent: 'seo' }
    expect(await resolve.preconditions(p)).toMatchObject({ ok: true })
    await resolve.execute(p, { actionId: 'a', approverId: 'u', approverEmail: null }, null)
    expect(bus.resolveNote).toHaveBeenCalledWith('note_123456', 'haggo')
  })
})

describe('conciencia del equipo', () => {
  it('la herramienta agentes existe y está en el checklist', () => {
    expect(READ_TOOLS.agentes).toBeDefined()
    expect(REVIEW_CHECKLIST.flatMap((c) => c.tools)).toContain('agentes')
  })

  it('sin tablas, la herramienta degrada y lista al equipo completo', async () => {
    const out = JSON.parse(JSON.stringify(await READ_TOOLS.agentes.run({}))) as { equipo: Array<{ clave: string }>; tablon: { tablas_listas: boolean } }
    expect(out.tablon.tablas_listas).toBe(false)
    expect(out.equipo.map((a) => a.clave)).toContain('seo')
  })

  it('el prompt incluye al equipo y la novedad de agentes va de primera', () => {
    expect(SYSTEM_PROMPT).toContain(registryText())
    expect(SYSTEM_PROMPT).toContain('agents.post_note')
    expect(PLATFORM_CHANGELOG[0]).toMatchObject({ date: '2026-11-13', area: 'Agentes' })
    expect(PLATFORM_CHANGELOG.length).toBeLessThanOrEqual(15)
  })
})
