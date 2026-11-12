import { prisma } from '@/lib/prisma'
import { SeoError, dismissOpportunity, markOpportunityDone, reopenOpportunity, runSeoCycle, sendOpportunityToMarketing } from '@/lib/seo/agent/agent'
import { webMarketingAgent } from '@/lib/seo/agent/marketing-bridge'
import { ARTICLE_KINDS } from '@/lib/seo/agent/types'
import { done, parseId, parseText, requireObj, type HaggoActionDef } from '@/lib/haggo/actions/types'

const fail = (e: unknown): never => { throw new Error(e instanceof SeoError ? e.message : 'No se pudo completar la acción de SEO') }
const run = async <T,>(p: Promise<T>) => p.catch(fail)

const select = { id: true, title: true, kind: true, status: true, marketingIdeaId: true, dismissedReason: true } as const
const label = (b: unknown) => `«${(b as { title: string }).title}»`

/** Both cycle actions: the free one (rules only) and the one that also lets the model write briefs and the weekly report. */
function cycleAction(withAi: boolean): HaggoActionDef<Record<string, never>> {
  return {
    id: withAi ? 'seo.run_cycle_ai' : 'seo.run_cycle',
    domain: 'marketing',
    risk: withAi ? 'medium' : 'low',
    label: withAi ? 'Correr el ciclo de SEO con IA' : 'Correr el ciclo de SEO (solo reglas)',
    hint: withAi
      ? 'Corre ya el ciclo del agente de SEO con IA: además de las reglas escribe los briefs de artículos y el informe, dentro de su presupuesto mensual (gasta en IA). Úsala si el último ciclo con IA falló o hay oportunidades sin brief y hay presupuesto.'
      : 'Corre ya el ciclo del agente de SEO solo con reglas (gratis): catálogo, ciudades, blog, búsquedas sin resultado, revisión técnica de páginas públicas y Search Console. No publica nada. Úsala si el ciclo diario no corrió o falló.',
    schema: { type: 'object', properties: {} },
    sideEffects: withAi ? ['spends'] : [],
    parse: (raw) => { const r = requireObj(raw); if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done<Record<string, never>>(Object.keys(r).length ? ['Esta acción no recibe parámetros'] : [], {}) },
    describe: () => (withAi ? 'Correr el ciclo de SEO con IA' : 'Correr el ciclo de SEO (reglas)'),
    entity: () => ({ type: 'SeoRun', id: 'cycle' }),
    preconditions: async () => {
      const running = await prisma.seoRun.findFirst({ where: { type: 'cycle', status: 'running', startedAt: { gte: new Date(Date.now() - 10 * 60_000) } }, select: { id: true } }).catch(() => null)
      if (running) return { ok: false, reason: 'Ya hay un ciclo de SEO en marcha' }
      return { ok: true, before: { withAi } }
    },
    preview: async () => ({ summary: withAi ? 'Se corre el ciclo de SEO con reglas y con IA (briefs e informe, dentro del presupuesto)' : 'Se corre el ciclo de SEO solo con reglas: no publica nada', diff: [] }),
    execute: async () => {
      const r = await run(runSeoCycle({ trigger: 'haggo', force: true, withAi }))
      if (!r.ok) throw new Error(r.error ?? r.summary)
      return { after: { runId: r.runId ?? null }, result: r.skipped ? `No corrió: ${r.summary}` : r.summary }
    },
  }
}

const runCycle = cycleAction(false)
const runCycleAi = cycleAction(true)

const send: HaggoActionDef<{ opportunityId: string }> = {
  id: 'seo.send_to_marketing',
  domain: 'marketing',
  risk: 'low',
  label: 'Enviar una oportunidad de SEO al agente de marketing',
  hint: 'Pone el brief de un artículo (oportunidad de contenido nuevo, demanda sin atender, casos reales o actualización) en el backlog del agente de marketing como idea del canal web; el redactor la escribe con su palabra clave y su guion. Si no tiene brief, el agente lo escribe antes (puede gastar en IA). No publica nada.',
  schema: { type: 'object', properties: { opportunityId: { type: 'string' } }, required: ['opportunityId'] },
  sideEffects: ['spends'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { opportunityId: parseId(r, 'opportunityId', e) }) },
  describe: () => 'Enviar la oportunidad de SEO a marketing',
  entity: (p) => ({ type: 'SeoOpportunity', id: p.opportunityId }),
  preconditions: async (p) => {
    const o = await prisma.seoOpportunity.findUnique({ where: { id: p.opportunityId }, select: { ...select, brief: true } })
    if (!o) return { ok: false, reason: 'La oportunidad no existe' }
    if (!ARTICLE_KINDS.includes(o.kind as never)) return { ok: false, reason: 'Es un arreglo, no un artículo: lo hace el equipo' }
    if (o.marketingIdeaId) return { ok: false, reason: 'Ya está en el calendario de marketing' }
    if (!['open', 'briefed'].includes(o.status)) return { ok: false, reason: 'Ya fue resuelta o descartada' }
    if (!(await webMarketingAgent().catch(() => null))) return { ok: false, reason: 'No hay un agente de marketing activo con el canal web encendido' }
    return { ok: true, before: { title: o.title, kind: o.kind, status: o.status, hasBrief: Boolean(o.brief) } }
  },
  preview: async (_p, before) => {
    const b = before as { title: string; status: string; hasBrief: boolean }
    return { summary: `${label(before)} entra al backlog del agente de marketing como idea web (con versiones de Instagram y Facebook si la configuración lo pide)${b.hasBrief ? '' : ' (antes se le escribe el brief)'}`, diff: [{ field: 'Estado', from: b.status, to: 'enviada a marketing' }] }
  },
  execute: async (p) => {
    const r = await run(sendOpportunityToMarketing(p.opportunityId, 'haggo'))
    return { after: { ideaId: r.ok ? r.ideaId : null }, result: 'Enviada: quedó como idea del canal web en el backlog de marketing' }
  },
  unchanged: async (p, after) => {
    const ideaId = (after as { ideaId: string | null }).ideaId
    if (!ideaId) return false
    const idea = await prisma.marketingIdea.findUnique({ where: { id: ideaId }, select: { status: true, postId: true } })
    return Boolean(idea && ['proposed', 'accepted'].includes(idea.status) && !idea.postId)
  },
  undo: async (p, _before, after) => {
    const ideaId = (after as { ideaId: string | null } | null)?.ideaId
    if (!ideaId) throw new Error('No se sabe qué idea se creó: quítala a mano en Marketing')
    const gone = await prisma.marketingIdea.deleteMany({ where: { id: ideaId, status: { in: ['proposed', 'accepted'] }, postId: null } })
    if (!gone.count) throw new Error('El agente de marketing ya empezó a escribir esa idea: no se puede deshacer')
    // The brief written on the way stays, so the opportunity goes back to «briefed»
    await prisma.seoOpportunity.updateMany({ where: { id: p.opportunityId, marketingIdeaId: ideaId }, data: { marketingIdeaId: null, status: 'briefed' } })
  },
}

const dismiss: HaggoActionDef<{ opportunityId: string; reason: string }> = {
  id: 'seo.dismiss_opportunity',
  domain: 'marketing',
  risk: 'low',
  label: 'Descartar una oportunidad de SEO',
  hint: 'Descarta una oportunidad abierta del agente de SEO que no aplica (con el motivo). El agente no vuelve a proponer lo mismo mientras siga descartada. Se puede reabrir.',
  schema: { type: 'object', properties: { opportunityId: { type: 'string' }, reason: { type: 'string', description: 'Por qué no aplica (5 a 300 caracteres)' } }, required: ['opportunityId', 'reason'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { opportunityId: parseId(r, 'opportunityId', e), reason: parseText(r, 'reason', e, { min: 5, max: 300 }) as string }) },
  describe: (p) => `Descartar la oportunidad de SEO: ${p.reason}`,
  entity: (p) => ({ type: 'SeoOpportunity', id: p.opportunityId }),
  preconditions: async (p) => {
    const o = await prisma.seoOpportunity.findUnique({ where: { id: p.opportunityId }, select: select })
    if (!o) return { ok: false, reason: 'La oportunidad no existe' }
    if (!['open', 'briefed'].includes(o.status)) return { ok: false, reason: 'Ya está en marcha o resuelta' }
    return { ok: true, before: { title: o.title, status: o.status } }
  },
  preview: async (p, before) => ({ summary: `${label(before)} se descarta: ${p.reason}`, diff: [{ field: 'Estado', from: (before as { status: string }).status, to: 'descartada' }] }),
  execute: async (p) => {
    await run(dismissOpportunity(p.opportunityId, p.reason))
    return { after: { status: 'dismissed' }, result: 'Descartada' }
  },
  unchanged: async (p) => (await prisma.seoOpportunity.findUnique({ where: { id: p.opportunityId }, select: { status: true } }))?.status === 'dismissed',
  undo: async (p) => { await run(reopenOpportunity(p.opportunityId)) },
}

const markDone: HaggoActionDef<{ opportunityId: string }> = {
  id: 'seo.mark_done',
  domain: 'marketing',
  risk: 'low',
  label: 'Marcar una oportunidad de SEO como hecha',
  hint: 'Marca como resuelta una oportunidad que ya se atendió (por ejemplo un arreglo técnico que el equipo hizo). Se puede reabrir.',
  schema: { type: 'object', properties: { opportunityId: { type: 'string' } }, required: ['opportunityId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { opportunityId: parseId(r, 'opportunityId', e) }) },
  describe: () => 'Marcar la oportunidad de SEO como hecha',
  entity: (p) => ({ type: 'SeoOpportunity', id: p.opportunityId }),
  preconditions: async (p) => {
    const o = await prisma.seoOpportunity.findUnique({ where: { id: p.opportunityId }, select: select })
    if (!o) return { ok: false, reason: 'La oportunidad no existe' }
    if (!['open', 'briefed', 'sent'].includes(o.status)) return { ok: false, reason: 'Ya estaba resuelta o descartada' }
    return { ok: true, before: { title: o.title, status: o.status } }
  },
  preview: async (_p, before) => ({ summary: `${label(before)} queda como hecha`, diff: [{ field: 'Estado', from: (before as { status: string }).status, to: 'hecha' }] }),
  execute: async (p) => {
    await run(markOpportunityDone(p.opportunityId))
    return { after: { status: 'done' }, result: 'Marcada como hecha' }
  },
  unchanged: async (p) => (await prisma.seoOpportunity.findUnique({ where: { id: p.opportunityId }, select: { status: true } }))?.status === 'done',
  undo: async (p) => { await run(reopenOpportunity(p.opportunityId)) },
}

export const SEO_ACTIONS = [runCycle, runCycleAi, send, dismiss, markDone] as unknown as HaggoActionDef[]
