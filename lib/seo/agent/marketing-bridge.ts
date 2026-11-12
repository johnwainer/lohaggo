/**
 * The two-way bridge between the SEO agent and the marketing agent.
 *  SEO → marketing: a brief becomes an idea in the marketing backlog (channel WEB), the marketing planner
 *  receives the keywords to push and the topics to avoid, and the writer receives the brief of its idea.
 *  Marketing → SEO: published articles, their views, what the planner already has in its backlog and what its
 *  weekly retrospective learned feed the SEO cycle (see facts.ts and agent.ts).
 */
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/marketing/seo'
import { norm } from '@/lib/seo/agent/audit-core'
import type { SeoBrief } from '@/lib/seo/agent/types'
import type { SeoConfig } from '@/lib/seo/agent/settings-core'

const DAY = 86_400_000

/** The marketing agent that writes the blog: active, strategy approved, web channel on. */
export async function webMarketingAgent() {
  const agents = await prisma.marketingAgent.findMany({
    where: { status: 'active', strategyApprovedAt: { not: null } },
    select: { id: true, config: true, strategy: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })
  const web = agents.find((a) => ((a.config as { channels?: { WEB?: { enabled?: boolean } } } | null)?.channels?.WEB?.enabled) === true)
  return web ?? null
}

/** The pillar of the agent's strategy that fits the piece best (the planner's backlog is organized by pillar). */
function pillarFor(strategy: unknown, hint: string): string {
  const pillars = ((strategy as { pillars?: Array<{ name: string; services?: string[] }> } | null)?.pillars ?? []).filter((p) => p?.name)
  if (!pillars.length) return 'SEO'
  const h = norm(hint)
  return (pillars.find((p) => (p.services ?? []).some((s) => h.includes(norm(s)))) ?? pillars.find((p) => /gu[ií]a|educa|consejo|tips|conoc/i.test(p.name)) ?? pillars[0]).name
}

export type SendResult = { ok: true; ideaId: string; agentId: string } | { ok: false; reason: string }

/** Puts a brief in the marketing backlog as a WEB idea, on the first free day from tomorrow. Never creates two ideas for one opportunity. */
export async function sendBriefToMarketing(opp: { id: string; marketingIdeaId: string | null; serviceSlug?: string | null }, brief: SeoBrief, config: Pick<SeoConfig, 'autoAcceptIdeas' | 'socialAdaptation'>, now = new Date()): Promise<SendResult> {
  if (opp.marketingIdeaId) return { ok: false, reason: 'Ya está en el calendario de marketing' }
  const agent = await webMarketingAgent()
  if (!agent) return { ok: false, reason: 'No hay un agente de marketing activo con el canal web encendido' }
  const taken = await prisma.marketingIdea.findMany({ where: { agentId: agent.id, channels: { has: 'WEB' }, status: { in: ['proposed', 'accepted', 'drafted'] }, targetDate: { gte: new Date(now.getTime() - DAY) } }, select: { targetDate: true } })
  const busy = new Set(taken.map((t) => new Date(t.targetDate.getTime() - 5 * 3600_000).toISOString().slice(0, 10)))
  let day = new Date(now.getTime() - 5 * 3600_000 + DAY)
  for (let i = 0; i < 60 && busy.has(day.toISOString().slice(0, 10)); i++) day = new Date(day.getTime() + DAY)
  const key = day.toISOString().slice(0, 10)
  const service = opp.serviceSlug ? (await prisma.service.findUnique({ where: { slug: opp.serviceSlug }, select: { name: true } }))?.name ?? null : null
  // The same keyword and topic also go to the networks the agent publishes on (a link post and a feed post that point to the article)
  const channelsOn = (agent.config as { channels?: Record<string, { enabled?: boolean }> } | null)?.channels ?? {}
  const social: Array<'INSTAGRAM' | 'FACEBOOK'> = config.socialAdaptation ? (['INSTAGRAM', 'FACEBOOK'] as const).filter((c) => channelsOn[c]?.enabled === true) : []
  const formats: Record<string, string> = { WEB: brief.format, ...(social.includes('INSTAGRAM') ? { INSTAGRAM: 'feed' } : {}), ...(social.includes('FACEBOOK') ? { FACEBOOK: 'enlace' } : {}) }
  const idea = await prisma.marketingIdea.create({
    data: {
      agentId: agent.id, pillar: pillarFor(agent.strategy, `${brief.keyword} ${service ?? ''}`), service,
      angle: brief.title.slice(0, 160), hypothesis: `Posicionar «${brief.keyword}» (intención ${brief.intent}) y llevar a quien busca a pedir el servicio.`.slice(0, 300),
      channels: ['WEB', ...social], formats, targetDate: new Date(`${key}T12:00:00-05:00`), slotHint: 'morning',
      rationale: `Brief del agente de SEO: palabra clave «${brief.keyword}». ${brief.notes}`.slice(0, 600),
      status: config.autoAcceptIdeas ? 'accepted' : 'proposed', score: 0.9, explore: false,
    },
    select: { id: true },
  })
  await prisma.seoOpportunity.update({ where: { id: opp.id }, data: { marketingIdeaId: idea.id, status: 'sent' } })
  return { ok: true, ideaId: idea.id, agentId: agent.id }
}

/** The brief of the idea the writer is about to draft (null if the idea does not come from SEO). */
export async function briefForIdea(ideaId: string): Promise<SeoBrief | null> {
  try {
    const opp = await prisma.seoOpportunity.findUnique({ where: { marketingIdeaId: ideaId }, select: { brief: true } })
    return (opp?.brief as SeoBrief | null) ?? null
  } catch {
    return null
  }
}

/** The brief as the writer reads it: the plan, the facts it may cite and the links it must carry. */
export function briefText(b: SeoBrief): string {
  return [
    `Palabra clave principal: ${b.keyword}${b.secondary.length ? ` (variantes: ${b.secondary.join(', ')})` : ''}. Intención: ${b.intent}.`,
    `Título del artículo: ${b.title}\nTítulo SEO (≤60): ${b.seoTitle}\nDescripción SEO: ${b.seoDescription}`,
    `Estructura (cada sección con su h2):\n${b.outline.map((o, i) => `${i + 1}. ${o.h2}\n${o.points.map((p) => `   - ${p}`).join('\n')}`).join('\n')}`,
    `Preguntas frecuentes (inclúyelas al final, con estas respuestas como base):\n${b.faqs.map((f) => `- ${f.q} → ${f.a}`).join('\n')}`,
    b.internalLinks.length ? `Enlaces internos obligatorios (en Markdown, con el ancla indicada):\n${b.internalLinks.map((l) => `- [${l.anchor}](${l.url.startsWith('http') ? l.url : `${SITE_URL}${l.url}`})`).join('\n')}` : '',
    b.facts.length ? `Datos de la plataforma que puedes citar (no hay otros datos):\n${b.facts.map((f) => `- ${f}`).join('\n')}` : 'No cites cifras ni precios.',
    `Cierre: ${b.cta}`,
    b.notes ? `Notas del estratega SEO: ${b.notes}` : '',
  ].filter(Boolean).join('\n\n')
}

/** Short rules every web piece follows, with or without a brief. */
export const WEB_SEO_RULES = 'SEO del blog: una sola palabra clave principal en el título, la primera frase y algún subtítulo (sin forzarla); subtítulos h2 que respondan preguntas reales; al menos 3 enlaces internos a páginas de lohaggo.com (servicios, precios, ciudad); preguntas frecuentes al final con respuestas directas; título SEO ≤ 60 y descripción de 120 a 155 caracteres con la promesa concreta; nada de cifras que no vengan de los datos de la plataforma.'

/**
 * What the marketing planner receives about SEO: what to push, what is already covered and what already
 * works. Empty (null) when there is nothing to say, so the prompt stays as it was.
 */
export async function seoGuidanceForPlanner(now = new Date()): Promise<string | null> {
  try {
    const [open, covered, lastReport] = await Promise.all([
      prisma.seoOpportunity.findMany({ where: { status: { in: ['open', 'briefed'] }, kind: { in: ['content_gap', 'demand_gap', 'ugc', 'programmatic'] } }, orderBy: { score: 'desc' }, take: 8, select: { title: true, keyword: true, serviceSlug: true, citySlug: true, status: true } }),
      prisma.marketingPostVariant.findMany({ where: { channel: 'WEB', webPublishedAt: { not: null, lte: now }, slug: { not: null } }, orderBy: { webPublishedAt: 'desc' }, take: 25, select: { post: { select: { title: true } } } }),
      prisma.seoRun.findFirst({ where: { type: 'report', status: 'ok' }, orderBy: { startedAt: 'desc' }, select: { output: true } }),
    ])
    const forMarketing = ((lastReport?.output as { forMarketing?: string[] } | null)?.forMarketing ?? []).slice(0, 4)
    if (!open.length && !forMarketing.length) return null
    return [
      'Agente de SEO (trabaja contigo: sus palabras clave y sus avisos valen para el blog y para Instagram y Facebook):',
      open.length ? `Búsquedas que conviene atacar (el brief completo llega con la idea cuando el SEO la envía; no dupliques estas ideas, enriquécelas con ángulos de redes):\n${open.map((o) => `- ${o.keyword ?? o.title}${o.citySlug ? ` (${o.citySlug})` : ''}`).join('\n')}` : '',
      covered.length ? `Artículos ya publicados en el blog (no compitas con ellos, enlázalos):\n${covered.map((c) => `- ${c.post.title}`).join('\n')}` : '',
      forMarketing.length ? `Indicaciones del SEO para esta semana:\n${forMarketing.map((f) => `- ${f}`).join('\n')}` : '',
      WEB_SEO_RULES,
    ].filter(Boolean).join('\n\n')
  } catch {
    return null
  }
}
