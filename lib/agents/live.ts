/**
 * Live state of each agent, from the platform's own data. One query set for the admin panel and Haggo's `agentes`
 * tool. Every part has its own fallback: one failing query leaves that agent «sin datos», never the whole picture.
 */
import { prisma } from '@/lib/prisma'
import { AGENTS, type AgentKey } from '@/lib/agents/registry'
import { seoSnapshot } from '@/lib/seo/agent/views'

const H = 3_600_000

export type AgentLive = { key: AgentKey; status: 'ok' | 'attention' | 'off' | 'unknown'; headline: string; details: string[] }

async function safe<T>(p: PromiseLike<T>): Promise<T | null> {
  try { return await p } catch { return null }
}

export async function agentsLive(now = new Date()): Promise<AgentLive[]> {
  const day = new Date(now.getTime() - 24 * H)
  const week = new Date(now.getTime() - 7 * 24 * H)
  const [haggo, inbox, gaps, marketing, ideas, editorial, seo, adRuns, copilot] = await Promise.all([
    safe(prisma.haggoRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { type: true, status: true, startedAt: true, error: true } })),
    safe(prisma.aiAgent.findMany({ where: { status: 'active' }, select: { name: true, autopilot: true } })),
    safe(prisma.aiKnowledgeGap.count({ where: { status: 'open' } })),
    safe(prisma.marketingAgent.findMany({ where: { status: 'active' }, select: { mode: true, degradedReason: true, lastRunAt: true, campaign: { select: { name: true } } } })),
    safe(prisma.marketingIdea.count({ where: { status: 'proposed' } })),
    safe(Promise.all([prisma.marketingReview.count({ where: { createdAt: { gte: week }, verdict: { in: ['changes', 'rejected'] } } }), prisma.marketingReview.count({ where: { createdAt: { gte: week }, verdict: { not: 'error' } } })])),
    seoSnapshot(now).catch(() => null),
    safe(prisma.aiCall.count({ where: { kind: 'marketing_ad_agent', createdAt: { gte: week } } })),
    safe(prisma.aiSuggestion.count({ where: { createdAt: { gte: day } } })),
  ])
  const out: Record<AgentKey, AgentLive> = {
    haggo: haggo
      ? { key: 'haggo', status: haggo.status === 'error' ? 'attention' : 'ok', headline: `Último ciclo hace ${Math.round((now.getTime() - haggo.startedAt.getTime()) / 60_000)} min (${haggo.status})`, details: haggo.error ? [`Error: ${haggo.error.slice(0, 160)}`] : [] }
      : { key: 'haggo', status: 'unknown', headline: 'Sin datos', details: [] },
    inbox: inbox
      ? { key: 'inbox', status: inbox.length ? 'ok' : 'off', headline: `${inbox.length} agentes activos (${inbox.filter((a) => a.autopilot).length} en piloto)`, details: gaps ? [`${gaps} preguntas sin responder en la base de conocimiento`] : [] }
      : { key: 'inbox', status: 'unknown', headline: 'Sin datos', details: [] },
    copilot: { key: 'copilot', status: copilot === null ? 'unknown' : 'ok', headline: copilot === null ? 'Sin datos' : `${copilot} sugerencias en 24 h`, details: [] },
    marketing: marketing
      ? { key: 'marketing', status: marketing.some((m) => m.degradedReason) ? 'attention' : marketing.length ? 'ok' : 'off', headline: `${marketing.length} agentes activos, ${ideas ?? 0} ideas por decidir`, details: marketing.filter((m) => m.degradedReason).map((m) => `${m.campaign.name}: ${m.degradedReason}`.slice(0, 200)) }
      : { key: 'marketing', status: 'unknown', headline: 'Sin datos', details: [] },
    editorial: editorial
      ? { key: 'editorial', status: 'ok', headline: `${editorial[1]} revisiones en 7 días, ${editorial[0]} pidieron cambios`, details: [] }
      : { key: 'editorial', status: 'unknown', headline: 'Sin datos', details: [] },
    ads: { key: 'ads', status: adRuns === null ? 'unknown' : adRuns ? 'ok' : 'off', headline: adRuns === null ? 'Sin datos' : `${adRuns} llamadas en 7 días`, details: [] },
    seo: seo && seo.tablesReady
      ? { key: 'seo', status: !seo.enabled ? 'off' : seo.lastCycleFailed || (seo.hoursSinceCycle ?? 999) > 36 ? 'attention' : 'ok', headline: `Salud ${seo.health ?? '—'}/100, ${seo.open} oportunidades abiertas (${seo.highOpen} de alto impacto)`, details: [seo.gsc === 'ok' ? 'Search Console conectado' : `Search Console: ${seo.gsc}`] }
      : { key: 'seo', status: 'unknown', headline: 'Sin datos', details: [] },
  }
  return AGENTS.map((a) => out[a.key])
}
