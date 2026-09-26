import { prisma } from '@/lib/prisma'
import { configOf, decideIdeas, draftIdea, loadAgent, pauseAgent, planIdeas, scheduleApproved, withAgentLock, cancelPost } from '@/lib/marketing/agent'
import { AGENT_CHANNELS, sanitizeAgentConfig, type AgentConfig } from '@/lib/marketing/agent-input'
import { activateAgent, activationError, approvePost, fitsAgentSchedule, reschedulePost, retryPublication, returnToReview } from '@/lib/marketing/ops'
import type { MarketingChannel } from '@prisma/client'
import { ID, done, isObj, parseDate, parseId, parseText, requireObj, when, type HaggoActionDef } from '@/lib/haggo/actions/types'

const DONE_POST = ['published', 'partial', 'publishing', 'archived']
const json = (v: unknown) => JSON.parse(JSON.stringify(v))

const reschedule: HaggoActionDef<{ postId: string; when: Date }> = {
  id: 'marketing.reschedule_post',
  domain: 'marketing',
  risk: 'low',
  label: 'Reprogramar una publicación',
  hint: 'Mueve todo lo pendiente de una publicación a otra fecha y hora. Si es de un agente, la hora debe caer en sus días y franjas.',
  schema: { type: 'object', properties: { postId: { type: 'string' }, when: { type: 'string', description: 'ISO 8601 con zona de Bogotá, p. ej. 2026-10-02T10:00:00-05:00' } }, required: ['postId', 'when'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { postId: parseId(r, 'postId', e), when: parseDate(r, 'when', e) }) },
  describe: (p) => `Reprogramar la publicación para el ${when(p.when)}`,
  entity: (p) => ({ type: 'MarketingPost', id: p.postId }),
  preconditions: async (p) => {
    const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { title: true, status: true, agentId: true } })
    if (!post) return { ok: false, reason: 'La publicación no existe' }
    if (DONE_POST.includes(post.status)) return { ok: false, reason: 'Ya salió o está archivada' }
    if (p.when.getTime() < Date.now() + 5 * 60_000) return { ok: false, reason: 'La nueva hora debe ser al menos en 5 minutos' }
    const pending = await prisma.marketingPublication.findFirst({ where: { postId: p.postId, status: 'scheduled' }, orderBy: { scheduledAt: 'asc' }, select: { scheduledAt: true } })
    if (!pending) return { ok: false, reason: 'No tiene nada programado que mover' }
    if (post.agentId) {
      const agent = await prisma.marketingAgent.findUnique({ where: { id: post.agentId }, select: { config: true } })
      const fit = agent ? fitsAgentSchedule(agent, p.when) : { ok: true as const }
      if (!fit.ok) return { ok: false, reason: `La hora ${fit.reason}` }
    }
    return { ok: true, before: { title: post.title, scheduledAt: pending.scheduledAt.toISOString() } }
  },
  preview: async (p, before) => {
    const b = before as { title: string; scheduledAt: string }
    return { summary: `«${b.title}»: del ${when(b.scheduledAt)} al ${when(p.when)}`, diff: [{ field: 'Hora de publicación', from: when(b.scheduledAt), to: when(p.when) }] }
  },
  execute: async (p) => {
    await reschedulePost(p.postId, p.when)
    return { after: { scheduledAt: p.when.toISOString() }, result: `Reprogramada para el ${when(p.when)}` }
  },
  unchanged: async (p, after) => {
    const pub = await prisma.marketingPublication.findFirst({ where: { postId: p.postId, status: 'scheduled' }, orderBy: { scheduledAt: 'asc' }, select: { scheduledAt: true } })
    return Boolean(pub && pub.scheduledAt.toISOString() === (after as { scheduledAt: string }).scheduledAt)
  },
  undo: async (p, before) => {
    const at = new Date((before as { scheduledAt: string }).scheduledAt)
    if (at.getTime() < Date.now() + 60_000) throw new Error('La hora original ya pasó: reprográmala a mano')
    await reschedulePost(p.postId, at)
  },
}

const retry: HaggoActionDef<{ publicationId: string }> = {
  id: 'marketing.retry_publication',
  domain: 'marketing',
  risk: 'medium',
  label: 'Reintentar una publicación fallida',
  hint: 'Vuelve a poner en cola una publicación que falló (por ejemplo, un error temporal de Meta ya resuelto). Sale en el siguiente minuto.',
  schema: { type: 'object', properties: { publicationId: { type: 'string' } }, required: ['publicationId'] },
  sideEffects: ['publishes'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { publicationId: parseId(r, 'publicationId', e) }) },
  describe: () => 'Reintentar la publicación fallida',
  entity: (p) => ({ type: 'MarketingPublication', id: p.publicationId }),
  preconditions: async (p) => {
    const pub = await prisma.marketingPublication.findUnique({ where: { id: p.publicationId }, select: { status: true, lastError: true, channel: true, post: { select: { title: true } } } })
    if (!pub) return { ok: false, reason: 'La publicación no existe' }
    if (pub.status !== 'failed') return { ok: false, reason: 'Solo se reintenta una publicación fallida' }
    return { ok: true, before: { title: pub.post.title, channel: pub.channel, lastError: pub.lastError } }
  },
  preview: async (_p, before) => {
    const b = before as { title: string; channel: string; lastError: string | null }
    return { summary: `«${b.title}» en ${b.channel} vuelve a la cola y sale en el siguiente minuto`, diff: [{ field: 'Estado', from: `fallida (${b.lastError ?? 'sin detalle'})`, to: 'programada ahora' }] }
  },
  execute: async (p) => {
    await retryPublication(p.publicationId)
    return { after: { status: 'scheduled' }, result: 'En cola: sale en el siguiente minuto' }
  },
}

const approve: HaggoActionDef<{ postId: string }> = {
  id: 'marketing.approve_post',
  domain: 'marketing',
  risk: 'medium',
  label: 'Aprobar una publicación en revisión',
  hint: 'Aprueba un borrador que espera revisión. Si es de un agente, el agente le asigna hora según sus franjas y sus controles de calidad.',
  schema: { type: 'object', properties: { postId: { type: 'string' } }, required: ['postId'] },
  sideEffects: ['publishes'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { postId: parseId(r, 'postId', e) }) },
  describe: () => 'Aprobar la publicación',
  entity: (p) => ({ type: 'MarketingPost', id: p.postId }),
  preconditions: async (p) => {
    const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { title: true, status: true, agentId: true } })
    if (!post) return { ok: false, reason: 'La publicación no existe' }
    if (post.status !== 'review') return { ok: false, reason: 'No está esperando aprobación' }
    return { ok: true, before: { title: post.title, status: post.status, fromAgent: Boolean(post.agentId) } }
  },
  preview: async (_p, before) => {
    const b = before as { title: string; fromAgent: boolean }
    return { summary: `«${b.title}» queda aprobada${b.fromAgent ? ' y el agente le asigna hora' : ''}`, diff: [{ field: 'Estado', from: 'en revisión', to: b.fromAgent ? 'aprobada y programada' : 'aprobada' }] }
  },
  execute: async (p, ctx) => {
    const r = await approvePost(p.postId, ctx.approverId)
    // The editorial review may hold it: then it is back in review, and that is what gets recorded
    const now = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { status: true } })
    return { after: { status: now?.status ?? 'approved' }, result: r ? (r.ok ? `Aprobada y programada: ${r.message}` : now?.status === 'review' ? `No quedó aprobada: ${r.message}` : `Aprobada, pero no se pudo programar: ${r.message}`) : 'Aprobada' }
  },
  unchanged: async (p) => {
    const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { status: true } })
    return Boolean(post && ['approved', 'scheduled'].includes(post.status))
  },
  undo: async (p) => returnToReview(p.postId),
}

const cancel: HaggoActionDef<{ postId: string }> = {
  id: 'marketing.cancel_post',
  domain: 'marketing',
  risk: 'medium',
  label: 'Frenar una publicación programada de un agente',
  hint: 'Saca de la cola una publicación de un agente de marketing antes de que salga (queda aprobada, sin hora).',
  schema: { type: 'object', properties: { postId: { type: 'string' } }, required: ['postId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { postId: parseId(r, 'postId', e) }) },
  describe: () => 'Sacar la publicación de la cola',
  entity: (p) => ({ type: 'MarketingPost', id: p.postId }),
  preconditions: async (p) => {
    const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { title: true, status: true, agentId: true, scheduledAt: true } })
    if (!post) return { ok: false, reason: 'La publicación no existe' }
    if (!post.agentId) return { ok: false, reason: 'Solo aplica a publicaciones de un agente de marketing' }
    if (post.status !== 'scheduled') return { ok: false, reason: 'No está programada' }
    return { ok: true, before: { title: post.title, scheduledAt: post.scheduledAt?.toISOString() ?? null, agentId: post.agentId } }
  },
  preview: async (_p, before) => {
    const b = before as { title: string; scheduledAt: string | null }
    return { summary: `«${b.title}» no saldrá el ${when(b.scheduledAt)}`, diff: [{ field: 'Estado', from: `programada (${when(b.scheduledAt)})`, to: 'aprobada, sin hora' }] }
  },
  execute: async (p, _ctx, before) => {
    const agent = await loadAgent((before as { agentId: string }).agentId)
    if (!agent) throw new Error('El agente ya no existe')
    await cancelPost(agent, p.postId, false, 'Frenada por Haggo')
    return { after: { status: 'approved' }, result: 'Fuera de la cola' }
  },
  unchanged: async (p) => (await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { status: true } }))?.status === 'approved',
  undo: async (p) => {
    const r = await scheduleApproved(p.postId)
    if (r && !r.ok) throw new Error(`No se pudo volver a programar: ${r.message}`)
  },
}

const pause: HaggoActionDef<{ agentId: string }> = {
  id: 'marketing.pause_agent',
  domain: 'marketing',
  risk: 'medium',
  label: 'Pausar un agente de marketing',
  hint: 'Detiene un agente de marketing y saca de la cola lo que tenía programado.',
  schema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { agentId: parseId(r, 'agentId', e) }) },
  describe: () => 'Pausar el agente de marketing',
  entity: (p) => ({ type: 'MarketingAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { status: true, campaign: { select: { name: true } } } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    if (a.status !== 'active') return { ok: false, reason: 'El agente no está activo' }
    const queued = await prisma.marketingPost.findMany({ where: { agentId: p.agentId, status: 'scheduled' }, select: { id: true } })
    return { ok: true, before: { campaign: a.campaign.name, status: a.status, queued: queued.map((q) => q.id) } }
  },
  preview: async (_p, before) => {
    const b = before as { campaign: string; queued: string[] }
    return { summary: `El agente de «${b.campaign}» se detiene${b.queued.length ? ` y ${b.queued.length} publicaciones salen de la cola` : ''}`, diff: [{ field: 'Estado', from: 'activo', to: 'pausado' }, { field: 'Programadas', from: b.queued.length, to: 0 }] }
  },
  execute: async (p) => {
    const n = await pauseAgent(p.agentId)
    return { after: { status: 'paused' }, result: `Pausado; ${n} publicaciones fuera de la cola` }
  },
  unchanged: async (p) => (await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { status: true } }))?.status === 'paused',
  undo: async (p, before) => {
    await activateAgent(p.agentId)
    const failed: string[] = []
    for (const id of (before as { queued: string[] }).queued) {
      const r = await scheduleApproved(id).catch((err: unknown) => ({ ok: false as const, message: err instanceof Error ? err.message : 'error' }))
      if (r && !r.ok) failed.push(r.message)
    }
    if (failed.length) throw new Error(`El agente volvió a trabajar, pero ${failed.length} publicación(es) no se reprogramaron: ${failed[0]}`)
  },
}

const activate: HaggoActionDef<{ agentId: string }> = {
  id: 'marketing.activate_agent',
  domain: 'marketing',
  risk: 'medium',
  label: 'Reactivar un agente de marketing',
  hint: 'Vuelve a poner a trabajar un agente de marketing pausado (necesita su estrategia aprobada).',
  schema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] },
  sideEffects: ['publishes', 'spends'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { agentId: parseId(r, 'agentId', e) }) },
  describe: () => 'Reactivar el agente de marketing',
  entity: (p) => ({ type: 'MarketingAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, include: { campaign: { select: { name: true } } } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    if (a.status === 'active') return { ok: false, reason: 'Ya está activo' }
    if (a.status === 'finished') return { ok: false, reason: 'El agente terminó su campaña' }
    const blocked = await activationError(a)
    if (blocked) return { ok: false, reason: blocked }
    return { ok: true, before: { campaign: a.campaign.name, status: a.status, mode: a.mode } }
  },
  preview: async (_p, before) => {
    const b = before as { campaign: string; status: string; mode: string }
    return { summary: `El agente de «${b.campaign}» vuelve a trabajar en modo ${b.mode === 'copilot' ? 'copiloto (todo pasa por aprobación)' : b.mode === 'supervised' ? 'supervisado (publica si nadie lo frena)' : 'piloto automático (publica solo)'}`, diff: [{ field: 'Estado', from: b.status, to: 'activo' }] }
  },
  execute: async (p) => { await activateAgent(p.agentId); return { after: { status: 'active' }, result: 'Activo' } },
  unchanged: async (p) => (await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { status: true } }))?.status === 'active',
  undo: async (p) => { await pauseAgent(p.agentId) },
}

type ScheduleParams = { agentId: string; perWeek?: Partial<Record<MarketingChannel, number>>; days?: number[]; windows?: Array<{ from: number; to: number }>; minGapHours?: number; maxPerDay?: number }

function scheduleSnapshot(c: AgentConfig) {
  return { perWeek: Object.fromEntries(AGENT_CHANNELS.map((ch) => [ch, c.channels[ch].perWeek])), days: c.schedule.days, windows: c.schedule.windows, minGapHours: c.schedule.minGapHours, maxPerDay: c.schedule.maxPerDay }
}

const updateSchedule: HaggoActionDef<ScheduleParams> = {
  id: 'marketing.update_schedule',
  domain: 'marketing',
  risk: 'medium',
  label: 'Cambiar cadencia y horarios de un agente de marketing',
  hint: 'Publicaciones por semana por canal, días, franjas horarias (horas de Bogotá, [desde, hasta)), separación mínima y máximo por día. Nunca cambia la autonomía del agente.',
  schema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      perWeek: { type: 'object', properties: { INSTAGRAM: { type: 'integer', minimum: 0, maximum: 14 }, FACEBOOK: { type: 'integer', minimum: 0, maximum: 14 }, WEB: { type: 'integer', minimum: 0, maximum: 14 } } },
      days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
      windows: { type: 'array', items: { type: 'object', properties: { from: { type: 'integer' }, to: { type: 'integer' } }, required: ['from', 'to'] } },
      minGapHours: { type: 'integer', minimum: 1, maximum: 72 },
      maxPerDay: { type: 'integer', minimum: 1, maximum: 5 },
    },
    required: ['agentId'],
  },
  sideEffects: [],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const p: ScheduleParams = { agentId: parseId(r, 'agentId', e) }
    if (r.perWeek != null) {
      if (!isObj(r.perWeek)) e.push('perWeek: objeto por canal')
      else {
        const pw: Partial<Record<MarketingChannel, number>> = {}
        for (const [k, v] of Object.entries(r.perWeek)) {
          if (!AGENT_CHANNELS.includes(k as MarketingChannel) || !Number.isInteger(v) || (v as number) < 0 || (v as number) > 14) e.push(`perWeek.${k}: canal o número inválido (0 a 14)`)
          else pw[k as MarketingChannel] = v as number
        }
        p.perWeek = pw
      }
    }
    if (r.days != null) {
      if (!Array.isArray(r.days) || !r.days.length || r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('days: 0 (domingo) a 6 (sábado)')
      else p.days = Array.from(new Set(r.days as number[])).sort()
    }
    if (r.windows != null) {
      const ws = Array.isArray(r.windows) ? r.windows : []
      if (!ws.length || ws.length > 4 || ws.some((w) => !isObj(w) || !Number.isInteger(w.from) || !Number.isInteger(w.to) || (w.from as number) < 0 || (w.to as number) > 24 || (w.to as number) <= (w.from as number))) e.push('windows: de 1 a 4 franjas {from, to} en horas enteras, from < to')
      else p.windows = ws.map((w) => ({ from: (w as { from: number }).from, to: (w as { to: number }).to }))
    }
    if (r.minGapHours != null) { if (!Number.isInteger(r.minGapHours) || (r.minGapHours as number) < 1 || (r.minGapHours as number) > 72) e.push('minGapHours: 1 a 72'); else p.minGapHours = r.minGapHours as number }
    if (r.maxPerDay != null) { if (!Number.isInteger(r.maxPerDay) || (r.maxPerDay as number) < 1 || (r.maxPerDay as number) > 5) e.push('maxPerDay: 1 a 5'); else p.maxPerDay = r.maxPerDay as number }
    if (!p.perWeek && !p.days && !p.windows && !p.minGapHours && !p.maxPerDay) e.push('No hay ningún cambio')
    return done(e, p)
  },
  describe: () => 'Cambiar la cadencia y los horarios del agente',
  entity: (p) => ({ type: 'MarketingAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { config: true, status: true, campaign: { select: { name: true } } } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    if (a.status === 'finished') return { ok: false, reason: 'El agente terminó su campaña' }
    return { ok: true, before: { campaign: a.campaign.name, config: json(a.config) } }
  },
  preview: async (p, before) => {
    const b = before as { campaign: string; config: unknown }
    const prev = configOf({ config: b.config } as never)
    const next = nextConfig(prev, p)
    const [x, y] = [scheduleSnapshot(prev), scheduleSnapshot(next)]
    const diff = (Object.keys(x) as Array<keyof typeof x>).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map((k) => ({ field: k, from: x[k], to: y[k] }))
    return { summary: `Agente de «${b.campaign}»: ${diff.length} cambios de cadencia u horario`, diff }
  },
  execute: async (p) => {
    const a = await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { config: true } })
    if (!a) throw new Error('El agente no existe')
    const next = nextConfig(configOf(a as never), p)
    await prisma.marketingAgent.update({ where: { id: p.agentId }, data: { config: json(next) } })
    return { after: { config: json(next) }, result: 'Cadencia y horarios actualizados (aplica a lo que programe desde ahora)' }
  },
  unchanged: async (p, after) => JSON.stringify((await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { config: true } }))?.config) === JSON.stringify((after as { config: unknown }).config),
  undo: async (p, before) => { await prisma.marketingAgent.update({ where: { id: p.agentId }, data: { config: json((before as { config: unknown }).config) } }) },
}

function nextConfig(prev: AgentConfig, p: ScheduleParams): AgentConfig {
  const channels = Object.fromEntries(AGENT_CHANNELS.map((ch) => [ch, { ...prev.channels[ch], ...(p.perWeek?.[ch] != null ? { perWeek: p.perWeek[ch] } : {}) }]))
  const schedule = { ...prev.schedule, ...(p.days ? { days: p.days } : {}), ...(p.windows ? { windows: p.windows } : {}), ...(p.minGapHours ? { minGapHours: p.minGapHours } : {}), ...(p.maxPerDay ? { maxPerDay: p.maxPerDay } : {}) }
  return sanitizeAgentConfig({ ...prev, channels, schedule }, prev)
}

const requestPlan: HaggoActionDef<{ agentId: string }> = {
  id: 'marketing.request_plan',
  domain: 'marketing',
  risk: 'low',
  label: 'Pedir ideas nuevas a un agente de marketing',
  hint: 'El agente planea ideas para las próximas semanas según su estrategia aprobada; quedan para aprobar en su módulo. Gasta de su presupuesto.',
  schema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] },
  sideEffects: ['spends'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { agentId: parseId(r, 'agentId', e) }) },
  describe: () => 'Pedir un plan de ideas al agente',
  entity: (p) => ({ type: 'MarketingAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.marketingAgent.findUnique({ where: { id: p.agentId }, select: { status: true, strategyApprovedAt: true, campaign: { select: { name: true } } } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    if (!a.strategyApprovedAt) return { ok: false, reason: 'El agente no tiene estrategia aprobada' }
    return { ok: true, before: { campaign: a.campaign.name } }
  },
  preview: async (_p, before) => ({ summary: `El agente de «${(before as { campaign: string }).campaign}» propone ideas nuevas (quedan para aprobar)`, diff: [] }),
  execute: async (p) => {
    const r = await withAgentLock(p.agentId, async () => {
      const agent = await loadAgent(p.agentId)
      if (!agent) throw new Error('El agente no existe')
      return planIdeas(agent)
    })
    if (!r) throw new Error('El agente está ocupado; inténtalo en unos minutos')
    if (!r.ok) throw new Error(r.error)
    return { after: null, result: r.summary }
  },
}

type IdeasParams = { agentId: string; ideaIds: string[]; decision: 'accept' | 'reject'; reason?: string }

const decideIdeasAction: HaggoActionDef<IdeasParams> = {
  id: 'marketing.decide_ideas',
  domain: 'marketing',
  risk: 'medium',
  label: 'Aceptar o rechazar ideas de un agente de marketing',
  hint: 'Decide ideas propuestas por un agente (máximo 10 a la vez). Las aceptadas pasan a redacción; al rechazar, el motivo le enseña al agente.',
  schema: { type: 'object', properties: { agentId: { type: 'string' }, ideaIds: { type: 'array', items: { type: 'string' } }, decision: { type: 'string', enum: ['accept', 'reject'] }, reason: { type: 'string', description: 'Obligatorio al rechazar' } }, required: ['agentId', 'ideaIds', 'decision'] },
  sideEffects: [],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const ids = Array.isArray(r.ideaIds) ? Array.from(new Set(r.ideaIds.filter((x): x is string => typeof x === 'string' && ID.test(x)))) : []
    if (!ids.length || ids.length > 10 || (Array.isArray(r.ideaIds) && ids.length !== new Set(r.ideaIds).size)) e.push('ideaIds: de 1 a 10 identificadores válidos')
    const decision = r.decision === 'accept' || r.decision === 'reject' ? r.decision : (e.push('decision: accept o reject'), 'accept' as const)
    const reason = parseText(r, 'reason', e, { min: 5, max: 500, optional: decision === 'accept' })
    return done(e, { agentId: parseId(r, 'agentId', e), ideaIds: ids, decision, ...(reason ? { reason } : {}) })
  },
  describe: (p) => `${p.decision === 'accept' ? 'Aceptar' : 'Rechazar'} ${p.ideaIds.length} ${p.ideaIds.length === 1 ? 'idea' : 'ideas'} del agente`,
  entity: (p) => ({ type: 'MarketingAgent', id: p.agentId }),
  preconditions: async (p) => {
    const ideas = await prisma.marketingIdea.findMany({ where: { id: { in: p.ideaIds }, agentId: p.agentId }, select: { id: true, status: true, angle: true } })
    if (ideas.length !== p.ideaIds.length) return { ok: false, reason: 'Alguna idea no existe o no es de ese agente' }
    const notPending = ideas.filter((x) => x.status !== 'proposed')
    if (notPending.length) return { ok: false, reason: `${notPending.length} de esas ideas ya se decidieron` }
    return { ok: true, before: { ideas: ideas.map((x) => ({ id: x.id, angle: x.angle.slice(0, 160) })) } }
  },
  preview: async (p, before) => {
    const ideas = (before as { ideas: Array<{ angle: string }> }).ideas
    return { summary: `${p.decision === 'accept' ? 'Pasan a redacción' : 'Se descartan'}: ${ideas.map((x) => `«${x.angle}»`).join(', ')}`, diff: ideas.map((x) => ({ field: x.angle, from: 'por decidir', to: p.decision === 'accept' ? 'aceptada' : `rechazada${p.reason ? ` (${p.reason})` : ''}` })) }
  },
  execute: async (p, ctx) => {
    const agent = await loadAgent(p.agentId)
    if (!agent) throw new Error('El agente no existe')
    const n = await decideIdeas(agent, p.ideaIds, p.decision, ctx.approverId, p.reason ?? null)
    return { after: { status: p.decision === 'accept' ? 'accepted' : 'rejected' }, result: `${n} ${n === 1 ? 'idea' : 'ideas'} ${p.decision === 'accept' ? 'aceptada(s)' : 'rechazada(s)'}` }
  },
  unchanged: async (p, after) => {
    const want = (after as { status: string }).status
    const ideas = await prisma.marketingIdea.findMany({ where: { id: { in: p.ideaIds } }, select: { status: true, postId: true } })
    return ideas.length === p.ideaIds.length && ideas.every((x) => x.status === want && !x.postId)
  },
  undo: async (p) => { await prisma.marketingIdea.updateMany({ where: { id: { in: p.ideaIds }, postId: null }, data: { status: 'proposed', rejectedReason: null, decidedById: null, decidedAt: null } }) },
}

const draftIdeaAction: HaggoActionDef<{ agentId: string; ideaId: string; instruction?: string }> = {
  id: 'marketing.draft_idea',
  domain: 'marketing',
  risk: 'medium',
  label: 'Pedir a un agente de marketing que redacte una idea',
  hint: 'El agente escribe ya una idea aceptada (textos por canal e imagen). Según su modo queda en revisión o se programa sola. Gasta de su presupuesto.',
  schema: { type: 'object', properties: { agentId: { type: 'string' }, ideaId: { type: 'string' }, instruction: { type: 'string', description: 'Opcional: indicación para el agente' } }, required: ['agentId', 'ideaId'] },
  sideEffects: ['spends', 'publishes'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; const instruction = parseText(r, 'instruction', e, { max: 1000, optional: true }); return done(e, { agentId: parseId(r, 'agentId', e), ideaId: parseId(r, 'ideaId', e), ...(instruction ? { instruction } : {}) }) },
  describe: () => 'Redactar la idea ahora',
  entity: (p) => ({ type: 'MarketingIdea', id: p.ideaId }),
  preconditions: async (p) => {
    const idea = await prisma.marketingIdea.findFirst({ where: { id: p.ideaId, agentId: p.agentId }, select: { status: true, angle: true, agent: { select: { mode: true, status: true, campaign: { select: { name: true } } } } } })
    if (!idea) return { ok: false, reason: 'La idea no existe o no es de ese agente' }
    if (idea.status !== 'accepted') return { ok: false, reason: idea.status === 'proposed' ? 'La idea todavía no está aceptada' : 'La idea ya se redactó o se descartó' }
    return { ok: true, before: { angle: idea.angle.slice(0, 200), mode: idea.agent.mode, campaign: idea.agent.campaign.name } }
  },
  preview: async (_p, before) => {
    const b = before as { angle: string; mode: string; campaign: string }
    return { summary: `El agente de «${b.campaign}» redacta «${b.angle}»`, diff: [{ field: 'Después', from: 'idea aceptada', to: b.mode === 'copilot' ? 'borrador en revisión' : b.mode === 'supervised' ? 'se programa y sale si nadie la frena' : 'se programa y publica sola' }] }
  },
  execute: async (p) => {
    const r = await withAgentLock(p.agentId, async () => {
      const agent = await loadAgent(p.agentId)
      if (!agent) throw new Error('El agente no existe')
      return draftIdea(agent, p.ideaId, { instruction: p.instruction ?? null })
    })
    if (!r) throw new Error('El agente está ocupado; inténtalo en unos minutos')
    if (!r.ok) throw new Error(r.error)
    return { after: null, result: r.summary }
  },
}

export const MARKETING_ACTIONS = [reschedule, retry, approve, cancel, pause, activate, updateSchedule, requestPlan, decideIdeasAction, draftIdeaAction] as unknown as HaggoActionDef[]
