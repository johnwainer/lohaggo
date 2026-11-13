/**
 * The SEO agent: one cycle reads the platform and Search Console, finds opportunities with rules (free),
 * and once a week uses the model to write article briefs and a growth report. Everything it writes is a
 * plan: briefs go to the marketing agent's backlog, fixes go to the team and to Haggo. It never publishes.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { callAI, describeApiError } from '@/lib/ai/anthropic'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { toolInput } from '@/lib/marketing/agent-core'
import { getPricesSafe } from '@/lib/seo/data'
import { priceLabel } from '@/lib/seo/prices'
import { slugify } from '@/lib/marketing/seo'
import { detectOpportunities, healthScore, scoreOf, type SeoFacts } from '@/lib/seo/agent/audit-core'
import { BRIEF_TOOL, REPORT_TOOL, SEO_SYSTEM, briefTask, reportTask, sanitizeBrief, sanitizeReport, type BriefContext } from '@/lib/seo/agent/brief-core'
import { gatherFacts } from '@/lib/seo/agent/facts'
import { announceNewGuides, processIncoming, sendGuidanceToMarketing } from '@/lib/seo/agent/bus'
import { sendBriefToMarketing, webMarketingAgent } from '@/lib/seo/agent/marketing-bridge'
import { getSeoSettings } from '@/lib/seo/agent/settings'
import type { SeoConfig } from '@/lib/seo/agent/settings-core'
import { ARTICLE_KINDS, type Candidate, type SeoBrief } from '@/lib/seo/agent/types'

const logger = createLogger('seo-agent')
const DAY = 86_400_000
const CALL_TIMEOUT_MS = 120_000

export class SeoError extends Error {}
const json = (v: unknown) => JSON.parse(JSON.stringify(v))

export type Trigger = 'cron' | 'manual' | 'haggo' | 'marketing'

// ─── Spend ───────────────────────────────────────────────────────────────────

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

export async function seoSpend(now = new Date()) {
  const agg = await prisma.seoRun.aggregate({ where: { startedAt: { gte: monthStart(now) } }, _sum: { costUsd: true } }).catch(() => null)
  return agg?._sum.costUsd ?? 0
}

/** Why the model may not be called now, or null. */
async function spendBlock(config: SeoConfig, now = new Date()): Promise<string | null> {
  const settings = await getAiSettings()
  if (!hasTextProvider(settings)) return 'La IA no está configurada (falta la clave en IA · Plataforma)'
  const spent = await seoSpend(now)
  if (spent >= config.monthlyBudgetUsd) return `Presupuesto mensual del agente de SEO agotado ($${spent.toFixed(2)} de $${config.monthlyBudgetUsd})`
  return null
}

class Meter {
  cost = 0
  tokensIn = 0
  tokensOut = 0
  model: string | null = null
  add(r: { costUsd: number; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }; model: string }) {
    this.cost += r.costUsd
    this.tokensIn += r.usage.inputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens
    this.tokensOut += r.usage.outputTokens
    this.model = r.model
  }
  get data() { return { costUsd: this.cost, tokensIn: this.tokensIn, tokensOut: this.tokensOut, model: this.model } }
}

async function callTool(tool: Anthropic.Tool, kind: 'seo_agent_brief' | 'seo_agent_report', task: string, meter: Meter, maxTokens = 5000) {
  const settings = await getAiSettings()
  let tokens = maxTokens
  for (let attempt = 0; ; attempt++) {
    let result
    try {
      result = await callAI(
        { model: settings.defaultModel, system: [{ type: 'text', text: SEO_SYSTEM }], messages: [{ role: 'user', content: task }], tools: [tool], maxTokens: tokens, effort: 'medium', timeoutMs: CALL_TIMEOUT_MS },
        { kind },
      )
    } catch (err) {
      throw new SeoError(describeApiError(err))
    }
    meter.add(result)
    if (result.message.stop_reason === 'refusal') throw new SeoError('El modelo no quiso hacer esta tarea')
    if (result.message.stop_reason === 'max_tokens') {
      if (attempt === 0) { tokens = Math.min(16000, tokens * 2); continue }
      throw new SeoError('La respuesta salió demasiado larga; inténtalo de nuevo')
    }
    const input = toolInput(result.message.content, tool.name)
    if (input === null) throw new SeoError('El modelo no entregó la respuesta en el formato pedido')
    return input
  }
}

async function withRun<T>(type: string, trigger: Trigger, input: unknown, fn: (m: Meter) => Promise<{ summary: string; value: T; output?: unknown; skipped?: boolean }>): Promise<{ ok: true; runId: string; value: T; summary: string; skipped: boolean } | { ok: false; runId: string; error: string }> {
  const run = await prisma.seoRun.create({ data: { type, trigger, input: input == null ? undefined : json(input) } })
  const meter = new Meter()
  try {
    const r = await fn(meter)
    await prisma.seoRun.update({ where: { id: run.id }, data: { status: r.skipped ? 'skipped' : 'ok', summary: r.summary.slice(0, 1000), output: r.output == null ? undefined : json(r.output), ...meter.data, finishedAt: new Date() } })
    return { ok: true, runId: run.id, value: r.value, summary: r.summary, skipped: Boolean(r.skipped) }
  } catch (err) {
    const message = err instanceof SeoError ? err.message : describeApiError(err)
    logger.warn('SEO run failed', { type, message })
    await prisma.seoRun.update({ where: { id: run.id }, data: { status: 'error', error: message.slice(0, 1000), ...meter.data, finishedAt: new Date() } }).catch(() => null)
    return { ok: false, runId: run.id, error: message }
  }
}

// ─── Opportunities ───────────────────────────────────────────────────────────

/**
 * Saves what the rules found today and closes what is no longer true. A finding that disappeared from the
 * rules closes by itself (done); one a person dismissed stays dismissed; one done that comes back after two
 * weeks reopens. Returns counts.
 */
export async function syncOpportunities(candidates: Candidate[], now = new Date()) {
  const existing = await prisma.seoOpportunity.findMany({ select: { id: true, dedupeKey: true, status: true, source: true, resolvedAt: true, marketingIdeaId: true } })
  const byKey = new Map(existing.map((e) => [e.dedupeKey, e]))
  const seen = new Set<string>()
  let created = 0
  let reopened = 0
  for (const c of candidates) {
    seen.add(c.dedupeKey)
    const row = byKey.get(c.dedupeKey)
    const data = { title: c.title.slice(0, 200), detail: c.detail.slice(0, 1500), targetUrl: c.targetUrl ?? null, keyword: c.keyword ?? null, serviceSlug: c.serviceSlug ?? null, citySlug: c.citySlug ?? null, score: c.score, impact: c.impact, effort: c.effort, evidence: c.evidence ? json(c.evidence) : Prisma.JsonNull, lastSeenAt: now }
    if (!row) {
      await prisma.seoOpportunity.create({ data: { ...data, kind: c.kind, source: c.source, dedupeKey: c.dedupeKey } }).then(() => { created++ }).catch((err) => { if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err })
      continue
    }
    if (row.status === 'dismissed') { await prisma.seoOpportunity.update({ where: { id: row.id }, data: { lastSeenAt: now } }); continue }
    if (row.status === 'done') {
      if (row.resolvedAt && now.getTime() - row.resolvedAt.getTime() > 14 * DAY) { await prisma.seoOpportunity.update({ where: { id: row.id }, data: { ...data, status: 'open', resolvedAt: null } }); reopened++ }
      else await prisma.seoOpportunity.update({ where: { id: row.id }, data: { lastSeenAt: now } })
      continue
    }
    await prisma.seoOpportunity.update({ where: { id: row.id }, data })
  }
  // Closing condition: a finding from the rules that no longer appears is solved (AI proposals and evergreen items are decided by people)
  const gone = existing.filter((e) => !seen.has(e.dedupeKey) && ['open', 'briefed'].includes(e.status) && ['rules', 'gsc', 'page_audit'].includes(e.source) && !e.dedupeKey.startsWith('evergreen:'))
  if (gone.length) await prisma.seoOpportunity.updateMany({ where: { id: { in: gone.map((g) => g.id) } }, data: { status: 'done', resolvedAt: now, dismissedReason: null } })
  // Sent to marketing and published: done
  const sent = existing.filter((e) => e.status === 'sent' && e.marketingIdeaId)
  let published = 0
  if (sent.length) {
    const ideas = await prisma.marketingIdea.findMany({ where: { id: { in: sent.map((s) => s.marketingIdeaId!) } }, select: { id: true, status: true, postId: true } })
    const postIds = ideas.map((i) => i.postId).filter((p): p is string => Boolean(p))
    const posts = postIds.length ? await prisma.marketingPost.findMany({ where: { id: { in: postIds }, status: { in: ['published', 'partial'] } }, select: { id: true } }) : []
    const donePosts = new Set(posts.map((p) => p.id))
    const doneIdeas = new Set(ideas.filter((i) => i.postId && donePosts.has(i.postId)).map((i) => i.id))
    const rejected = new Set(ideas.filter((i) => i.status === 'rejected').map((i) => i.id))
    for (const s of sent) {
      if (doneIdeas.has(s.marketingIdeaId!)) { await prisma.seoOpportunity.update({ where: { id: s.id }, data: { status: 'done', resolvedAt: now } }); published++ }
      // The marketing team turned the idea down: it goes back to the list without its link
      else if (rejected.has(s.marketingIdeaId!)) await prisma.seoOpportunity.update({ where: { id: s.id }, data: { status: 'briefed', marketingIdeaId: null } })
    }
  }
  return { created, reopened, closed: gone.length, published }
}

// ─── Briefs ──────────────────────────────────────────────────────────────────

async function pagesList(facts: SeoFacts) {
  const prices = await getPricesSafe()
  const priceSlugs = new Set(facts.pricePageSlugs)
  const pages: Array<{ url: string; label: string }> = [{ url: '/', label: 'Inicio: pedir un servicio' }, { url: '/servicios', label: 'Todos los servicios' }, { url: '/precios', label: 'Precios de referencia' }, { url: '/blog', label: 'Blog' }, { url: '/garantia', label: 'Garantía LoHaggo' }, { url: '/unete', label: 'Para socios: ofrecer servicios' }]
  for (const c of facts.cities.filter((c) => c.status === 'ACTIVE')) pages.push({ url: `/ciudad/${c.slug}`, label: `Servicios en ${c.name}` })
  for (const s of facts.services.filter((s) => s.partners > 0).slice(0, 40)) pages.push({ url: `/servicios/${s.slug}`, label: s.name })
  for (const s of facts.services) if (priceSlugs.has(s.slug)) pages.push({ url: `/precios/${s.slug}`, label: `Precio de ${s.name}` })
  for (const a of facts.articles.slice(0, 20)) pages.push({ url: `/blog/${a.slug}`, label: a.title })
  return { pages, prices }
}

async function briefContext(c: { kind: Candidate['kind']; title: string; detail: string; keyword: string | null; targetUrl: string | null; evidence: unknown; serviceSlug: string | null; citySlug: string | null }, facts: SeoFacts, config: SeoConfig): Promise<{ ctx: BriefContext; allowed: string[] }> {
  const { pages, prices } = await pagesList(facts)
  const service = c.serviceSlug ? facts.services.find((s) => s.slug === c.serviceSlug) ?? null : null
  const city = c.citySlug ? facts.cities.find((x) => x.slug === c.citySlug) ?? null : null
  const lines: string[] = []
  if (service) {
    const pair = facts.supply.find((s) => s.serviceSlug === service.slug && (!city || s.citySlug === city.slug))
    lines.push(`${service.name}: ${pair?.partners ?? service.partners} ${((pair?.partners ?? service.partners) === 1) ? 'socio verificado' : 'socios verificados'}${city ? ` en ${city.name}` : ''}.`)
    const price = prices?.items.find((p) => p.slug === service.slug)
    if (price) lines.push(`Precio de referencia de ${service.name}: ${priceLabel(price.info)}${price.info.source === 'proposals' ? ` (según ${price.info.sample} propuestas reales)` : ' (precio base del catálogo)'}.`)
    if (service.goodReviews >= 3) lines.push(`${service.goodReviews} reseñas con comentario de clientes de ${service.name}.`)
  }
  lines.push('Los socios de LoHaggo están verificados (documento de identidad) y el pago es directo con el socio, en efectivo o por transferencia.')
  lines.push('Garantía LoHaggo: si el socio no llega, el trabajo queda incompleto o distinto, el equipo busca otro socio o cancela sin costo (detalle en /garantia).')
  return {
    ctx: {
      candidate: { kind: c.kind, title: c.title, detail: c.detail, keyword: c.keyword, targetUrl: c.targetUrl, evidence: (c.evidence as Record<string, unknown>) ?? undefined },
      serviceName: service?.name ?? null, cityName: city?.name ?? null, facts: lines, pages,
      existingTitles: facts.articles.map((a) => a.title), competitors: config.competitors, focusKeywords: config.focus.keywords,
    },
    allowed: pages.map((p) => p.url),
  }
}

/** Writes and saves the brief of one opportunity. Returns the brief, or throws SeoError with a readable reason. */
export async function briefOpportunity(id: string, opts: { trigger?: Trigger; facts?: SeoFacts; config?: SeoConfig } = {}) {
  const opp = await prisma.seoOpportunity.findUnique({ where: { id } })
  if (!opp) throw new SeoError('Oportunidad no encontrada')
  if (!ARTICLE_KINDS.includes(opp.kind as never)) throw new SeoError('Esta oportunidad es un arreglo, no un artículo: no necesita brief')
  const config = opts.config ?? (await getSeoSettings())
  const blocked = await spendBlock(config)
  if (blocked) throw new SeoError(blocked)
  const outcome = await withRun('brief', opts.trigger ?? 'manual', { opportunityId: id, title: opp.title }, async (meter) => {
    const facts = opts.facts ?? (await gatherFacts(config, { withPages: false })).facts
    const { ctx, allowed } = await briefContext({ ...opp, kind: opp.kind as Candidate['kind'], detail: opp.detail ?? '' }, facts, config)
    const ask = async (corrections?: string[]) => callTool(BRIEF_TOOL, 'seo_agent_brief', corrections?.length ? `${briefTask(ctx)}\n\nTu intento anterior no pasó la validación. Corrige exactamente esto:\n${corrections.map((e) => `- ${e}`).join('\n')}` : briefTask(ctx), meter, 5000)
    let parsed = sanitizeBrief(await ask(), allowed)
    if (!parsed.ok) parsed = sanitizeBrief(await ask(parsed.errors), allowed)
    if (!parsed.ok) throw new SeoError(`El brief no vino completo: ${parsed.errors.join(' · ')}`)
    // The facts a writer may cite are exactly the ones the platform sent, never the model's own
    parsed.value.facts = ctx.facts
    await prisma.seoOpportunity.update({ where: { id }, data: { brief: json(parsed.value), briefedAt: new Date(), status: opp.status === 'sent' ? 'sent' : 'briefed', keyword: opp.keyword ?? parsed.value.keyword } })
    return { summary: `Brief de «${parsed.value.keyword}»${parsed.dropped.length ? ` (${parsed.dropped.length} ajustes)` : ''}`, value: parsed.value, output: { keyword: parsed.value.keyword, dropped: parsed.dropped } }
  })
  if (!outcome.ok) throw new SeoError(outcome.error)
  return outcome.value
}

// ─── Weekly report ───────────────────────────────────────────────────────────

const slugKey = (s: string) => slugify(s, 60)

async function writeReport(facts: SeoFacts, candidates: Candidate[], config: SeoConfig, trigger: Trigger, gscTop: Array<{ query: string; clicks: number; impressions: number; position: number }>, gscTotals: { clicks: number; impressions: number } | null, heard: string[] = []) {
  const [ideasOpen, ideaRows, learnings] = await Promise.all([
    prisma.marketingIdea.count({ where: { status: 'proposed' } }).catch(() => 0),
    prisma.marketingIdea.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * DAY) }, status: { not: 'rejected' } }, orderBy: { createdAt: 'desc' }, take: 15, select: { angle: true } }).catch(() => []),
    prisma.marketingAgentLearning.findMany({ orderBy: { createdAt: 'desc' }, take: 1, select: { insights: true } }).catch(() => []),
  ])
  const open = await prisma.seoOpportunity.findMany({ where: { status: { in: ['open', 'briefed', 'sent'] } }, orderBy: { score: 'desc' }, take: 40, select: { kind: true, title: true, score: true } })
  const health = healthScore(facts, candidates)
  const gscByPage = new Map<string, number>()
  for (const r of facts.gsc?.rows ?? []) {
    try { const p = new URL(r.page).pathname; gscByPage.set(p, (gscByPage.get(p) ?? 0) + r.clicks) } catch { /* ignore */ }
  }
  const outcome = await withRun('report', trigger, { open: open.length }, async (meter) => {
    const task = reportTask({
      summary: `Salud ${health.score}/100 (${health.parts.map((p) => `${p.label}: ${p.score}`).join('; ')}). ${open.length} oportunidades abiertas.`,
      open, pagesWithIssues: facts.pages.filter((p) => p.issues.some((i) => i.severity !== 'info')).length,
      gsc: gscTotals ? { days: facts.gsc?.days ?? 28, ...gscTotals, top: gscTop.slice(0, 15) } : null,
      articles: facts.articles.slice(0, 15).map((a) => ({ title: a.title, days: Math.floor((facts.now.getTime() - a.publishedAt.getTime()) / DAY), views: a.views, clicks: facts.gsc ? gscByPage.get(`/blog/${a.slug}`) ?? 0 : null })),
      marketing: { ideasOpen, recentTopics: ideaRows.map((i) => i.angle), learnings: [...heard, ...learnings.map((l) => l.insights.slice(0, 400))] },
      searches: facts.zeroSearches.slice(0, 10),
    })
    const report = sanitizeReport(await callTool(REPORT_TOOL, 'seo_agent_report', task, meter, 4500))
    if (!report) throw new SeoError('El informe no vino en el formato pedido')
    let added = 0
    for (const p of report.proposals) {
      const key = `ai:${slugKey(p.title)}`
      const exists = await prisma.seoOpportunity.findUnique({ where: { dedupeKey: key }, select: { id: true } })
      if (exists) continue
      await prisma.seoOpportunity.create({
        data: { kind: p.kind, title: p.title, detail: p.detail, keyword: p.keyword, impact: p.impact, effort: p.effort, source: 'ai', dedupeKey: key, score: scoreOf({ impact: p.impact, effort: p.effort }) },
      }).then(() => { added++ }).catch(() => null)
    }
    await sendGuidanceToMarketing(report.forMarketing)
    return { summary: `Informe semanal: ${report.findings.length} hallazgos, ${added} propuestas nuevas`, value: { report, added }, output: { summary: report.summary, findings: report.findings, forMarketing: report.forMarketing, proposals: report.proposals.map((p) => p.title) } }
  })
  return outcome
}

// ─── The cycle ───────────────────────────────────────────────────────────────

const bogotaDay = (d: Date) => new Date(d.getTime() - 5 * 3600_000).getUTCDay()

export type CycleResult = { ok: boolean; skipped?: string; runId?: string; summary: string; created?: number; closed?: number; briefs?: number; reportAdded?: number; error?: string }

/** Cycles never overlap: a run started in the last 10 minutes and not finished means another server is at it. */
async function busy(now: Date) {
  const r = await prisma.seoRun.findFirst({ where: { type: 'cycle', status: 'running', startedAt: { gte: new Date(now.getTime() - 10 * 60_000) } }, select: { id: true } })
  return Boolean(r)
}

export async function runSeoCycle(opts: { trigger: Trigger; force?: boolean; withAi?: boolean; deadline?: number; now?: Date } = { trigger: 'cron' }): Promise<CycleResult> {
  const now = opts.now ?? new Date()
  const config = await getSeoSettings()
  if (!config.enabled && !opts.force) return { ok: true, skipped: 'disabled', summary: 'El agente de SEO está apagado' }
  // Before the SQL runs the tables do not exist: nothing to do, and no failing cron
  let running = false
  try { running = await busy(now) } catch { return { ok: true, skipped: 'no_tables', summary: 'Falta aplicar el SQL del agente de SEO' } }
  if (running) return { ok: true, skipped: 'busy', summary: 'Ya hay un ciclo en marcha' }
  const deadline = opts.deadline ?? Date.now() + 200_000

  const outcome = await withRun('cycle', opts.trigger, { force: Boolean(opts.force), withAi: opts.withAi ?? null }, async (meter) => {
    const { facts, gsc, unavailable } = await gatherFacts(config, { now, deadline: Math.min(deadline, Date.now() + 80_000) })
    // The agent bus: what other agents asked or learned, and what SEO tells them (new guides for the inbox bot)
    const incoming = await processIncoming()
    await announceNewGuides(facts.articles, now)
    const candidates = detectOpportunities(facts, config)
    const synced = await syncOpportunities(candidates, now)
    const health = healthScore(facts, candidates)

    // Search Console summary (for the panel and the report)
    const rows = facts.gsc?.rows ?? []
    // Real totals come from the per-page report; the query report leaves out anonymized queries
    const totals = facts.pageTotals
    const clicks = totals.length ? totals.reduce((a, p) => a + p.clicks, 0) : rows.reduce((a, r) => a + r.clicks, 0)
    const impressions = totals.length ? totals.reduce((a, p) => a + p.impressions, 0) : rows.reduce((a, r) => a + r.impressions, 0)
    const byQuery = new Map<string, { clicks: number; impressions: number; pos: number }>()
    for (const r of rows) {
      const q = byQuery.get(r.query) ?? { clicks: 0, impressions: 0, pos: 0 }
      q.clicks += r.clicks; q.pos += r.position * r.impressions; q.impressions += r.impressions
      byQuery.set(r.query, q)
    }
    const top = Array.from(byQuery.entries()).map(([query, q]) => ({ query, clicks: q.clicks, impressions: q.impressions, position: q.impressions ? q.pos / q.impressions : 0 })).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15)
    const pageClicks = new Map<string, { clicks: number; impressions: number }>()
    for (const r of rows) {
      let p = r.page
      try { p = new URL(r.page).pathname } catch { /* keep */ }
      const x = pageClicks.get(p) ?? { clicks: 0, impressions: 0 }
      x.clicks += r.clicks; x.impressions += r.impressions
      pageClicks.set(p, x)
    }
    const topPages = (totals.length ? totals : Array.from(pageClicks.entries()).map(([path, v]) => ({ path, ...v }))).slice().sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10)
    const indexing = facts.inspections.length ? { inspected: facts.inspections.length, indexed: facts.inspections.filter((i) => i.verdict === 'PASS').length, notIndexed: facts.inspections.filter((i) => i.verdict !== 'PASS').map((i) => ({ path: i.path, coverage: i.coverage })) } : null

    // The model part: only on the weekly day (or on demand), within budget and time
    let briefs = 0
    let reportAdded = 0
    let aiNote: string | null = null
    const lastReport = await prisma.seoRun.findFirst({ where: { type: 'report', status: 'ok' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } })
    const due = opts.withAi ?? (opts.force || (bogotaDay(now) === config.weeklyDay && (!lastReport || now.getTime() - lastReport.startedAt.getTime() > 5 * DAY)))
    if (due) {
      const blocked = await spendBlock(config, now)
      if (blocked) aiNote = blocked
      else {
        const pending = await prisma.seoOpportunity.findMany({ where: { status: 'open', kind: { in: [...ARTICLE_KINDS] }, brief: { equals: Prisma.DbNull } }, orderBy: { score: 'desc' }, take: config.briefsPerCycle })
        for (const o of pending) {
          if (Date.now() > deadline - 70_000) { aiNote = 'Se cortó por tiempo; el resto sigue en el próximo ciclo'; break }
          try {
            const brief = await briefOpportunity(o.id, { trigger: opts.trigger, facts, config })
            briefs++
            if (config.autoSendToMarketing) await sendOne(o.id, brief, config)
          } catch (err) {
            aiNote = err instanceof Error ? err.message : 'Falló un brief'
            if (/Presupuesto|IA no está configurada/.test(aiNote)) break
          }
        }
        if (Date.now() < deadline - 50_000 && !(await spendBlock(config, now))) {
          const rep = await writeReport(facts, candidates, config, opts.trigger, top, rows.length ? { clicks, impressions } : null, incoming.learnings)
          if (rep.ok) reportAdded = rep.value.added
          else aiNote = rep.error
        }
      }
    }

    const gscState = !config.gsc.enabled ? { state: 'off' as const, message: 'Apagado en la configuración' } : gsc == null ? { state: 'error' as const, message: 'No se pudo consultar' } : gsc.ok ? { state: 'ok' as const, message: `${gsc.rows.length} combinaciones de búsqueda y página, ${gsc.from} a ${gsc.to}` } : { state: gsc.reason, message: gsc.message, serviceEmail: gsc.serviceEmail ?? null }
    const summary = [`Salud ${health.score}/100`, `${candidates.length} hallazgos (${synced.created} nuevos${synced.closed ? `, ${synced.closed} resueltos` : ''})`, briefs ? `${briefs} briefs` : '', reportAdded ? `${reportAdded} propuestas de la IA` : '', aiNote ? `IA: ${aiNote}` : ''].filter(Boolean).join(' · ')
    return {
      summary, value: { created: synced.created, closed: synced.closed + synced.published, briefs, reportAdded },
      output: {
        health, gsc: { ...gscState, days: facts.gsc?.days ?? null, clicks, impressions, top, topPages, indexing },
        pages: facts.pages.map((p) => ({ path: p.path, status: p.status, words: p.words, issues: p.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })) })),
        bus: { requestsReceived: incoming.requests, learningsHeard: incoming.learnings.length }, counts: { services: facts.services.length, articles: facts.articles.length, zeroSearches: facts.zeroSearches.length, thinPartnerProfiles: facts.thinPartnerProfiles }, unavailable, aiNote,
      },
    }
  })
  if (!outcome.ok) return { ok: false, runId: outcome.runId, summary: outcome.error, error: outcome.error }
  return { ok: true, runId: outcome.runId, summary: outcome.summary, ...outcome.value }
}

async function sendOne(id: string, brief: SeoBrief, config: SeoConfig) {
  const opp = await prisma.seoOpportunity.findUnique({ where: { id }, select: { id: true, marketingIdeaId: true, serviceSlug: true } })
  if (!opp) return null
  return sendBriefToMarketing(opp, brief, config)
}

// ─── Actions on an opportunity ───────────────────────────────────────────────

/** Sends an opportunity to the marketing agent (writing its brief first if it has none). */
export async function sendOpportunityToMarketing(id: string, trigger: Trigger = 'manual') {
  const opp = await prisma.seoOpportunity.findUnique({ where: { id } })
  if (!opp) throw new SeoError('Oportunidad no encontrada')
  if (opp.marketingIdeaId) throw new SeoError('Ya está en el calendario de marketing')
  if (!ARTICLE_KINDS.includes(opp.kind as never)) throw new SeoError('Es un arreglo, no un artículo: lo hace el equipo')
  const config = await getSeoSettings()
  if (!(await webMarketingAgent())) throw new SeoError('No hay un agente de marketing activo con el canal web encendido')
  const brief = (opp.brief as SeoBrief | null) ?? (await briefOpportunity(id, { trigger, config }))
  const r = await sendBriefToMarketing({ id: opp.id, marketingIdeaId: opp.marketingIdeaId, serviceSlug: opp.serviceSlug }, brief, config)
  if (!r.ok) throw new SeoError(r.reason)
  return r
}

export async function dismissOpportunity(id: string, reason: string | null) {
  const r = await prisma.seoOpportunity.updateMany({ where: { id, status: { in: ['open', 'briefed'] } }, data: { status: 'dismissed', dismissedReason: reason?.slice(0, 300) ?? null, resolvedAt: new Date() } })
  if (!r.count) throw new SeoError('No se puede descartar: ya está en marcha o resuelta')
}

export async function markOpportunityDone(id: string) {
  const r = await prisma.seoOpportunity.updateMany({ where: { id, status: { in: ['open', 'briefed', 'sent'] } }, data: { status: 'done', resolvedAt: new Date() } })
  if (!r.count) throw new SeoError('No se puede marcar: ya estaba resuelta o descartada')
}

export async function reopenOpportunity(id: string) {
  const r = await prisma.seoOpportunity.updateMany({ where: { id, status: { in: ['done', 'dismissed'] } }, data: { status: 'open', resolvedAt: null, dismissedReason: null } })
  if (!r.count) throw new SeoError('No se puede reabrir')
}

