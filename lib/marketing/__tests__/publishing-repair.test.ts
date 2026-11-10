import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import {
  dailyShortfall, draftsInCalendar, enforceDailyFormats, fillIdeas, isDailyFormat, learningStats, pickSlot, slotLane, watchdogDays,
  withWhatsappCta, IG_WHATSAPP_LINE, WATCHDOG_RATIONALE, type IdeaDraft, type LearningRow, type SlotInput,
} from '@/lib/marketing/agent-core'
import { defaultAgentConfig, readAgentConfig, sanitizeAgentConfig } from '@/lib/marketing/agent-input'
import { bogota } from '@/lib/marketing/agent-core'
import { arbiterPrecheck, REVIEW_MISSING_REASON } from '@/lib/marketing/arbiter-core'
import { chatsByPost } from '@/lib/marketing/post-results'
import { outcomesBySend } from '@/lib/marketing/stats'

const at = (s: string) => new Date(s)
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Production's Instagram plan (2026-11-09): two posts, two reels and two stories every day. */
function prodConfig() {
  const c = defaultAgentConfig()
  return sanitizeAgentConfig({ ...c, alwaysOn: true, channels: { ...c.channels, INSTAGRAM: { ...c.channels.INSTAGRAM, minDaily: { feed: 2, reel: 2, story: 2 } }, FACEBOOK: { ...c.channels.FACEBOOK, enabled: false }, WEB: { ...c.channels.WEB, enabled: false } }, schedule: { ...c.schedule, days: ALL_DAYS, maxPerDay: 7 } }, c)
}

describe('configuración nueva del agente', () => {
  it('por defecto: el vigilante rellena 2 días, CTA de WhatsApp y aprende 50 % de resultados', () => {
    const c = readAgentConfig({})
    expect(c.watchdog).toEqual({ autoFill: true, lookaheadDays: 2 })
    expect(c.cta).toEqual({ whatsapp: true })
    expect(c.learning.outcomeWeight).toBe(0.5)
  })
  it('acota lo que llega del asistente', () => {
    const c = sanitizeAgentConfig({ watchdog: { autoFill: false, lookaheadDays: 40 }, cta: { whatsapp: false }, learning: { outcomeWeight: 3 } })
    expect(c.watchdog).toEqual({ autoFill: false, lookaheadDays: 7 })
    expect(c.cta.whatsapp).toBe(false)
    expect(c.learning.outcomeWeight).toBe(1)
  })
})

describe('franjas: las historias van aparte y los mínimos diarios caben', () => {
  const c = prodConfig()
  it('la historia tiene su carril (1 h entre historias) y el cupo diario nunca impide el mínimo', () => {
    const story = slotLane('INSTAGRAM', 'story', c.channels.INSTAGRAM, { minGapHours: 3, maxPerDay: 1 })
    expect(story).toEqual({ story: true, fill: true, minGapHours: 1, maxPerDay: 2 })
    const reel = slotLane('INSTAGRAM', 'reel', c.channels.INSTAGRAM, { minGapHours: 3, maxPerDay: 1 })
    expect(reel).toEqual({ story: false, fill: true, minGapHours: 3, maxPerDay: 4 })
    expect(slotLane('FACEBOOK', 'story', { minDaily: { historia: 1 } }, { minGapHours: 3, maxPerDay: 1 }).fill).toBe(true)
  })

  const base: SlotInput = {
    channel: 'INSTAGRAM', target: at('2026-11-09T00:00:00-05:00'), earliest: at('2026-11-09T07:00:00-05:00'), horizonEnd: at('2026-11-23T00:00:00-05:00'),
    smart: true, allowedDays: ALL_DAYS, windows: [{ from: 8, to: 21 }], quietFrom: 21, quietTo: 7, minGapHours: 3, maxPerDay: 4,
    taken: [], kpi: 'requests', measured: 0, performance: null, explore: 0.2, random: 0.9,
  }
  it('sin datos, un lunes: lo normal espera al martes; una pieza obligatoria sale el lunes', () => {
    expect(pickSlot(base)!.at.toISOString()).toBe('2026-11-10T17:00:00.000Z')
    expect(pickSlot({ ...base, fill: true })!.at.toISOString()).toBe('2026-11-09T17:00:00.000Z')
  })
  it('cuatro posts y reels obligatorios caben el mismo día con 3 h de separación', () => {
    const taken: Date[] = []
    for (let i = 0; i < 4; i++) {
      const r = pickSlot({ ...base, taken, fill: true })!
      expect(bogota(r.at).key).toBe('2026-11-09')
      taken.push(r.at)
    }
    // Before the fix only the 5 baseline hours were usable: two pieces a day at most
    const old: Date[] = []
    for (let i = 0; i < 3; i++) old.push(pickSlot({ ...base, taken: old, fill: false })!.at)
    expect(new Set(old.map((d) => bogota(d).key)).size).toBeGreaterThan(1)
  })
})

describe('el plan reparte los formatos diarios por turnos', () => {
  const idea = (d: string, formats: IdeaDraft['formats']): IdeaDraft => ({ pillar: 'P', service: null, angle: 'a', hypothesis: '', channels: ['INSTAGRAM'], formats, targetDate: d, slotHint: null, rationale: '', explore: false, confidence: 0.8 })
  it('con menos ideas que cupos, la historia también recibe una (antes quedaba siempre sin cubrir)', () => {
    const day = '2026-11-10'
    const ideas = [idea(day, { INSTAGRAM: 'feed' }), idea(day, { INSTAGRAM: 'feed' }), idea(day, { INSTAGRAM: 'feed' })]
    const gaps = [
      { channel: 'INSTAGRAM' as const, format: 'feed', dates: [day, day] },
      { channel: 'INSTAGRAM' as const, format: 'reel', dates: [day, day] },
      { channel: 'INSTAGRAM' as const, format: 'story', dates: [day, day] },
    ]
    const r = enforceDailyFormats(ideas, gaps, ['INSTAGRAM'])
    const formats = r.ideas.map((i) => i.formats.INSTAGRAM).sort()
    expect(formats).toEqual(['feed', 'reel', 'story'])
    expect(r.uncovered.sort()).toEqual([`${day} Instagram feed`, `${day} Instagram reel`, `${day} Instagram story`])
  })
})

describe('el vigilante sabe qué falta y lo crea', () => {
  const c = prodConfig()
  it('días: hoy antes de las 19 h y los siguientes', () => {
    expect(watchdogDays(at('2026-11-09T10:00:00-05:00'), 2)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
    expect(watchdogDays(at('2026-11-09T20:00:00-05:00'), 1)).toEqual(['2026-11-10'])
  })
  it('cuenta lo que falta por día y formato (una historia de Facebook sale como «story»)', () => {
    const planned = [
      { channel: 'INSTAGRAM' as const, at: at('2026-11-10T12:00:00-05:00'), format: 'carousel' },
      { channel: 'INSTAGRAM' as const, at: at('2026-11-10T19:00:00-05:00'), format: 'story' },
    ]
    const miss = dailyShortfall({ days: ['2026-11-10'], channels: c.channels, planned, allowedDays: ALL_DAYS })
    expect(miss.map((m) => `${m.format}:${m.have}/${m.need}`)).toEqual(['feed:1/2', 'reel:0/2', 'story:1/2'])
    expect(isDailyFormat('FACEBOOK', 'story', 'historia')).toBe(true)
    expect(dailyShortfall({ days: ['2026-11-15'], channels: c.channels, planned: [], allowedDays: [1, 2, 3, 4, 5] })).toEqual([])
  })
  it('las ideas de relleno retoman lo que trajo clientes, en el formato que falta', () => {
    const ideas = fillIdeas({
      missing: [{ day: '2026-11-10', channel: 'INSTAGRAM', format: 'story', have: 0, need: 2 }],
      pillars: ['Confianza', 'Urgencias'], services: ['Plomería', 'Limpieza'],
      worked: [{ service: 'Limpieza', title: 'Sofá como nuevo', conversations: 3, requests: 1 }],
      recentServices: ['Plomería'], formatLabel: (_ch, f) => (f === 'story' ? 'Historia de Instagram' : f),
    })
    expect(ideas).toHaveLength(2)
    expect(ideas[0]).toMatchObject({ service: 'Limpieza', channels: ['INSTAGRAM'], formats: { INSTAGRAM: 'story' }, targetDate: '2026-11-10', pillar: 'Confianza' })
    expect(ideas[0].angle).toContain('«Sofá como nuevo»')
    expect(ideas[0].angle).toContain('1 solicitud(es) y 3 conversación(es)')
    expect(ideas[0].rationale.startsWith(WATCHDOG_RATIONALE)).toBe(true)
    expect(ideas[1].service).toBe('Plomería')
  })
  it('un borrador atascado ya no llena «mañana» para siempre', () => {
    const now = at('2026-11-09T10:00:00-05:00')
    const dates = new Map([['i1', at('2026-11-10T12:00:00-05:00')], ['i2', at('2026-11-10T12:00:00-05:00')]])
    const kept = draftsInCalendar([
      { id: 'a', status: 'approved', ideaId: 'i1', updatedAt: at('2026-11-01T00:00:00Z') },
      { id: 'b', status: 'review', ideaId: 'i2', updatedAt: at('2026-11-02T00:00:00Z') },
      { id: 'c', status: 'review', ideaId: 'i2', updatedAt: at('2026-11-09T09:00:00-05:00') },
      { id: 'd', status: 'approved', ideaId: 'old', updatedAt: now },
    ], dates, now)
    expect(kept.map((k) => k.draft.id)).toEqual(['a', 'c'])
  })
})

describe('cada pieza lleva a una conversación medible', () => {
  const wa = 'https://lohaggo.com/w/post-abc'
  it('Facebook y el blog llevan el enlace de la pieza; Instagram, la frase de la bio; nunca dos veces', () => {
    expect(withWhatsappCta('FACEBOOK', 'Texto', wa)).toBe(`Texto\n\n📲 Pídelo por WhatsApp: ${wa}`)
    expect(withWhatsappCta('WEB', 'Artículo', wa)).toContain(`[Escríbenos por WhatsApp](${wa})`)
    expect(withWhatsappCta('INSTAGRAM', 'Caption', wa)).toBe(`Caption\n\n${IG_WHATSAPP_LINE}`)
    expect(withWhatsappCta('INSTAGRAM', 'Escríbenos por WhatsApp hoy', wa)).toBe('Escríbenos por WhatsApp hoy')
    expect(withWhatsappCta('FACEBOOK', `Ya está ${wa}`, wa)).toBe(`Ya está ${wa}`)
    expect(withWhatsappCta('INSTAGRAM', '', wa)).toBe('')
  })
  it('los chats con «ref: post-…» se cuentan por pieza, una vez por chat', () => {
    const m = chatsByPost(new Set(['p1', 'p2']), [
      { customFields: { webRef: 'post-p1', lastWebRef: 'post-p1' } },
      { customFields: { webRef: 'web-home', lastWebRef: 'post-p2' } },
      { customFields: { webRef: 'post-zz' } },
      { customFields: null },
    ])
    expect(Object.fromEntries(m)).toEqual({ p1: 1, p2: 1 })
  })
  it('resultados por envío: solicitudes a su canal, el resto y los chats al primer envío', () => {
    const pubs = [
      { id: 'ig', postId: 'p', channel: 'INSTAGRAM', publishedAt: at('2026-11-01T12:00:00Z') },
      { id: 'fb', postId: 'p', channel: 'FACEBOOK', publishedAt: at('2026-11-01T13:00:00Z') },
    ]
    const results = new Map([['p', { requests: 3, bookings: 1, completed: 0, byChannel: { FACEBOOK: { requests: 2, bookings: 1 } } }]])
    const out = outcomesBySend(pubs, results, new Map([['p', 4]]), new Map([['fb', 2]]))
    expect(out.get('ig')).toEqual({ conversations: 4, requests: 1, bookings: 0 })
    expect(out.get('fb')).toEqual({ conversations: 2, requests: 2, bookings: 1 })
  })
})

describe('aprender de resultados, no solo de «me gusta»', () => {
  const row = (postId: string, likes: number, conversations: number, requests: number, format: string): LearningRow => ({
    postId, title: postId, channel: 'INSTAGRAM', publishedAt: at('2026-11-01T12:00:00Z'),
    features: { pillar: 'P', service: format === 'story' ? 'Limpieza' : 'Plomería', channels: ['INSTAGRAM'], format: { INSTAGRAM: format }, length: {}, hashtags: {}, weekday: 1, hour: 12, imageSource: null, cta: true, explore: false },
    metrics: { reach: 100, likes, comments: 0, shares: 0, saves: 0, clicks: 0, webViews: 0, conversations, requests },
  })
  const rows = [row('likes', 30, 0, 0, 'feed'), row('chats', 2, 3, 1, 'story'), row('flat', 5, 0, 0, 'reel')]
  it('con peso 0 gana la pieza de «me gusta»; con peso alto, la que trajo conversaciones y solicitudes', () => {
    expect(learningStats(rows, 'engagement').best[0].postId).toBe('likes')
    expect(learningStats(rows, 'engagement', [], { outcomeWeight: 0.8 }).best[0].postId).toBe('chats')
  })
  it('resume qué formatos y temas trajeron clientes', () => {
    const s = learningStats(rows, 'engagement', [], { outcomeWeight: 0.5 })
    expect(s.outcomes.byFormat).toEqual([{ value: 'INSTAGRAM:story', n: 1, conversations: 3, requests: 1, bookings: 0 }])
    expect(s.outcomes.byService[0].value).toBe('Limpieza')
  })
})

describe('la revisión editorial obligatoria no se salta', () => {
  const base = { score: null, minScore: 7, blocks: [], requestedByPerson: false }
  it('si la revisión falló o no corrió, Haggo no decide publicar: se reintenta', () => {
    expect(arbiterPrecheck({ ...base, editorStatus: 'failed', reviewRequired: true })).toEqual({ decision: 'human', reason: REVIEW_MISSING_REASON })
    expect(arbiterPrecheck({ ...base, editorStatus: null, reviewRequired: true })?.reason).toBe(REVIEW_MISSING_REASON)
  })
  it('sin revisión obligatoria sigue siendo una decisión del árbitro; con cambios pedidos también', () => {
    expect(arbiterPrecheck({ ...base, editorStatus: 'failed', reviewRequired: false })).toBeNull()
    expect(arbiterPrecheck({ ...base, editorStatus: 'changes', score: 6, reviewRequired: true })).toBeNull()
  })
})
