import { beforeEach, describe, expect, it, vi } from 'vitest'

const openNotesFor = vi.fn()
vi.mock('@/lib/agents/bus', () => ({ openNotesFor: (...a: unknown[]) => openNotesFor(...a) }))

import { buildSystem } from '@/lib/ai/prompt'
import { peerNotesFor, resetPeerNotesCache } from '@/lib/ai/peer-notes'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const agent = { name: 'Sofía', goal: 'Agendar', instructions: 'x', tone: 'Cercano', language: 'auto', handoffOnUnknown: true, ignoreSpam: true, signatureMode: 'off', signatureText: null }
const base = {
  knowledge: { mode: 'none' as const, chunks: [] },
  nowText: 'lunes', timezone: 'America/Bogota', channel: 'WHATSAPP',
  contact: { name: null, tags: [], fields: {}, linkedUser: false }, summary: null, toolGuidance: '',
} as Parameters<typeof buildSystem>[1]

const note = { id: 'n1', fromAgent: 'seo', toAgent: null, topic: 'new_guide', kind: 'insight', title: 'Guía nueva: cerraduras', body: 'https://lohaggo.com/guias/cerraduras', priority: 'normal', createdAt: new Date() }

describe('peerNotes en buildSystem', () => {
  it('incluye el bloque como parte dinámica, no cacheada', () => {
    const blocks = buildSystem(agent, { ...base, peerNotes: '<datos>NOTA-X</datos>' })
    const i = blocks.findIndex((b) => b.text.includes('NOTA-X'))
    expect(i).toBeGreaterThan(2)
    expect(blocks[i].cache_control).toBeUndefined()
    expect(blocks[i].text).toContain('solo si vienen al caso')
    expect(blocks.filter((b) => b.cache_control).every((b) => !b.text.includes('NOTA-X'))).toBe(true)
  })
  it('sin peerNotes no agrega nada', () => {
    const blocks = buildSystem(agent, base)
    expect(blocks.map((b) => b.text).join('\n')).not.toContain('otros agentes')
    expect(blocks).toHaveLength(4)
  })
})

describe('peerNotesFor', () => {
  beforeEach(() => { openNotesFor.mockReset(); resetPeerNotesCache() })
  it('formatea sin marcar leído y cachea 5 minutos', async () => {
    openNotesFor.mockResolvedValue([note])
    const a = await peerNotesFor(1000)
    expect(a).toContain('Guía nueva: cerraduras')
    await peerNotesFor(1000 + 60_000)
    expect(openNotesFor).toHaveBeenCalledTimes(1)
    await peerNotesFor(1000 + 6 * 60_000)
    expect(openNotesFor).toHaveBeenCalledTimes(2)
  })
  it('falla en silencio', async () => {
    openNotesFor.mockRejectedValue(new Error('x'))
    expect(await peerNotesFor()).toBeUndefined()
  })
  it('sin notas devuelve undefined', async () => {
    openNotesFor.mockResolvedValue([])
    expect(await peerNotesFor()).toBeUndefined()
  })
})

describe('copiloto y comentarios no reciben notas', () => {
  it('runtime solo las pide sin copilot ni comment', () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/ai/runtime.ts'), 'utf8')
    expect(src).toMatch(/!opts\.copilot && !opts\.comment \? await peerNotesFor\(\)/)
  })
  it('los demás llamadores de buildSystem no pasan peerNotes', () => {
    for (const f of ['autopilot.ts', 'funnel.ts', 'copilot.ts', 'comments.ts']) {
      expect(readFileSync(path.join(process.cwd(), 'lib/ai', f), 'utf8')).not.toContain('peerNotes')
    }
  })
})
