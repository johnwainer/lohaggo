import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  post: null as null | Record<string, unknown>,
  settings: null as null | Record<string, unknown>,
  reviews: [] as Array<Record<string, unknown>>,
  variantUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  lastEditor: null as null | Record<string, unknown>,
}))
const ai = vi.hoisted(() => ({ answers: [] as unknown[], calls: [] as Array<{ kind: string; model: string }> }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketingEditorialSettings: { findUnique: vi.fn(async () => db.settings) },
    marketingPost: {
      findUnique: vi.fn(async () => db.post),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { db.post = { ...db.post, ...data }; return db.post }),
    },
    marketingPostVariant: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        db.variantUpdates.push({ id: where.id, data })
        const p = db.post as { variants: Array<Record<string, unknown>> }
        p.variants = p.variants.map((v) => (v.id === where.id ? { ...v, ...data } : v))
      }),
    },
    marketingMedia: { updateMany: vi.fn(async () => ({ count: 1 })) },
    marketingReview: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { db.reviews.push(data); return data }), findFirst: vi.fn(async () => db.lastEditor) },
  },
}))
vi.mock('@/lib/ai/settings', () => ({ getAiSettings: vi.fn(async () => ({ defaultModel: 'claude-opus-5', fallbackModel: 'claude-haiku-4-5' })) }))
vi.mock('@/lib/marketing/agent-notices', () => ({ notify: vi.fn(), postUrl: (id: string) => `/p/${id}` }))
vi.mock('@/lib/ai/anthropic', () => ({
  describeApiError: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  callClaude: vi.fn(async (p: { model: string; tools: Array<{ name: string }> }, ctx: { kind: string }) => {
    ai.calls.push({ kind: ctx.kind, model: p.model })
    const input = ai.answers.shift()
    return {
      message: { stop_reason: 'tool_use', content: input === undefined ? [] : [{ type: 'tool_use', name: p.tools[0].name, input }] },
      model: p.model, provider: 'anthropic', usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0.01, latencyMs: 5,
    }
  }),
}))

import {
  activeCriteria,
  applyCorrections,
  collectTexts,
  contentHash,
  editorOutcome,
  gateReason,
  nextReviewStep,
  parseEditor,
  parseProofread,
  protectedTokens,
  type Correction,
} from '@/lib/marketing/editorial-core'
import { DEFAULT_EDITORIAL, defaultRubric, editorialFromRow, reviewApplies, sanitizeEditorial } from '@/lib/marketing/editorial-rubric'
import { editorialGate, latestEditorAsks, reviewPass, type ReviewEnv } from '@/lib/marketing/editorial'
import { nextAgentState } from '@/lib/marketing/agent-core'

const fix = (field: string, original: string, corrected: string): Correction => ({ field, channel: null, original, corrected, reason: 'test' })

describe('aplicar correcciones de ortografía', () => {
  const texts = { 'INSTAGRAM.body': 'Tambien arreglamos tu cocina en Bogota. Visita https://lohaggo.com/servicios y escribe a @lohaggo_ #hogar. Desde $80.000 COP.' }

  it('aplica solo fragmentos que existen tal cual y como palabra completa', () => {
    const r = applyCorrections(texts, [fix('INSTAGRAM.body', 'Tambien', 'También'), fix('INSTAGRAM.body', 'no existe', 'no existé'), fix('INSTAGRAM.body', 'ambie', 'ambié')], [])
    expect(r.texts['INSTAGRAM.body']).toMatch(/^También arreglamos/)
    expect(r.applied).toHaveLength(1)
    expect(r.rejected.map((x) => x.why)).toEqual(['El fragmento no está tal cual en el texto', 'El fragmento no está tal cual en el texto'])
  })

  it('nunca toca enlaces, menciones, hashtags ni cifras', () => {
    const r = applyCorrections(texts, [
      fix('INSTAGRAM.body', 'https://lohaggo.com/servicios', 'https://lohaggo.com/servicio'),
      fix('INSTAGRAM.body', '@lohaggo_', '@LoHaggo'),
      fix('INSTAGRAM.body', '#hogar', '#Hogar'),
      fix('INSTAGRAM.body', '$80.000 COP', '$90.000 COP'),
    ], [])
    expect(r.applied).toHaveLength(0)
    expect(r.texts).toEqual(texts)
    expect(r.rejected.every((x) => /enlace, una mención, un hashtag o una cifra/.test(x.why))).toBe(true)
  })

  it('no cambia palabras protegidas (catálogo, marca, lista del equipo)', () => {
    const r = applyCorrections(texts, [fix('INSTAGRAM.body', 'en Bogota.', 'en Bogotá.')], ['Bogota'])
    expect(r.applied).toHaveLength(0)
    expect(r.rejected[0].why).toMatch(/no se corrige/)
  })

  it('rechaza reescrituras disfrazadas de corrección y campos que no existen', () => {
    const r = applyCorrections(texts, [fix('INSTAGRAM.body', 'Tambien', 'Además de todo lo anterior también'), fix('FACEBOOK.body', 'Tambien', 'También')], [])
    expect(r.rejected.map((x) => x.why)).toEqual(['Reescribe en vez de corregir', 'Ese campo no existe'])
  })

  it('es idempotente: aplicar la misma lista dos veces no cambia nada más', () => {
    const list = [fix('INSTAGRAM.body', 'Tambien', 'También'), fix('INSTAGRAM.body', 'Bogota', 'Bogotá')]
    const once = applyCorrections(texts, list, [])
    const twice = applyCorrections(once.texts, list, [])
    expect(twice.texts).toEqual(once.texts)
    expect(twice.applied).toHaveLength(0)
  })

  it('una corrección que contiene el original (puntuación) tampoco se duplica', () => {
    const t = { title: 'Dime que si y listo' }
    const list = [fix('title', 'que', 'que,')]
    const once = applyCorrections(t, list, [])
    expect(once.texts.title).toBe('Dime que, si y listo')
    expect(applyCorrections(once.texts, list, []).texts.title).toBe('Dime que, si y listo')
  })

  it('no cambia el formato Markdown o HTML', () => {
    const r = applyCorrections({ title: 'Guia para tu hogar' }, [fix('title', 'Guia', '**Guía**'), fix('title', 'hogar', 'hogar <b>')], [])
    expect(r.applied).toHaveLength(0)
    expect(r.rejected.every((x) => /formato/.test(x.why))).toBe(true)
  })

  it('reconoce los tokens protegidos', () => {
    expect(protectedTokens('Ve a www.lohaggo.com o lohaggo.com/blog, 20 % off #promo @ana')).toEqual(['#promo', '%', '20', '@ana', 'lohaggo.com/blog', 'www.lohaggo.com'].sort())
  })
})

describe('textos y huella', () => {
  const post = {
    title: 'Pintura',
    variants: [{ channel: 'INSTAGRAM', body: 'Hola', linkUrl: null }, { channel: 'WEB', body: 'Artículo', seoTitle: 'SEO', seoDescription: 'Desc', excerpt: '', linkUrl: null }],
    media: [{ id: 'm1', alt: 'Una pared' }],
  }
  it('reúne título, textos por canal, SEO y alt con claves estables', () => {
    expect(collectTexts(post).map((t) => t.key)).toEqual(['title', 'WEB.body', 'WEB.seoTitle', 'WEB.seoDescription', 'INSTAGRAM.body', 'media.m1.alt'])
  })
  it('cualquier cambio de texto, alt o enlace cambia la huella', () => {
    const h = contentHash(post)
    expect(contentHash({ ...post })).toBe(h)
    expect(contentHash({ ...post, title: 'Pintura!' })).not.toBe(h)
    expect(contentHash({ ...post, media: [{ id: 'm1', alt: 'Otra' }] })).not.toBe(h)
    expect(contentHash({ ...post, variants: [{ ...post.variants[0], linkUrl: 'https://x.co' }, post.variants[1]] })).not.toBe(h)
  })
})

describe('respuestas de los revisores', () => {
  const criteria = activeCriteria(defaultRubric(), ['INSTAGRAM'])
  const all = (score: number) => criteria.map((c) => ({ id: c.id, puntaje: score, comentario: 'ok' }))

  it('el SEO solo cuenta cuando hay blog', () => {
    expect(criteria.some((c) => c.id === 'seo')).toBe(false)
    expect(activeCriteria(defaultRubric(), ['WEB']).some((c) => c.id === 'seo')).toBe(true)
  })

  it('valida puntajes de 0 a 10, veredicto y que pedir cambios traiga instrucciones', () => {
    expect(parseEditor({ criterios: all(9), veredicto: 'aprobada', resumen: 'Bien', instrucciones: [] }, criteria).ok).toBe(true)
    const bad = parseEditor({ criterios: [...all(9).slice(1), { id: criteria[0].id, puntaje: 11 }], veredicto: 'quizá', instrucciones: [] }, criteria)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/0 a 10.*veredicto/)
    const noAsk = parseEditor({ criterios: all(5), veredicto: 'cambios', resumen: '', instrucciones: [] }, criteria)
    expect(noAsk.ok).toBe(false)
  })

  it('el corrector puede no encontrar nada, pero debe entregar la lista', () => {
    const texts = collectTexts({ title: 'T', variants: [], media: [] })
    expect(parseProofread({ cambios: [] }, texts)).toEqual({ ok: true, value: [] })
    expect(parseProofread({}, texts).ok).toBe(false)
    const r = parseProofread({ cambios: [{ campo: 'title', original: 'T', corregido: 'Té', motivo: 'x' }, { campo: 'inventado', original: 'a', corregido: 'b' }] }, texts)
    expect(r.ok && r.value.map((c) => c.field)).toEqual(['title'])
  })

  it('el puntaje lo pondera el servidor; aprobar bajo el mínimo se vuelve pedido de cambios', () => {
    const p = parseEditor({ criterios: all(7), veredicto: 'aprobada', resumen: '', instrucciones: [] }, criteria)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const out = editorOutcome(p.value, criteria, 8)
    expect(out.result).toBe('changes')
    expect(out.score).toBe(7)
    expect(out.instructions.length).toBeGreaterThan(0)
    expect(editorOutcome(p.value, criteria, 7).result).toBe('approved')
  })
})

describe('rondas con el agente', () => {
  it('aprobada a la primera', () => expect(nextReviewStep('approved', 0, 2)).toBe('approved'))
  it('pide cambios: reescribe mientras queden rondas, luego va a una persona', () => {
    expect(nextReviewStep('changes', 0, 2)).toBe('rewrite')
    expect(nextReviewStep('changes', 1, 2)).toBe('rewrite')
    expect(nextReviewStep('changes', 2, 2)).toBe('human')
    expect(nextReviewStep('changes', 0, 0)).toBe('human')
  })
  it('rechazada: a una persona sin rondas', () => expect(nextReviewStep('rejected', 0, 2)).toBe('human'))

  it('retenida por el editor, la pieza queda en revisión humana en cualquier modo', () => {
    for (const mode of ['supervised', 'autopilot', 'copilot'] as const) {
      expect(nextAgentState('idea_accepted', 'drafted', mode, { valid: true, needsReview: true })?.state).toBe('review')
    }
    // Aprobada por el editor, el modo decide como hoy
    expect(nextAgentState('idea_accepted', 'drafted', 'autopilot', { valid: true, needsReview: false })?.actions).toContain('schedule')
  })
})

describe('candado antes de publicar', () => {
  const s = DEFAULT_EDITORIAL
  const agentPost = (reviewStatus: string | null, reviewHash: string | null) => ({ origin: 'agent', reviewStatus, reviewHash })

  it('pasa solo con una aprobación de exactamente estos textos', () => {
    expect(gateReason(s, agentPost('approved', 'h1'), 'h1')).toBeNull()
    expect(gateReason(s, agentPost('overridden', 'h1'), 'h1')).toBeNull()
    expect(gateReason(s, agentPost('approved', 'h1'), 'h2')).toMatch(/Cambió después/)
    expect(gateReason(s, agentPost(null, null), 'h1')).toMatch(/Falta la revisión/)
    expect(gateReason(s, agentPost('changes', 'h1'), 'h1')).toMatch(/pidió cambios/)
    expect(gateReason(s, agentPost('failed', 'h1'), 'h1')).toMatch(/Falta la revisión/)
  })

  it('con la revisión apagada, no obligatoria o fuera del alcance, el flujo es el de siempre', () => {
    expect(gateReason({ ...s, spellingEnabled: false, editorEnabled: false }, agentPost(null, null), 'h')).toBeNull()
    expect(gateReason({ ...s, required: false }, agentPost(null, null), 'h')).toBeNull()
    expect(gateReason(s, { origin: 'human', reviewStatus: null, reviewHash: null }, 'h')).toBeNull()
    expect(gateReason({ ...s, scope: 'all' }, { origin: 'human', reviewStatus: null, reviewHash: null }, 'h')).toMatch(/Falta/)
  })

  it('sin la tabla (antes del SQL) la revisión queda apagada y no bloquea', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.marketingEditorialSettings.findUnique).mockRejectedValueOnce(new Error('relation does not exist'))
    const post = { workspaceId: 'w', origin: 'agent', reviewStatus: null, reviewHash: null, title: 't', variants: [], media: [] }
    expect(await editorialGate(post as never)).toBeNull()
  })
})

describe('configuración', () => {
  it('acota y descarta lo inválido', () => {
    const s = sanitizeEditorial({ minScore: 42, maxRounds: -3, spellingLocale: 'klingon', scope: 'all', neverCorrect: ['LoHaggo', 'LoHaggo', 'x', 5], editorModel: 'rm -rf /', spellingModel: 'claude-sonnet-5', rubric: [{ id: 'hook', weight: 99, enabled: false }, { id: 'nope', weight: 1 }] })
    expect(s.minScore).toBe(10)
    expect(s.maxRounds).toBe(0)
    expect(s.spellingLocale).toBe('es-CO')
    expect(s.scope).toBe('all')
    expect(s.neverCorrect).toEqual(['LoHaggo'])
    expect(s.editorModel).toBeNull()
    expect(s.spellingModel).toBe('claude-sonnet-5')
    expect(sanitizeEditorial({ editorModel: 'modelo-sin-precio-1' }).editorModel).toBeNull()
    expect(s.rubric.find((r) => r.id === 'hook')).toEqual({ id: 'hook', weight: 5, enabled: false })
    expect(s.rubric).toHaveLength(8)
  })
  it('valores base: los dos encendidos, 8/10, 2 rondas, obligatoria, solo agentes', () => {
    const s = editorialFromRow(null)
    expect([s.spellingEnabled, s.editorEnabled, s.minScore, s.maxRounds, s.required, s.scope]).toEqual([true, true, 8, 2, true, 'agent'])
    expect(reviewApplies(s, 'agent')).toBe(true)
    expect(reviewApplies(s, 'human')).toBe(false)
  })
})

describe('una pasada de revisión (IA simulada)', () => {
  const env = (block: string | null = null): ReviewEnv => ({ workspaceId: 'w', agentId: 'a', brand: 'LoHaggo', treatment: 'tú', context: 'catálogo', protectedWords: ['Pintura'], trigger: 'agent', canSpend: async () => block })
  const editorAll = (score: number, verdict: string, instrucciones: unknown[] = []) => ({ criterios: activeCriteria(defaultRubric(), ['INSTAGRAM']).map((c) => ({ id: c.id, puntaje: score, comentario: 'c' })), veredicto: verdict, resumen: 'Resumen', instrucciones })

  beforeEach(() => {
    db.settings = null
    db.reviews = []
    db.variantUpdates = []
    ai.answers = []
    ai.calls = []
    db.post = { id: 'p1', workspaceId: 'w', title: 'Pintura', brief: null, origin: 'agent', variants: [{ id: 'v1', channel: 'INSTAGRAM', body: 'Tambien pintamos tu casa. #hogar', linkUrl: null }], media: [] }
  })

  it('corrige la ortografía en el texto guardado y el editor aprueba', async () => {
    ai.answers = [{ cambios: [{ campo: 'INSTAGRAM.body', original: 'Tambien', corregido: 'También', motivo: 'tilde' }] }, editorAll(9, 'aprobada')]
    const r = await reviewPass('p1', DEFAULT_EDITORIAL, env(), { round: 0 })
    expect(r.status).toBe('approved')
    expect(r.score).toBe(9)
    expect(r.corrections).toBe(1)
    expect(db.variantUpdates[0].data).toEqual({ body: 'También pintamos tu casa. #hogar' })
    expect(ai.calls.map((c) => [c.kind, c.model])).toEqual([['marketing_review_spelling', 'claude-haiku-4-5'], ['marketing_review_editor', 'claude-opus-5']])
    expect(db.reviews.map((x) => [x.reviewer, x.verdict])).toEqual([['spelling', 'corrected'], ['editor', 'approved']])
  })

  it('el editor pide cambios con instrucciones para el agente', async () => {
    ai.answers = [{ cambios: [] }, editorAll(6, 'cambios', [{ canal: 'INSTAGRAM', campo: 'INSTAGRAM.body', cambio: 'Abre con el dolor del cliente', motivo: 'Gancho débil' }])]
    const r = await reviewPass('p1', DEFAULT_EDITORIAL, env(), { round: 0 })
    expect(r.status).toBe('changes')
    expect(r.instructions[0].change).toMatch(/dolor/)
  })

  it('sin presupuesto no se llama a la IA y la pasada queda fallida (la pieza no sale)', async () => {
    const r = await reviewPass('p1', DEFAULT_EDITORIAL, env('Presupuesto mensual del agente agotado'), { round: 0 })
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/Presupuesto/)
    expect(ai.calls).toHaveLength(0)
    expect(db.reviews[0]).toMatchObject({ reviewer: 'spelling', verdict: 'error' })
  })

  it('una respuesta inválida del editor se reintenta una vez y luego falla', async () => {
    ai.answers = [{ cambios: [] }, { veredicto: 'aprobada' }, { veredicto: 'aprobada' }]
    const r = await reviewPass('p1', DEFAULT_EDITORIAL, env(), { round: 0 })
    expect(r.status).toBe('failed')
    expect(ai.calls).toHaveLength(3)
  })

  it('con el editor apagado basta la ortografía', async () => {
    ai.answers = [{ cambios: [] }]
    const r = await reviewPass('p1', { ...DEFAULT_EDITORIAL, editorEnabled: false }, env(), { round: 0 })
    expect(r.status).toBe('approved')
    expect(ai.calls).toHaveLength(1)
  })

  it('un corrector que intenta cambiar un nombre del catálogo o una cifra no lo logra', async () => {
    ai.answers = [{ cambios: [{ campo: 'title', original: 'Pintura', corregido: 'Pinturas', motivo: 'x' }, { campo: 'INSTAGRAM.body', original: '#hogar', corregido: '#casa', motivo: 'x' }] }, editorAll(9, 'aprobada')]
    const r = await reviewPass('p1', DEFAULT_EDITORIAL, env(), { round: 0 })
    expect(r.corrections).toBe(0)
    expect(db.variantUpdates).toHaveLength(0)
    expect((db.reviews[0].rejected as unknown[]).length).toBe(2)
  })
})

describe('aprendizaje del agente con los pedidos del editor', () => {
  it('lo que el editor pidió llega al agente como datos, no como instrucciones sueltas', async () => {
    const { momentBlock } = await import('@/lib/marketing/agent-prompt')
    const text = momentBlock({ now: new Date('2026-09-28T15:00:00Z'), calendar: [], learnings: null, stats: null, best: [], worst: [], rejected: [], editorNotes: ['Abre con el dolor del cliente, no con la marca'] })
    expect(text).toMatch(/editor jefe te pidió corregir[\s\S]*<datos tipo="pedidos recientes del editor">\n- Abre con el dolor del cliente/)
    expect(momentBlock({ now: new Date(), calendar: [], learnings: null, stats: null, best: [], worst: [], rejected: [] })).not.toMatch(/editor/)
  })
})

describe('prompt del editor', () => {
  it('solo pide lo que el redactor puede cambiar: textos, nunca imágenes', async () => {
    const { editorSystem } = await import('@/lib/marketing/editorial-prompt')
    const s = editorSystem({ brand: 'LoHaggo', settings: DEFAULT_EDITORIAL, criteria: defaultRubric(), treatment: 'tú', context: 'x' })
    expect(s).toMatch(/nunca pidas cambios de imágenes/)
    expect(s).toMatch(/debe poder cumplirse reescribiendo texto/)
  })
})

describe('aplicar las sugerencias del editor', () => {
  it('solo hay algo que aplicar si la última revisión del editor pidió cambios con instrucciones', async () => {
    db.lastEditor = null
    expect(await latestEditorAsks('p1')).toBeNull()
    db.lastEditor = { verdict: 'approved', instructions: [] }
    expect(await latestEditorAsks('p1')).toBeNull()
    db.lastEditor = { verdict: 'changes', instructions: [{ channel: 'WEB', field: 'WEB.seoTitle', change: 'Cambia «7 señales» por «6 señales»', reason: 'El artículo trae seis' }, { change: '  ' }] }
    expect((await latestEditorAsks('p1'))?.map((i) => i.change)).toEqual(['Cambia «7 señales» por «6 señales»'])
  })
})
