import { describe, expect, it } from 'vitest'
import {
  BASE_SLOTS,
  applyRecommendations,
  applyUtmToText,
  calendarGaps,
  checkGuardrails,
  degradation,
  effectiveMode,
  isRepeat,
  kpiValue,
  learningStats,
  nextAgentState,
  parseDraft,
  parseIdeas,
  parseRetrospective,
  parseStrategy,
  pickSlot,
  toolInput,
  withUtm,
  type GuardrailContext,
  type LearningRow,
  type PostFeatures,
  type SlotInput,
  type Strategy,
} from '@/lib/marketing/agent-core'
import { defaultAgentConfig, raisesAutonomy, sanitizeAgentConfig, sanitizeAgentSettings } from '@/lib/marketing/agent-input'
import { buildSystem, campaignBlock, fillMaster, MASTER_PROMPT } from '@/lib/marketing/agent-prompt'

// 2026-09-28 is a Monday
const at = (s: string) => new Date(s)

describe('modo efectivo', () => {
  const none = { trialPostsRemaining: 0, degradedReason: null }
  it('un canal solo puede ser más estricto que el agente', () => {
    expect(effectiveMode('autopilot', { WEB: 'copilot' }, ['WEB', 'INSTAGRAM'], none)).toBe('copilot')
    expect(effectiveMode('autopilot', { WEB: 'copilot' }, ['INSTAGRAM'], none)).toBe('autopilot')
    expect(effectiveMode('copilot', { INSTAGRAM: 'autopilot' }, ['INSTAGRAM'], none)).toBe('copilot')
    expect(effectiveMode('autopilot', { INSTAGRAM: 'supervised' }, ['INSTAGRAM', 'FACEBOOK'], none)).toBe('supervised')
  })
  it('período de prueba y agente degradado van en copiloto', () => {
    expect(effectiveMode('autopilot', null, ['INSTAGRAM'], { trialPostsRemaining: 2, degradedReason: null })).toBe('copilot')
    expect(effectiveMode('supervised', null, ['INSTAGRAM'], { trialPostsRemaining: 0, degradedReason: 'Presupuesto agotado' })).toBe('copilot')
  })
  it('presupuesto agotado, tope del workspace o token roto degradan', () => {
    expect(degradation({ agentBudget: { spentUsd: 10, capUsd: 10 }, workspaceBlocked: false, brokenAccounts: [] })).toMatch(/presupuesto/)
    expect(degradation({ agentBudget: { spentUsd: 1, capUsd: 10 }, workspaceBlocked: true, brokenAccounts: [] })).toMatch(/workspace/)
    expect(degradation({ agentBudget: { spentUsd: 1, capUsd: 10 }, workspaceBlocked: false, brokenAccounts: ['@lohaggo_'] })).toMatch(/@lohaggo_/)
    expect(degradation({ agentBudget: { spentUsd: 1, capUsd: 10 }, workspaceBlocked: false, brokenAccounts: [] })).toBeNull()
  })
})

describe('estados de una idea y su pieza', () => {
  it('la idea queda propuesta en copiloto y se acepta sola en supervisado y piloto', () => {
    expect(nextAgentState('new', 'idea_created', 'copilot')).toEqual({ state: 'idea_proposed', actions: ['notify_ideas'] })
    expect(nextAgentState('new', 'idea_created', 'supervised')?.state).toBe('idea_accepted')
    expect(nextAgentState('new', 'idea_created', 'autopilot')?.state).toBe('idea_accepted')
  })
  it('rechazar una idea guarda el motivo para aprender', () => {
    expect(nextAgentState('idea_proposed', 'idea_rejected', 'copilot')).toEqual({ state: 'idea_rejected', actions: ['record_rejection'] })
  })
  it('redactada y válida: revisión en copiloto, programada con plazo en supervisado, programada en piloto', () => {
    expect(nextAgentState('idea_accepted', 'drafted', 'copilot', { valid: true })).toEqual({ state: 'review', actions: ['mark_idea_drafted', 'notify_approval'] })
    expect(nextAgentState('idea_accepted', 'drafted', 'supervised', { valid: true })).toEqual({ state: 'scheduled', actions: ['mark_idea_drafted', 'schedule', 'set_opt_out_deadline', 'notify_opt_out'] })
    expect(nextAgentState('idea_accepted', 'drafted', 'autopilot', { valid: true })).toEqual({ state: 'scheduled', actions: ['mark_idea_drafted', 'schedule'] })
  })
  it('período de prueba: descuenta una pieza', () => {
    expect(nextAgentState('idea_accepted', 'drafted', 'copilot', { valid: true, trial: true })?.actions).toContain('consume_trial')
  })
  it('con errores queda en borrador para una persona; con dudas va a revisión aunque sea piloto', () => {
    expect(nextAgentState('idea_accepted', 'drafted', 'autopilot', { valid: false })?.state).toBe('draft')
    expect(nextAgentState('idea_accepted', 'drafted', 'autopilot', { valid: false })?.actions).toContain('notify_draft_problem')
    expect(nextAgentState('idea_accepted', 'drafted', 'autopilot', { valid: true, needsReview: true })?.state).toBe('review')
  })
  it('aprobar requiere permiso de publicar y programa', () => {
    expect(nextAgentState('review', 'approved', 'copilot', { canPublish: false })).toBeNull()
    expect(nextAgentState('review', 'approved', 'copilot', { canPublish: true })).toEqual({ state: 'approved', actions: ['schedule'] })
    expect(nextAgentState('approved', 'scheduled', 'copilot')?.state).toBe('scheduled')
  })
  it('rechazar la pieza la archiva y rechaza la idea', () => {
    expect(nextAgentState('review', 'rejected', 'copilot')).toEqual({ state: 'archived', actions: ['record_rejection', 'reject_idea'] })
  })
  it('supervisado: cancelar antes del plazo la saca de la cola o la descarta', () => {
    expect(nextAgentState('scheduled', 'cancelled', 'supervised')).toEqual({ state: 'approved', actions: ['cancel_scheduled'] })
    expect(nextAgentState('scheduled', 'cancelled', 'supervised', { discard: true })?.state).toBe('archived')
  })
  it('supervisado: editarla sin permiso de publicar la devuelve a revisión', () => {
    expect(nextAgentState('scheduled', 'edited', 'supervised', { canPublish: false })).toEqual({ state: 'review', actions: ['cancel_scheduled', 'notify_approval'] })
    expect(nextAgentState('scheduled', 'edited', 'supervised', { canPublish: true })?.state).toBe('scheduled')
  })
  it('pausar solo saca lo programado', () => {
    expect(nextAgentState('scheduled', 'paused', 'autopilot')).toEqual({ state: 'approved', actions: ['cancel_scheduled'] })
    expect(nextAgentState('published', 'paused', 'autopilot')).toEqual({ state: 'published', actions: [] })
    expect(nextAgentState('review', 'paused', 'autopilot')).toEqual({ state: 'review', actions: [] })
  })
  it('el worker publica; los fallos avisan y el agente no reintenta contenido', () => {
    expect(nextAgentState('scheduled', 'due', 'autopilot')?.state).toBe('publishing')
    expect(nextAgentState('publishing', 'failed', 'autopilot')).toEqual({ state: 'failed', actions: ['notify_failed'] })
    expect(nextAgentState('failed', 'drafted', 'autopilot')).toBeNull()
  })
})

describe('pickSlot', () => {
  const base: SlotInput = {
    channel: 'INSTAGRAM', target: at('2026-09-28T00:00:00-05:00'), earliest: at('2026-09-27T12:00:00-05:00'), horizonEnd: at('2026-10-12T00:00:00-05:00'),
    smart: true, allowedDays: [0, 1, 2, 3, 4, 5, 6], windows: [{ from: 8, to: 21 }], quietFrom: 22, quietTo: 7, minGapHours: 3, maxPerDay: 1,
    taken: [], kpi: 'engagement', measured: 0, performance: null, explore: 0.2, random: 0.9,
  }
  it('sin datos: horario base de Colombia, en hora de Bogotá', () => {
    const r = pickSlot(base)!
    // Monday is not a base Instagram day: Tuesday 12:00 Bogotá = 17:00 UTC
    expect(r.at.toISOString()).toBe('2026-09-29T17:00:00.000Z')
    expect(r.kind).toBe('base')
    expect(r.reason).toMatch(/^Martes 12:00: horario base de Instagram/)
    expect(BASE_SLOTS.WEB.days).toEqual([2, 3, 4])
  })
  it('respeta la separación mínima y el cupo diario, también con otras cuentas', () => {
    const taken = [at('2026-09-29T12:00:00-05:00')]
    expect(pickSlot({ ...base, taken, maxPerDay: 2 })!.at.toISOString()).toBe('2026-09-30T00:00:00.000Z') // Tue 19:00
    expect(pickSlot({ ...base, taken, maxPerDay: 1 })!.at.toISOString()).toBe('2026-09-30T17:00:00.000Z') // Wed 12:00
  })
  it('nunca en horas de silencio ni antes de lo permitido', () => {
    expect(pickSlot({ ...base, quietFrom: 11, quietTo: 13 })!.reason).toMatch(/Martes 19:00/)
    expect(pickSlot({ ...base, earliest: at('2026-09-29T13:00:00-05:00') })!.reason).toMatch(/Martes 19:00/)
  })
  it('con horarios propios usa la primera franja libre', () => {
    const r = pickSlot({ ...base, smart: false, allowedDays: [1], windows: [{ from: 15, to: 17 }] })!
    expect(r.reason).toBe('Lunes 15:00: primera franja libre de tus horarios')
    expect(r.kind).toBe('custom')
  })
  it('con datos: la mejor franja suavizada hacia la media del canal', () => {
    const performance = { channelMean: 4, byHour: { 12: { n: 5, mean: 2 }, 19: { n: 5, mean: 6 } }, byWeekday: {} }
    const r = pickSlot({ ...base, measured: 10, performance })!
    expect(r.kind).toBe('learned')
    expect(r.reason).toBe('Lunes 19:00: tu mejor franja disponible en Instagram, 6,0 % de interacción (5 publicaciones)')
  })
  it('un solo dato no gana a la media (suavizado)', () => {
    const performance = { channelMean: 4, byHour: { 9: { n: 1, mean: 7 }, 19: { n: 6, mean: 5 } }, byWeekday: {} }
    // hour 9: (7 + 3·4)/4 = 4.75; hour 19: (30 + 12)/9 = 4.67 … close; with 12 posts at 5 it wins
    const strong = { ...performance, byHour: { 9: { n: 1, mean: 7 }, 19: { n: 12, mean: 5 } } }
    expect(pickSlot({ ...base, measured: 13, performance: strong })!.reason).toMatch(/19:00/)
  })
  it('explora franjas poco probadas una parte de las veces', () => {
    const performance = { channelMean: 4, byHour: { 19: { n: 5, mean: 6 } }, byWeekday: {} }
    const r = pickSlot({ ...base, measured: 10, performance, random: 0.1 })!
    expect(r.kind).toBe('explore')
    expect(r.reason).toMatch(/poco probada/)
  })
  it('sin hueco en el horizonte devuelve null', () => {
    expect(pickSlot({ ...base, horizonEnd: at('2026-09-28T23:00:00-05:00') })).toBeNull()
  })
})

describe('guardarraíles', () => {
  const ctx: GuardrailContext = {
    now: at('2026-09-24T12:00:00-05:00'),
    promos: [{ text: 'Código LLUVIA20: 20% en plomería', endsAt: '2026-10-31T23:59:59-05:00' }, { text: 'VERANO15 descuento de temporada', endsAt: '2026-08-01T00:00:00-05:00' }],
    allowedTexts: ['Más de 500 socios verificados'],
    prices: [80000],
    bannedWords: ['barato'],
    bannedTopics: ['política'],
    ownDomains: ['lohaggo.com'],
    allowedDomains: ['wa.me'],
    confidence: 0.9,
    confidenceThreshold: 0.7,
  }
  const run = (text: string, extra: Partial<GuardrailContext> = {}) => checkGuardrails([{ channel: 'INSTAGRAM', text }], { ...ctx, ...extra })
  it('precios y porcentajes de la configuración pasan; otros van a revisión', () => {
    expect(run('Plomería desde $80.000 con LLUVIA20 tienes 20% menos').issues).toEqual([])
    const r = run('Ahora a $95.000 y 30 % menos')
    expect(r.ok).toBe(true)
    expect(r.needsReview).toBe(true)
    expect(r.issues.map((i) => i.code)).toEqual(['number', 'number'])
  })
  it('números sin $ ni % son genéricos', () => {
    expect(run('7 errores comunes y 500 socios').issues).toEqual([])
  })
  it('una promoción vencida bloquea', () => {
    const r = run('Aprovecha VERANO15 hoy')
    expect(r.ok).toBe(false)
    expect(r.issues[0].code).toBe('expired_promo')
  })
  it('palabras y temas prohibidos bloquean, sin importar tildes ni mayúsculas', () => {
    expect(run('Súper BARATO para ti').ok).toBe(false)
    expect(run('Hablemos de Política local').issues[0].code).toBe('banned_topic')
  })
  it('solo enlaces a dominios propios o autorizados', () => {
    expect(run('Mira https://www.lohaggo.com/servicios y https://wa.me/573000000000').issues).toEqual([])
    expect(run('Mira https://competencia.com/oferta').issues[0].code).toBe('domain')
  })
  it('fechas no configuradas y confianza baja van a revisión', () => {
    expect(run('Solo hasta el 15 de octubre').issues[0].code).toBe('date')
    const r = run('Texto normal', { confidence: 0.5 })
    expect(r.needsReview).toBe(true)
    expect(r.issues[0].code).toBe('low_confidence')
  })
})

describe('UTM', () => {
  const p = { channel: 'INSTAGRAM' as const, campaignSlug: 'lluvias', postId: 'p1' }
  it('nuestros enlaces llevan la campaña; los externos no se tocan', () => {
    const u = new URL(withUtm('https://www.lohaggo.com/servicios?utm_source=x&a=1', p, ['lohaggo.com']))
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'lluvias', utm_content: 'p1', a: '1' })
    expect(withUtm('https://wa.me/57300', p, ['lohaggo.com'])).toBe('https://wa.me/57300')
  })
  it('en el texto conserva la puntuación final; el blog es orgánico', () => {
    const t = applyUtmToText('Entra a https://lohaggo.com/plomeria.', { ...p, channel: 'WEB' }, ['lohaggo.com'])
    expect(t).toBe('Entra a https://lohaggo.com/plomeria?utm_source=blog&utm_medium=organic&utm_campaign=lluvias&utm_content=p1.')
  })
})

describe('repetición y huecos del calendario', () => {
  it('mismo servicio y ángulo parecido dentro de N días', () => {
    const recent = [{ service: 'Plomería', angle: 'Cómo detectar una fuga de agua escondida', at: at('2026-09-20T12:00:00Z') }]
    expect(isRepeat({ service: 'plomeria', angle: 'Detectar una fuga de agua escondida en casa', at: at('2026-09-25T12:00:00Z') }, recent, 21)).toBe(true)
    expect(isRepeat({ service: 'Plomería', angle: 'Qué hacer si se tapa el lavaplatos', at: at('2026-09-25T12:00:00Z') }, recent, 21)).toBe(false)
    expect(isRepeat({ service: 'Plomería', angle: 'Cómo detectar una fuga de agua escondida', at: at('2026-11-25T12:00:00Z') }, recent, 21)).toBe(false)
  })
  it('frecuencia menos lo ya planificado, en días permitidos', () => {
    const c = defaultAgentConfig('reach')
    const planned = [1, 2, 3].map((d) => ({ channel: 'INSTAGRAM' as const, at: new Date(at('2026-09-24T12:00:00-05:00').getTime() + d * 86400_000) }))
    const gaps = calendarGaps({ now: at('2026-09-24T10:00:00-05:00'), horizonDays: 14, channels: c.channels, planned, days: [1, 2, 3, 4, 5] })
    const ig = gaps.find((g) => g.channel === 'INSTAGRAM')!
    expect(ig.needed).toBe(5)
    expect(ig.dates.length).toBeLessThanOrEqual(5)
    for (const d of ig.dates) expect([1, 2, 3, 4, 5]).toContain(new Date(`${d}T12:00:00Z`).getUTCDay())
    expect(gaps.find((g) => g.channel === 'WEB')!.needed).toBe(2)
  })
})

describe('aprendizaje', () => {
  const f = (over: Partial<PostFeatures>): PostFeatures => ({ pillar: null, service: null, channels: ['INSTAGRAM'], format: { INSTAGRAM: 'feed' }, length: { INSTAGRAM: 400 }, hashtags: { INSTAGRAM: 8 }, weekday: 2, hour: 12, imageSource: 'pexels', cta: true, explore: false, ...over })
  const m = (reach: number, likes: number) => ({ reach, likes, comments: 0, shares: 0, saves: 0, clicks: 0, webViews: 0, conversations: 0 })
  const rows: LearningRow[] = [
    { postId: 'a', title: 'A', channel: 'INSTAGRAM', publishedAt: at('2026-09-01'), features: f({ pillar: 'Consejos' }), metrics: m(100, 9) },
    { postId: 'b', title: 'B', channel: 'INSTAGRAM', publishedAt: at('2026-09-02'), features: f({ pillar: 'Consejos' }), metrics: m(100, 7) },
    { postId: 'c', title: 'C', channel: 'INSTAGRAM', publishedAt: at('2026-09-03'), features: f({ pillar: 'Promos', format: { INSTAGRAM: 'carousel' } }), metrics: m(100, 2) },
    { postId: 'd', title: 'D', channel: 'INSTAGRAM', publishedAt: at('2026-09-04'), features: f({ pillar: 'Promos' }), metrics: m(100, 2) },
    { postId: 'w', title: 'W', channel: 'WEB', publishedAt: at('2026-09-04'), features: f({ pillar: 'Consejos', channels: ['WEB'] }), metrics: { ...m(0, 0), webViews: 50 } },
  ]
  it('KPI por canal: la tasa de interacción no aplica al blog; conversaciones por cada 1.000', () => {
    expect(kpiValue('engagement', 'INSTAGRAM', m(200, 10))).toBe(5)
    expect(kpiValue('engagement', 'WEB', m(200, 10))).toBeNull()
    expect(kpiValue('conversations', 'FACEBOOK', { ...m(2000, 0), conversations: 3 })).toBe(1.5)
    expect(kpiValue('web_visits', 'WEB', { ...m(0, 0), webViews: 40 })).toBe(40)
  })
  it('agrupa por dimensión frente a la media del canal, suavizado hacia 1', () => {
    const s = learningStats(rows, 'engagement', [{ kind: 'idea', pillar: 'Promos', service: null, reason: 'Muy vendedor' }, { kind: 'post', pillar: 'Promos', service: null, reason: 'Muy vendedor' }])
    expect(s.measured).toBe(4)
    expect(s.channelMean.INSTAGRAM).toBe(5)
    const [top, low] = s.byDimension.pillar
    expect(top.value).toBe('Consejos')
    expect(top.lift).toBeCloseTo(1.6)
    expect(top.smoothedLift).toBeCloseTo((3.2 + 3) / 5)
    expect(top.lowData).toBe(true)
    expect(low.value).toBe('Promos')
    expect(s.byDimension.format.map((x) => x.value)).toContain('INSTAGRAM:carousel')
    expect(s.best[0].postId).toBe('a')
    expect(s.rejections.byReason).toEqual([{ reason: 'Muy vendedor', n: 2 }])
  })
})

describe('salida del modelo', () => {
  const strategyInput = {
    summary: 'Educar sobre mantenimiento del hogar.',
    pillars: [{ name: 'Consejos', weight: 2, description: 'x', services: ['Plomería'], angles: [] }, { name: 'Casos', weight: 1, description: 'x', services: [], angles: [] }, { name: 'Oferta', weight: 1, description: 'x', services: [], angles: [] }],
    keyMessages: [{ segment: 'Hogar', message: 'Profesionales verificados' }],
    formatMix: [{ channel: 'INSTAGRAM', formats: [{ format: 'feed', share: 70 }] }],
    weeklyCalendar: [{ weekday: 2, channel: 'INSTAGRAM', pillar: 'Consejos' }, { weekday: 9, channel: 'INSTAGRAM', pillar: 'Consejos' }, { weekday: 3, channel: 'INSTAGRAM', pillar: 'Otro' }],
    kpi: { name: 'Interacción', target: '5 %', measurement: 'Meta' },
    hypotheses: ['Los consejos rinden más'], risks: [],
  }
  it('estrategia: pesos a porcentaje que suman 100; calendario solo con pilares y días válidos', () => {
    const r = parseStrategy(strategyInput)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.pillars.map((p) => p.weight)).toEqual([50, 25, 25])
    expect(r.value.weeklyCalendar).toHaveLength(1)
  })
  it('estrategia con menos de 3 pilares o sin KPI no vale', () => {
    const r = parseStrategy({ ...strategyInput, pillars: strategyInput.pillars.slice(0, 2), kpi: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/3 a 5 pilares.*KPI/)
  })
  it('ideas: descarta pilar desconocido, fecha fuera del horizonte y servicio fuera del catálogo', () => {
    const ctx = { pillars: ['Consejos', 'Casos', 'Oferta'], channels: ['INSTAGRAM', 'WEB'] as Array<'INSTAGRAM' | 'WEB'>, services: ['Plomería'], fromDay: '2026-09-25', toDay: '2026-10-08', max: 10 }
    const idea = { pillar: 'consejos', service: 'plomeria', angle: 'Fugas', hypothesis: 'h', channels: ['INSTAGRAM', 'FACEBOOK'], formats: { INSTAGRAM: 'reel' }, targetDate: '2026-09-30', rationale: 'r', explore: false, confidence: 0.8 }
    const r = parseIdeas({ ideas: [idea, { ...idea, pillar: 'Nuevo' }, { ...idea, targetDate: '2026-12-01' }, { ...idea, service: 'Astrología' }] }, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ideas).toHaveLength(1)
    expect(r.value.ideas[0]).toMatchObject({ pillar: 'Consejos', service: 'Plomería', channels: ['INSTAGRAM'], formats: { INSTAGRAM: 'feed' } })
    expect(r.value.dropped).toHaveLength(3)
    expect(parseIdeas({ ideas: [{ ...idea, pillar: 'Nuevo' }] }, ctx).ok).toBe(false)
    expect(parseIdeas('texto libre', ctx).ok).toBe(false)
  })
  it('pieza: exige cada canal pedido y la confianza', () => {
    const d = { title: 'T', brief: 'b', service: null, cta: 'Agenda', confidence: 0.8, risks: [], hypothesis: 'h', image: { query: 'plomero', alt: 'a', prompt: 'p' }, instagram: { caption: 'Hola #LoHaggo', format: 'carousel' } }
    expect(parseDraft(d, ['INSTAGRAM']).ok).toBe(true)
    const missing = parseDraft(d, ['INSTAGRAM', 'WEB'])
    expect(missing.ok).toBe(false)
    expect(parseDraft({ ...d, confidence: 'alta' }, ['INSTAGRAM']).ok).toBe(false)
  })
  it('retrospectiva: ignora recomendaciones mal formadas', () => {
    const r = parseRetrospective({ insights: ['a', 'b', 'c'], recommendations: [{ type: 'frequency', channel: 'INSTAGRAM', perWeek: 5, reason: 'r' }, { type: 'mode', value: 'autopilot' }, { type: 'avoid', topic: 'precios', reason: 'r' }] })
    expect(r.ok && r.value.recommendations.map((x) => x.type)).toEqual(['frequency', 'avoid'])
    expect(parseRetrospective({ insights: ['a'] }).ok).toBe(false)
  })
  it('lee la entrada de la herramienta pedida y nada más', () => {
    const content = [{ type: 'thinking' }, { type: 'text' }, { type: 'tool_use', name: 'otra', input: { x: 1 } }, { type: 'tool_use', name: 'proponer_ideas', input: { ideas: [] } }]
    expect(toolInput(content, 'proponer_ideas')).toEqual({ ideas: [] })
    expect(toolInput([{ type: 'text' }], 'proponer_ideas')).toBeNull()
  })
})

describe('recomendaciones aplicadas dentro de los límites', () => {
  const strategy: Strategy = {
    summary: 's', keyMessages: [], formatMix: [], weeklyCalendar: [], kpi: { name: 'k', target: 't', measurement: 'm' }, hypotheses: [], risks: [],
    pillars: [{ name: 'Consejos', weight: 40, description: '', services: [], angles: [] }, { name: 'Casos', weight: 30, description: '', services: [], angles: [] }, { name: 'Oferta', weight: 30, description: '', services: [], angles: [] }],
  }
  it('un pilar se mueve como mucho 15 puntos y los pesos vuelven a sumar 100', () => {
    const r = applyRecommendations(defaultAgentConfig(), strategy, [{ type: 'pillar_weight', pillar: 'consejos', weight: 90, reason: '' }])
    expect(r.strategy.pillars.reduce((a, p) => a + p.weight, 0)).toBe(100)
    expect(r.applied[0]).toMatch(/Consejos/)
    expect(r.strategy.pillars[0].weight).toBe(Math.round((55 / 115) * 100))
  })
  it('frecuencia de a 1, formatos solo permitidos; no toca temas prohibidos ni oferta', () => {
    const c = defaultAgentConfig()
    const r = applyRecommendations(c, strategy, [
      { type: 'frequency', channel: 'INSTAGRAM', perWeek: 10, reason: '' },
      { type: 'format', channel: 'INSTAGRAM', format: 'reel', direction: 'more', reason: '' },
      { type: 'avoid', topic: 'descuentos agresivos', reason: '' },
    ])
    expect(r.config.channels.INSTAGRAM.perWeek).toBe(c.channels.INSTAGRAM.perWeek + 1)
    expect(r.config.channels.INSTAGRAM.formats).not.toContain('reel')
    expect(r.config.voice.bannedTopics).toEqual(c.voice.bannedTopics)
    expect(r.strategy.avoid).toEqual(['descuentos agresivos'])
  })
})

describe('configuración del agente', () => {
  it('acota y limpia lo que envía el asistente', () => {
    const c = sanitizeAgentConfig({
      channels: { INSTAGRAM: { enabled: true, perWeek: 99, formats: ['reel', 'feed', 'x'] } },
      offer: { allowedDomains: ['https://www.Wa.me/abc', 'no es dominio'], promos: [{ text: 'LLUVIA20', endsAt: '2026-10-31' }, { text: '' }], links: [{ label: 'x', url: 'http://inseguro.com' }] },
      voice: { brandHashtags: ['LoHaggo', '#Hogar Feliz'] },
      schedule: { windows: [{ from: 20, to: 10 }], days: [9, 2, 2] },
    })
    expect(c.channels.INSTAGRAM).toMatchObject({ perWeek: 14, formats: ['feed'] })
    expect(c.offer.allowedDomains).toEqual(['wa.me'])
    expect(c.offer.promos).toEqual([{ text: 'LLUVIA20', endsAt: '2026-11-01T04:59:59.000Z' }])
    expect(c.offer.links).toEqual([])
    expect(c.voice.brandHashtags).toEqual(['#LoHaggo'])
    expect(c.schedule.windows).toEqual([{ from: 8, to: 21 }])
    expect(c.schedule.days).toEqual([2])
  })
  it('más autonomía exige confirmación; menos no', () => {
    const s = sanitizeAgentSettings({ mode: 'autopilot', optOutHours: 100, monthlyBudgetUsd: -3 })
    expect(s).toMatchObject({ mode: 'autopilot', optOutHours: 72, monthlyBudgetUsd: 0 })
    expect(raisesAutonomy({ mode: 'copilot', modeByChannel: null }, { mode: 'supervised', modeByChannel: null })).toBe(true)
    expect(raisesAutonomy({ mode: 'autopilot', modeByChannel: null }, { mode: 'autopilot', modeByChannel: { WEB: 'copilot' } })).toBe(false)
    expect(raisesAutonomy({ mode: 'autopilot', modeByChannel: { WEB: 'copilot' } }, { mode: 'autopilot', modeByChannel: null })).toBe(true)
  })
})

describe('prompt maestro', () => {
  const config = defaultAgentConfig('traffic')
  const facts = { brand: 'LoHaggo', siteUrl: 'https://www.lohaggo.com', objective: 'traffic', config, settings: { mode: 'supervised' as const, optOutHours: 24, exploreRatio: 0.3 }, effectiveMode: 'supervised' as const }
  it('rellena todos los marcadores; lo no configurado dice «sin definir», no se inventa', () => {
    const text = fillMaster(facts)
    expect(MASTER_PROMPT).toMatch(/\{meta\}/)
    expect(text).not.toMatch(/\{\w+\}/)
    expect(text).toContain('KPI principal: Visitas al blog · Meta: sin definir')
    expect(text).toContain('Nivel de autonomía: Supervisado')
    expect(text).toContain('antes de 24 horas')
    expect(text).toContain('dedicas 30% de las piezas')
    expect(fillMaster({ ...facts, config: { ...config, goal: 5000 } })).toContain('Meta: 5000 (visitas al blog)')
  })
  it('bloques: los dos estables con caché, el del momento sin caché', () => {
    const blocks = buildSystem('a', 'b', 'c')
    expect(blocks.map((b) => Boolean(b.cache_control))).toEqual([true, true, false])
  })
  it('la configuración va como datos; las promociones vencidas no llegan al modelo', () => {
    const c = { ...config, offer: { ...config.offer, promos: [{ text: 'LLUVIA20 vigente', endsAt: '2026-12-31T00:00:00Z' }, { text: 'VERANO15 vencida', endsAt: '2026-08-01T00:00:00Z' }] } }
    const text = campaignBlock({ ...facts, config: c, campaignName: 'Lluvias', campaignDescription: null, strategy: null, catalog: { services: [{ name: 'Plomería', category: 'Hogar', basePrice: 80000 }], cities: ['Medellín'] }, now: at('2026-09-24T12:00:00Z') })
    expect(text).toContain('<datos tipo="configuración de la campaña">')
    expect(text).toContain('LLUVIA20 vigente')
    expect(text).not.toContain('VERANO15')
    expect(text).toContain('Plomería · Hogar · desde $80.000')
  })
})
