import type Anthropic from '@anthropic-ai/sdk'
import type { MarketingAgent, MarketingCampaign, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { callClaude, describeApiError, type CallResult, type Effort } from '@/lib/ai/anthropic'
import type { AiCallKind } from '@/lib/ai/calls'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { periodOf } from '@/lib/ai/pricing'
import { getAiSettings } from '@/lib/ai/settings'
import type { MarketingChannel } from '@/lib/marketing/channel-rules'
import { SITE_URL, slugify } from '@/lib/marketing/seo'
import { sanitizeVariantInput, type VariantPatch } from '@/lib/marketing/input'
import { PublishValidationError, cancelScheduled, schedulePost, validatePostForChannel, type Target } from '@/lib/marketing/publisher'
import { saveVariants, workspaceAccounts } from '@/lib/marketing/service'
import { generateImages, getBrandKit, getImageSettings, importImage, providerReady, searchPexels } from '@/lib/marketing/images'
import { servicePrompt } from '@/lib/marketing/images-core'
import { AGENT_CHANNELS, normalizeDomain, readAgentConfig, type AgentConfig, type AgentMode, type AgentSettings } from '@/lib/marketing/agent-input'
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  addDays,
  applyRecommendations,
  applyUtmToText,
  bogota,
  budgetLevel,
  calendarGaps,
  checkGuardrails,
  degradation,
  effectiveMode,
  isRepeat,
  learningStats,
  nextAgentState,
  parseDraft,
  parseIdeas,
  parseRetrospective,
  parseStrategy,
  pickSlot,
  pillarDeficit,
  postFeatures,
  slotPerformance,
  toolInput,
  withUtm,
  type AgentAction,
  type AgentState,
  type LearningStats,
  type PostDraft,
  type Recommendation,
  type Strategy,
  type UtmParams,
} from '@/lib/marketing/agent-core'
import {
  DRAFT_TOOL,
  LEARN_TOOL,
  PLAN_TOOL,
  STRATEGY_TOOL,
  buildSystem,
  campaignBlock,
  draftTask,
  fillMaster,
  learnTask,
  momentBlock,
  planTask,
  strategyTask,
} from '@/lib/marketing/agent-prompt'
import { brandName, catalogFor, learningRows, momentFacts, plannedPieces, recentTopics, rejectionsFor, takenSlots } from '@/lib/marketing/agent-data'
import { agentUrl, notify, postUrl, type NoticeType } from '@/lib/marketing/agent-notices'

const logger = createLogger('marketing-agent')

const H = 3600_000
const DAY = 24 * H
/** Runs that call the model, per agent and 24 h, whatever the monthly budget says. */
export const DAILY_AI_RUNS = 24
const PLAN_EVERY_MS = 6 * H
const LEARN_EVERY_MS = 7 * DAY
const LOCK_MS = 10 * 60_000
const MAX_IDEAS = 12
const MAX_DRAFTS_PER_CYCLE = 2
/** Share of slots used to try little-tested hours once the agent has data. */
const SLOT_EXPLORE = 0.2
/** An idea not written this long after its day is dropped (its moment passed). */
const IDEA_STALE_MS = 2 * DAY

export class AgentError extends Error {}

export type Agent = MarketingAgent & { campaign: MarketingCampaign }

export const settingsOf = (a: MarketingAgent): AgentSettings => ({
  mode: a.mode as AgentMode,
  modeByChannel: (a.modeByChannel as AgentSettings['modeByChannel']) ?? null,
  optOutHours: a.optOutHours,
  trialPostsRemaining: a.trialPostsRemaining,
  monthlyBudgetUsd: a.monthlyBudgetUsd,
  confidenceThreshold: a.confidenceThreshold,
  exploreRatio: a.exploreRatio,
  horizonDays: a.horizonDays,
})
export const configOf = (a: MarketingAgent) => readAgentConfig(a.config)
export const strategyOf = (a: MarketingAgent) => (a.strategy as Strategy | null) ?? null
const enabledChannels = (c: AgentConfig) => AGENT_CHANNELS.filter((ch) => c.channels[ch].enabled)
const ownDomains = () => [normalizeDomain(SITE_URL) || 'lohaggo.com']
const noticeTarget = (a: Agent) => ({ id: a.id, workspaceId: a.workspaceId, email: configOf(a).notify.email })
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
const fmt = (d: Date) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(d)

/** Active agents per workspace: each spends up to its own budget, so their number is capped. */
export const MAX_ACTIVE_AGENTS = 5
/** On-demand retrospective at most this often (the cron does it weekly). */
export const MANUAL_LEARN_EVERY_MS = 24 * 3600_000

/**
 * One thing at a time per agent (the cron's cycle or a person's action that calls the model): the
 * budget checks read what was spent, so two paid calls must not run side by side. Null = busy.
 */
export async function withAgentLock<T>(agentId: string, fn: () => Promise<T>): Promise<T | null> {
  const now = new Date()
  const lock = await prisma.marketingAgent.updateMany({ where: { id: agentId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(now.getTime() + 10 * 60_000) } })
  if (!lock.count) return null
  try {
    return await fn()
  } finally {
    await prisma.marketingAgent.update({ where: { id: agentId }, data: { lockedUntil: null } }).catch(() => null)
  }
}

export async function loadAgent(id: string) {
  return prisma.marketingAgent.findUnique({ where: { id }, include: { campaign: true } })
}

/** The mode that applies now for these channels (trial and degraded agents run in copilot). */
export function modeFor(a: MarketingAgent, channels: MarketingChannel[], opts: { ignoreTrial?: boolean } = {}) {
  const s = settingsOf(a)
  return effectiveMode(s.mode, s.modeByChannel, channels, { trialPostsRemaining: opts.ignoreTrial ? 0 : a.trialPostsRemaining, degradedReason: a.degradedReason })
}

// ─── Cost ───────────────────────────────────────────────────────────────────

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

/** What the agent spent this month (model calls and generated images of its runs). */
export async function agentSpend(agentId: string, now = new Date()) {
  const agg = await prisma.marketingAgentRun.aggregate({ where: { agentId, startedAt: { gte: monthStart(now) } }, _sum: { costUsd: true } })
  return agg._sum.costUsd ?? 0
}

class Meter {
  cost = 0
  tokensIn = 0
  tokensOut = 0
  model: string | null = null
  add(r: CallResult) {
    this.cost += r.costUsd
    this.tokensIn += r.usage.inputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens
    this.tokensOut += r.usage.outputTokens
    this.model = r.model
  }
  addFixed(usd: number) {
    this.cost += usd
  }
  get data() {
    return { costUsd: this.cost, tokensIn: this.tokensIn, tokensOut: this.tokensOut, model: this.model }
  }
}

/** Refuses before calling the model if any limit is reached: platform key, agent budget, workspace cap, daily runs. */
async function assertCanSpend(agent: Agent) {
  const settings = await getAiSettings()
  if (!settings.anthropicKey) throw new AgentError('La IA no está configurada (falta la clave de Anthropic en IA · Plataforma)')
  const spent = await agentSpend(agent.id)
  if (spent >= agent.monthlyBudgetUsd) throw new AgentError(`Presupuesto mensual del agente agotado ($${spent.toFixed(2)} de $${agent.monthlyBudgetUsd})`)
  const ws = await checkWorkspaceBudget(agent.workspaceId)
  if (ws.state === 'blocked') throw new AgentError(`Tope mensual de IA del workspace alcanzado (${ws.pct} %)`)
  const today = await prisma.marketingAgentRun.count({ where: { agentId: agent.id, startedAt: { gte: new Date(Date.now() - DAY) }, costUsd: { gt: 0 } } })
  if (today >= DAILY_AI_RUNS) throw new AgentError(`Límite diario del agente alcanzado (${DAILY_AI_RUNS} ejecuciones con IA en 24 h)`)
  return settings
}

type RunType = 'strategy' | 'plan' | 'draft' | 'schedule' | 'learn' | 'notice'
type RunOutcome<T> = { ok: true; value: T; summary: string; skipped: boolean } | { ok: false; error: string }

/** Every step leaves a row: what it did and why, what it cost, or why it failed. */
async function withRun<T>(agent: Agent, type: RunType, input: unknown, fn: (m: Meter) => Promise<{ summary: string; value: T; output?: unknown; skipped?: boolean }>): Promise<RunOutcome<T>> {
  const run = await prisma.marketingAgentRun.create({ data: { agentId: agent.id, type, input: input == null ? undefined : json(input) } })
  const meter = new Meter()
  try {
    const r = await fn(meter)
    await prisma.marketingAgentRun.update({ where: { id: run.id }, data: { status: r.skipped ? 'skipped' : 'ok', summary: r.summary.slice(0, 1000), output: r.output == null ? undefined : json(r.output), ...meter.data, finishedAt: new Date() } })
    return { ok: true, value: r.value, summary: r.summary, skipped: Boolean(r.skipped) }
  } catch (err) {
    const message = err instanceof AgentError ? err.message : describeApiError(err)
    logger.warn('Agent run failed', { agentId: agent.id, type, message })
    await prisma.marketingAgentRun.update({ where: { id: run.id }, data: { status: 'error', error: message.slice(0, 1000), ...meter.data, finishedAt: new Date() } }).catch(() => null)
    return { ok: false, error: message }
  }
}

/**
 * One model call that must answer with `tool`. Adaptive thinking does not allow forcing the tool, so
 * the prompt asks for it and an answer without it is an error (nothing is created from free text).
 */
async function callTool(agent: Agent, model: string, p: { kind: AiCallKind; system: Anthropic.TextBlockParam[]; task: string; tool: Anthropic.Tool; maxTokens: number; effort: Effort }, meter: Meter) {
  let result: CallResult
  try {
    result = await callClaude({ model, system: p.system, messages: [{ role: 'user', content: p.task }], tools: [p.tool], maxTokens: p.maxTokens, effort: p.effort }, { kind: p.kind, workspaceId: agent.workspaceId })
  } catch (err) {
    throw new AgentError(describeApiError(err))
  }
  meter.add(result)
  if (result.message.stop_reason === 'refusal') throw new AgentError('El modelo no quiso hacer esta tarea')
  if (result.message.stop_reason === 'max_tokens') throw new AgentError('La respuesta se cortó por larga; se reintentará en la próxima ejecución')
  const input = toolInput(result.message.content, p.tool.name)
  if (input === null) throw new AgentError('El modelo no entregó la respuesta en el formato pedido')
  return input
}

async function promptContext(agent: Agent, now = new Date(), opts: { withStrategy?: boolean } = {}) {
  const config = configOf(agent)
  const settings = settingsOf(agent)
  const strategy = strategyOf(agent)
  const [brand, catalog, moment] = await Promise.all([brandName(agent.workspaceId), catalogFor(config), momentFacts(agent, config, now)])
  const facts = { brand, siteUrl: SITE_URL, objective: agent.campaign.objective, config, settings, effectiveMode: modeFor(agent, enabledChannels(config)) }
  const campaign = campaignBlock({ ...facts, campaignName: agent.campaign.name, campaignDescription: agent.campaign.description, strategy: opts.withStrategy === false || !agent.strategyApprovedAt ? null : strategy, catalog, now })
  return { config, settings, strategy, catalog, stats: moment.stats, system: buildSystem(fillMaster(facts), campaign, momentBlock(moment.facts)) }
}

// ─── Strategy ───────────────────────────────────────────────────────────────

export async function generateStrategy(agent: Agent, instruction?: string | null) {
  return withRun(agent, 'strategy', { instruction: instruction ?? null }, async (meter) => {
    const ai = await assertCanSpend(agent)
    const ctx = await promptContext(agent, new Date(), { withStrategy: false })
    const input = await callTool(agent, ai.defaultModel, { kind: 'marketing_agent_strategy', system: ctx.system, task: strategyTask(instruction), tool: STRATEGY_TOOL, maxTokens: 4000, effort: 'high' }, meter)
    const parsed = parseStrategy(input)
    if (!parsed.ok) throw new AgentError(`La estrategia no es válida: ${parsed.errors.join(' · ')}`)
    const known = new Set(ctx.catalog.services.map((s) => s.name))
    for (const p of parsed.value.pillars) p.services = p.services.filter((s) => known.has(s))
    // A new proposal replaces the approved one only when the person approves it
    await prisma.marketingAgent.update({ where: { id: agent.id }, data: { strategy: json(parsed.value), strategyProposedAt: new Date(), strategyApprovedAt: null, strategyApprovedById: null } })
    await notify(noticeTarget(agent), { type: 'approval_needed', title: `Estrategia lista para revisar: ${agent.campaign.name}`, body: parsed.value.summary, url: agentUrl(agent.id), dedupeKey: `strategy:${agent.id}:${Date.now()}` })
    return { summary: `Estrategia con ${parsed.value.pillars.length} pilares: ${parsed.value.pillars.map((p) => `${p.name} ${p.weight} %`).join(', ')}`, value: parsed.value, output: parsed.value }
  })
}

// ─── Plan ───────────────────────────────────────────────────────────────────

export async function planIdeas(agent: Agent, now = new Date()) {
  return withRun(agent, 'plan', null, async (meter) => {
    const strategy = strategyOf(agent)
    if (!agent.strategyApprovedAt || !strategy) throw new AgentError('Falta aprobar la estrategia')
    const config = configOf(agent)
    const planned = await plannedPieces(agent.id, now, agent.horizonDays)
    const gaps = calendarGaps({ now, horizonDays: agent.horizonDays, channels: config.channels, planned, days: config.schedule.days })
    if (!gaps.length) {
      await prisma.marketingAgent.update({ where: { id: agent.id }, data: { lastPlannedAt: now } })
      return { summary: 'El calendario del horizonte ya está cubierto', value: 0, skipped: true }
    }
    const ai = await assertCanSpend(agent)
    const ctx = await promptContext(agent, now)
    const recent = await recentTopics(agent.id, now, config.schedule.repeatDays)
    const order = pillarDeficit(strategy.pillars, (await prisma.marketingIdea.findMany({ where: { agentId: agent.id, createdAt: { gte: new Date(now.getTime() - 30 * DAY) }, status: { not: 'rejected' } }, select: { pillar: true } })))
    const maxIdeas = Math.min(MAX_IDEAS, Math.max(...gaps.map((g) => g.needed)) + 2)
    const fromDay = addDays(bogota(now).key, 1)
    const toDay = bogota(new Date(now.getTime() + agent.horizonDays * DAY)).key
    const input = await callTool(agent, ai.defaultModel, {
      kind: 'marketing_agent_plan', system: ctx.system, tool: PLAN_TOOL, maxTokens: 3500, effort: 'medium',
      task: planTask({ gaps, order, exploreCount: Math.round(maxIdeas * agent.exploreRatio), fromDay, toDay, maxIdeas }),
    }, meter)
    const parsed = parseIdeas(input, { pillars: strategy.pillars.map((p) => p.name), channels: enabledChannels(config), services: ctx.catalog.services.map((s) => s.name), fromDay, toDay, max: maxIdeas })
    if (!parsed.ok) throw new AgentError(parsed.errors.join(' · '))

    let proposed = 0
    let accepted = 0
    const repeats: string[] = []
    for (const idea of parsed.value.ideas) {
      const at = new Date(`${idea.targetDate}T12:00:00-05:00`)
      if (isRepeat({ service: idea.service, angle: idea.angle, at }, recent, config.schedule.repeatDays)) { repeats.push(idea.angle); continue }
      // Ideas: the trial period is about pieces, so a supervised agent in trial still accepts its own ideas
      const t = nextAgentState('new', 'idea_created', modeFor(agent, idea.channels, { ignoreTrial: true }))!
      const deficit = order.find((o) => o.pillar === idea.pillar)
      await prisma.marketingIdea.create({
        data: {
          agentId: agent.id, pillar: idea.pillar, service: idea.service, angle: idea.angle, hypothesis: idea.hypothesis || null, channels: idea.channels, formats: json(idea.formats),
          targetDate: at, slotHint: idea.slotHint, rationale: idea.rationale || null, explore: idea.explore,
          status: t.state === 'idea_proposed' ? 'proposed' : 'accepted',
          score: Math.round((idea.confidence + (deficit ? Math.max(0, deficit.target - deficit.actual) / 100 : 0)) * 100) / 100,
        },
      })
      recent.push({ service: idea.service, angle: idea.angle, at })
      if (t.state === 'idea_proposed') proposed++
      else accepted++
    }
    await prisma.marketingAgent.update({ where: { id: agent.id }, data: { lastPlannedAt: now } })
    if (proposed) await notify(noticeTarget(agent), { type: 'ideas', title: `${proposed} ${proposed === 1 ? 'idea nueva' : 'ideas nuevas'} por revisar: ${agent.campaign.name}`, body: 'Acéptalas o recházalas (con el motivo, así el agente aprende).', url: agentUrl(agent.id), dedupeKey: `ideas:${agent.id}:${bogota(now).key}:${now.getUTCHours()}` })
    const summary = [`${proposed + accepted} ideas`, proposed ? `${proposed} por revisar` : '', accepted ? `${accepted} aceptadas solas` : '', repeats.length ? `${repeats.length} descartadas por repetidas` : '', parsed.value.dropped.length ? `${parsed.value.dropped.length} inválidas` : ''].filter(Boolean).join(', ')
    return { summary, value: proposed + accepted, output: { gaps, dropped: parsed.value.dropped, repeats } }
  })
}

// ─── Draft ──────────────────────────────────────────────────────────────────

const postInclude = { variants: true, media: { orderBy: { position: 'asc' as const } } } satisfies Prisma.MarketingPostInclude

function ensureHashtags(text: string, tags: string[]) {
  const missing = tags.filter((t) => !new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(text))
  return missing.length ? `${text.trimEnd()}\n${missing.join(' ')}` : text
}

/** The model's text into the post's channel variants, with UTM on our own links, bounded like any edit. */
async function writeDraft(postId: string, draft: PostDraft, channels: MarketingChannel[], utm: Omit<UtmParams, 'channel'>, config: AgentConfig) {
  const own = ownDomains()
  const u = (channel: MarketingChannel) => ({ ...utm, channel })
  const patches: VariantPatch[] = []
  const safe = (raw: Record<string, unknown>) => {
    try { return sanitizeVariantInput(raw) } catch { return sanitizeVariantInput({ ...raw, linkUrl: null }) }
  }
  if (channels.includes('WEB') && draft.web) {
    patches.push(safe({
      channel: 'WEB', body: applyUtmToText(draft.web.body, u('WEB'), own), slug: slugify(draft.web.slug || draft.title), seoTitle: draft.web.seoTitle, seoDescription: draft.web.seoDescription,
      excerpt: draft.web.excerpt, tags: draft.web.tags, category: draft.web.category, aiGenerated: true,
    }))
  }
  if (channels.includes('INSTAGRAM') && draft.instagram) {
    patches.push(safe({ channel: 'INSTAGRAM', body: ensureHashtags(applyUtmToText(draft.instagram.caption, u('INSTAGRAM'), own), config.voice.brandHashtags), format: draft.instagram.format, aiGenerated: true }))
  }
  if (channels.includes('FACEBOOK') && draft.facebook) {
    patches.push(safe({ channel: 'FACEBOOK', body: applyUtmToText(draft.facebook.text, u('FACEBOOK'), own), linkUrl: draft.facebook.link ? withUtm(draft.facebook.link, u('FACEBOOK'), own) : null, aiGenerated: true }))
  }
  await prisma.marketingPost.update({ where: { id: postId }, data: { title: draft.title.slice(0, 200), brief: draft.brief || null } })
  await saveVariants(postId, patches)
}

/**
 * Photos for the piece: the catalog service's name on Pexels (what the team asked for), or an AI image
 * if configured and within the per-post cap; the brand logo on top. Never throws: without an image
 * the piece fails validation for Instagram and goes to a person.
 */
async function attachImages(agent: Agent, config: AgentConfig, postId: string, draft: PostDraft, service: string | null, channels: MarketingChannel[], meter: Meter): Promise<{ source: string | null; error: string | null }> {
  if (config.images.source === 'manual') return { source: null, error: null }
  if (await prisma.marketingMedia.count({ where: { postId } })) return { source: 'existing', error: null }
  const carousel = channels.includes('INSTAGRAM') && draft.instagram?.format === 'carousel'
  const n = carousel ? 3 : 1
  const orientation = channels.includes('INSTAGRAM') ? 'portrait' as const : 'landscape' as const
  const brand = config.images.logo && Boolean((await getBrandKit(agent.workspaceId))?.logoPublicId)
  const alt = draft.image.alt || draft.title
  try {
    if (config.images.source === 'ai') {
      const s = await getImageSettings()
      if (providerReady(s).ready && s.costPerImageUsd * n <= config.budget.maxImageUsdPerPost) {
        try {
          const imgs = await generateImages({ workspaceId: agent.workspaceId, postId, prompt: draft.image.prompt || servicePrompt(service || draft.title), orientation, n })
          meter.addFixed(s.costPerImageUsd * n)
          for (const img of imgs) await importImage({ workspaceId: agent.workspaceId, postId, brand, candidate: { source: 'ai', url: img.fullUrl, publicId: img.publicId, width: img.width, height: img.height, bytes: img.bytes, alt, credit: img.credit } })
          return { source: 'ai', error: null }
        } catch (err) {
          logger.warn('AI image failed, using Pexels', { agentId: agent.id, err: err instanceof Error ? err.message : err })
        }
      }
    }
    const queries = Array.from(new Set([service, draft.image.query].filter((q): q is string => Boolean(q?.trim()))))
    const picked: Array<Awaited<ReturnType<typeof searchPexels>>['results'][number]> = []
    // Photos Instagram takes as they are first (4:5 to 1.91:1; Pexels "portrait" is often 9:16), closest to the target shape
    const target = orientation === 'portrait' ? 0.8 : 1.78
    const fits = (w: number | null, h: number | null) => (w && h ? w / h >= 0.79 && w / h <= 1.92 : false)
    const rank = (c: { width: number | null; height: number | null }) => (fits(c.width, c.height) ? 0 : 10) + Math.abs((c.width && c.height ? c.width / c.height : 1) - target)
    for (const q of queries) {
      if (picked.length >= n) break
      const { results } = await searchPexels(q, orientation, 1, 30)
      for (const r of [...results].sort((a, b) => rank(a) - rank(b))) if (picked.length < n && !picked.some((p) => p.id === r.id)) picked.push(r)
    }
    if (!picked.length) return { source: null, error: 'Pexels no devolvió fotos para este servicio' }
    for (const c of picked) {
      await importImage({ workspaceId: agent.workspaceId, postId, brand, candidate: { source: 'pexels', url: c.fullUrl, width: c.width, height: c.height, alt: c.alt || alt, credit: c.credit, creditUrl: c.creditUrl } })
    }
    // Fewer photos than a carousel needs: a single-image post instead of a validation error
    if (carousel && picked.length < 2) await saveVariants(postId, [{ channel: 'INSTAGRAM', format: 'feed' }])
    return { source: 'pexels', error: null }
  } catch (err) {
    return { source: null, error: err instanceof Error ? err.message : 'No se pudo poner la imagen' }
  }
}

function guardContext(config: AgentConfig, prices: number[], accounts: Array<{ name: string }>, confidence: number | null, threshold: number) {
  return {
    now: new Date(),
    promos: config.offer.promos,
    allowedTexts: [...config.offer.facts, config.offer.priceNotes, config.offer.valueProp, ...config.offer.differentiators],
    prices,
    bannedWords: config.voice.bannedWords,
    bannedTopics: config.voice.bannedTopics,
    ownDomains: ownDomains(),
    allowedDomains: config.offer.allowedDomains,
    allowedHandles: accounts.map((a) => a.name.replace(/^@/, '').trim()).filter((n) => /^[A-Za-z0-9._]+$/.test(n)),
    confidence,
    confidenceThreshold: threshold,
  }
}

/** Channel validation + guardrails on what is saved now. `fixable`: what a rewrite can solve (text, not the missing image). */
async function checkPost(agent: Agent, config: AgentConfig, prices: number[], postId: string, confidence: number | null) {
  const post = await prisma.marketingPost.findUniqueOrThrow({ where: { id: postId }, include: postInclude })
  const validation: string[] = []
  const fixable: string[] = []
  for (const v of post.variants) {
    const { validation: val } = validatePostForChannel(post, v.channel as MarketingChannel)
    for (const e of val?.errors ?? []) {
      const msg = `${v.channel}: ${e.message}`
      validation.push(msg)
      if (e.field !== 'media') fixable.push(msg)
    }
  }
  const accounts = (await workspaceAccounts(agent.workspaceId)).filter((a) => a.channel === 'INSTAGRAM')
  const guard = checkGuardrails(post.variants.map((v) => ({ channel: v.channel as MarketingChannel, text: v.body, linkUrl: v.linkUrl })), guardContext(config, prices, accounts, confidence, agent.confidenceThreshold))
  const blocks = guard.issues.filter((i) => i.severity === 'block').map((i) => `${i.channel ? `${i.channel}: ` : ''}${i.message}`)
  return { post, ok: !validation.length && guard.ok, needsReview: guard.needsReview, validation, fixable: [...fixable, ...blocks], issues: guard.issues }
}

const postStatusFor = (state: AgentState) => (state === 'scheduled' ? 'approved' : state)

/**
 * Writes one accepted idea as a post (or a new version of an agent post), attaches images, validates,
 * gives the model one chance to fix what failed, and moves it on by the autonomy rules.
 */
export async function draftIdea(agent: Agent, ideaId: string, opts: { instruction?: string | null; postId?: string | null } = {}) {
  return withRun(agent, 'draft', { ideaId, postId: opts.postId ?? null, instruction: opts.instruction ?? null }, async (meter) => {
    const idea = await prisma.marketingIdea.findFirst({ where: { id: ideaId, agentId: agent.id } })
    if (!idea) throw new AgentError('Idea no encontrada')
    const existing = opts.postId ? await prisma.marketingPost.findFirst({ where: { id: opts.postId, agentId: agent.id }, include: { variants: true } }) : null
    if (!existing && idea.status !== 'accepted') throw new AgentError('La idea no está aceptada')
    const ai = await assertCanSpend(agent)
    const ctx = await promptContext(agent)
    const config = ctx.config
    const channels = existing
      ? existing.variants.map((v) => v.channel as MarketingChannel)
      : (idea.channels as MarketingChannel[]).filter((c) => config.channels[c]?.enabled)
    if (!channels.length) throw new AgentError('La idea no tiene canales activos en el agente')
    const ideaInfo = { pillar: idea.pillar, service: idea.service, angle: idea.angle, hypothesis: idea.hypothesis, channels, formats: (idea.formats as Partial<Record<MarketingChannel, string>> | null) ?? {}, rationale: idea.rationale }
    const previous = existing ? existing.variants.map((v) => `${v.channel}:\n${v.body}`).join('\n\n') : null
    const utmNote = 'Los enlaces a lohaggo.com escríbelos sin parámetros: la plataforma les añade el seguimiento de la campaña (UTM).'
    const ask = async (corrections: string[] | null, prev: string | null) => callTool(agent, ai.defaultModel, {
      kind: 'marketing_agent_draft', system: ctx.system, tool: DRAFT_TOOL, maxTokens: channels.includes('WEB') ? 6000 : 2200, effort: 'medium',
      task: draftTask({ idea: ideaInfo, utmNote, instruction: opts.instruction, corrections, previous: prev }),
    }, meter)

    let parsed = parseDraft(await ask(null, previous), channels)
    if (!parsed.ok) parsed = parseDraft(await ask(parsed.errors, previous), channels)
    if (!parsed.ok) throw new AgentError(`La pieza no vino completa: ${parsed.errors.join(' · ')}`)
    let draft = parsed.value

    if (existing && ['approved', 'scheduled'].includes(existing.status)) await cancelScheduled(existing.id)
    const post = existing ?? await prisma.marketingPost.create({
      data: { workspaceId: agent.workspaceId, campaignId: agent.campaignId, title: draft.title.slice(0, 200), brief: draft.brief || null, origin: 'agent', agentId: agent.id, ideaId: idea.id, pillar: idea.pillar, status: 'draft' },
    })
    const utm = { campaignSlug: slugify(agent.campaign.name, 40) || 'campana', postId: post.id }
    await writeDraft(post.id, draft, channels, utm, config)
    const service = draft.service && ctx.catalog.services.some((s) => s.name === draft.service) ? draft.service : idea.service
    const image = await attachImages(agent, config, post.id, draft, service, channels, meter)

    let check = await checkPost(agent, config, ctx.catalog.prices, post.id, draft.confidence)
    let corrected = false
    if (check.fixable.length) {
      const current = check.post.variants.map((v) => `${v.channel}:\n${v.body}`).join('\n\n')
      const again = parseDraft(await ask(check.fixable, current), channels)
      if (again.ok) {
        draft = again.value
        await writeDraft(post.id, draft, channels, utm, config)
        check = await checkPost(agent, config, ctx.catalog.prices, post.id, draft.confidence)
        corrected = true
      }
    }

    const trial = !existing && agent.trialPostsRemaining > 0
    const mode = modeFor(agent, channels)
    // A version a person asked for goes back to that person, whatever the mode
    const from: AgentState = existing ? 'review' : 'idea_accepted'
    const t = nextAgentState(from, 'drafted', mode, { valid: check.ok, needsReview: check.needsReview, trial })!
    const meta = {
      confidence: draft.confidence, risks: draft.risks, hypothesis: draft.hypothesis || idea.hypothesis, cta: draft.cta, rationale: idea.rationale, explore: idea.explore, service,
      imageSource: image.source, imageError: image.error, guardrails: check.issues, validation: check.validation, corrected, mode, instruction: opts.instruction ?? null,
    }
    await prisma.marketingPost.update({
      where: { id: post.id },
      data: {
        status: postStatusFor(t.state), agentMeta: json(meta), rejectedReason: null,
        ...(t.state === 'scheduled' ? { approvedAt: new Date(), approvedById: null } : {}),
        features: json(postFeatures({ pillar: idea.pillar, service, explore: idea.explore, cta: draft.cta, imageSource: image.source, at: null, variants: check.post.variants.map((v) => ({ channel: v.channel as MarketingChannel, body: v.body, format: v.format })) })),
      },
    })
    await runActions(agent, t.actions, { postId: post.id, ideaId: idea.id, title: draft.title, mode, problems: [...check.validation, ...check.issues.map((i) => i.message)], isNew: !existing })

    const where = t.state === 'review' ? 'esperando aprobación' : t.state === 'draft' ? 'en borrador (necesita a una persona)' : 'programada'
    return { summary: `«${draft.title}» ${where}${corrected ? ' tras una corrección' : ''}${image.error ? ` · imagen: ${image.error}` : ''}`, value: post.id, output: { postId: post.id, state: t.state, issues: check.issues, validation: check.validation } }
  })
}

/** Side effects of a transition. */
async function runActions(agent: Agent, actions: AgentAction[], p: { postId: string; ideaId: string | null; title: string; mode: AgentMode; problems: string[]; isNew: boolean; reason?: string | null }) {
  const target = noticeTarget(agent)
  for (const a of actions) {
    if (a === 'mark_idea_drafted' && p.ideaId) await prisma.marketingIdea.update({ where: { id: p.ideaId }, data: { status: 'drafted', postId: p.postId } })
    if (a === 'consume_trial') await prisma.marketingAgent.updateMany({ where: { id: agent.id, trialPostsRemaining: { gt: 0 } }, data: { trialPostsRemaining: { decrement: 1 } } })
    if (a === 'reject_idea' && p.ideaId) await prisma.marketingIdea.update({ where: { id: p.ideaId }, data: { status: 'rejected', rejectedReason: p.reason ?? null } }).catch(() => null)
    if (a === 'cancel_scheduled') await cancelScheduled(p.postId)
    if (a === 'schedule') await schedulePiece(agent, p.postId, p.mode)
    if (a === 'notify_approval' && p.isNew) await notify(target, { type: 'approval_needed', title: `Pieza por aprobar: «${p.title}»`, body: p.problems.length ? `Revisa: ${p.problems.slice(0, 3).join(' · ')}` : 'Revísala y apruébala, edítala o recházala con un motivo.', url: postUrl(p.postId), postId: p.postId, dedupeKey: `approval:${p.postId}` })
    if (a === 'notify_draft_problem') await notify(target, { type: 'failed', title: `Una pieza necesita ayuda: «${p.title}»`, body: p.problems.slice(0, 4).join(' · ') || 'No pasó las revisiones.', url: postUrl(p.postId), postId: p.postId, dedupeKey: `problem:${p.postId}:${bogota(new Date()).key}` })
  }
}

// ─── Schedule ───────────────────────────────────────────────────────────────

/**
 * Gives each channel of the post its time (pickSlot) and queues it for the existing worker. Supervised:
 * the post also gets its opt-out deadline and the team a notice. Guardrails run again here: nothing
 * reaches the queue without passing them, whoever approved it.
 */
export async function schedulePiece(agent: Agent, postId: string, mode: AgentMode, now = new Date()) {
  const config = configOf(agent)
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, include: postInclude })
  if (!post || post.agentId !== agent.id) return { ok: false as const, message: 'Publicación no encontrada' }
  const meta = (post.agentMeta as Record<string, unknown> | null) ?? {}
  const accounts = await workspaceAccounts(agent.workspaceId)
  const catalog = await catalogFor(config)
  const guard = checkGuardrails(post.variants.map((v) => ({ channel: v.channel as MarketingChannel, text: v.body, linkUrl: v.linkUrl })), guardContext(config, catalog.prices, accounts.filter((a) => a.channel === 'INSTAGRAM'), null, agent.confidenceThreshold))
  if (!guard.ok) {
    const problems = guard.issues.filter((i) => i.severity === 'block').map((i) => i.message)
    await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'draft', agentMeta: json({ ...meta, guardrails: guard.issues }) } })
    await notify(noticeTarget(agent), { type: 'failed', title: `No se programó «${post.title}»`, body: problems.join(' · '), url: postUrl(postId), postId, dedupeKey: `guard:${postId}:${bogota(now).key}` })
    return { ok: false as const, message: problems.join(' · ') }
  }

  const idea = post.ideaId ? await prisma.marketingIdea.findUnique({ where: { id: post.ideaId }, select: { targetDate: true } }) : null
  const target = idea?.targetDate && idea.targetDate.getTime() > now.getTime() ? new Date(`${bogota(idea.targetDate).key}T00:00:00-05:00`) : now
  const earliest = new Date(now.getTime() + (mode === 'supervised' ? (agent.optOutHours + 1) * H : 30 * 60_000))
  const horizonEnd = new Date(Math.max(target.getTime(), earliest.getTime()) + agent.horizonDays * DAY)
  const rows = await learningRows({ workspaceId: agent.workspaceId }, now)
  const slots: Array<{ channel: MarketingChannel; at: string; reason: string; kind: string }> = []
  const problems: string[] = []
  for (const v of post.variants) {
    const channel = v.channel as MarketingChannel
    const plan = config.channels[channel]
    let targets: Target[]
    if (channel === 'WEB') targets = [{ channel, connectionId: null }]
    else {
      const healthy = accounts.filter((a) => a.channel === channel && a.ok)
      const chosen = plan.accountIds.length ? healthy.filter((a) => plan.accountIds.includes(a.id)) : healthy
      targets = chosen.map((a) => ({ channel, connectionId: a.id }))
    }
    if (!targets.length) { problems.push(`${channel}: no hay una cuenta que pueda publicar`); continue }
    const taken = await takenSlots(agent.workspaceId, channel, new Date(now.getTime() - 2 * DAY), new Date(horizonEnd.getTime() + DAY), postId)
    const perf = slotPerformance(rows, config.kpi, channel)
    const choice = pickSlot({
      channel, target, earliest, horizonEnd, smart: config.schedule.smart, allowedDays: config.schedule.days, windows: config.schedule.windows,
      quietFrom: config.schedule.quietFrom, quietTo: config.schedule.quietTo, minGapHours: config.schedule.minGapHours, maxPerDay: config.schedule.maxPerDay,
      taken, kpi: config.kpi, measured: perf.measured, performance: perf.performance, explore: SLOT_EXPLORE, random: Math.random(),
    })
    if (!choice) { problems.push(`${channel}: no hay una franja libre en el horizonte`); continue }
    try {
      await schedulePost(postId, targets, choice.at, { keepOtherTargets: true })
      slots.push({ channel, at: choice.at.toISOString(), reason: choice.reason, kind: choice.kind })
    } catch (err) {
      problems.push(err instanceof PublishValidationError ? err.message : err instanceof Error ? err.message : 'No se pudo programar')
    }
  }
  if (!slots.length) {
    await prisma.marketingPost.update({ where: { id: postId }, data: { agentMeta: json({ ...meta, scheduleProblems: problems }) } })
    await notify(noticeTarget(agent), { type: 'failed', title: `No se pudo programar «${post.title}»`, body: problems.join(' · '), url: postUrl(postId), postId, dedupeKey: `noslot:${postId}:${bogota(now).key}` })
    return { ok: false as const, message: problems.join(' · ') }
  }
  const first = new Date(Math.min(...slots.map((s) => Date.parse(s.at))))
  const deadline = mode === 'supervised' ? new Date(first.getTime() - agent.optOutHours * H) : null
  const features = { ...((post.features as Record<string, unknown> | null) ?? {}), weekday: bogota(first).weekday, hour: bogota(first).hour }
  await prisma.marketingPost.update({ where: { id: postId }, data: { optOutDeadline: deadline, features: json(features), agentMeta: json({ ...meta, slots, scheduleProblems: problems, scheduledMode: mode }) } })
  if (deadline) {
    await notify(noticeTarget(agent), {
      type: 'opt_out_window', title: `Saldrá el ${fmt(first)}: «${post.title}»`,
      body: `Se publica sola si nadie la cancela o la edita antes del ${fmt(deadline)}.${problems.length ? ` Ojo: ${problems.join(' · ')}` : ''}`,
      url: postUrl(postId), postId, dedupeKey: `optout:${postId}:${first.toISOString()}`,
    })
  }
  return { ok: true as const, message: slots.map((s) => s.reason).join(' · '), slots }
}

// ─── People's decisions ─────────────────────────────────────────────────────

/** A person approved an agent post (editor or agent screen): it gets its slots now. */
export async function scheduleApproved(postId: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { agentId: true, status: true, agentMeta: true } })
  if (!post?.agentId || post.status !== 'approved') return null
  const agent = await loadAgent(post.agentId)
  if (!agent) return null
  await prisma.marketingPost.update({ where: { id: postId }, data: { agentMeta: json({ ...((post.agentMeta as object | null) ?? {}), hold: false }) } })
  return schedulePiece(agent, postId, 'copilot')
}

export async function rejectPost(agent: Agent, postId: string, reason: string) {
  const post = await prisma.marketingPost.findFirst({ where: { id: postId, agentId: agent.id }, select: { id: true, status: true, ideaId: true, title: true } })
  if (!post) throw new AgentError('Publicación no encontrada')
  if (['published', 'partial', 'publishing'].includes(post.status)) throw new AgentError('Ya salió: no se puede rechazar')
  const t = nextAgentState(post.status === 'scheduled' ? 'scheduled' : (post.status as AgentState), post.status === 'scheduled' ? 'cancelled' : 'rejected', 'copilot', { discard: true })
  if (!t) throw new AgentError('No se puede rechazar en este estado')
  await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'archived', rejectedReason: reason.slice(0, 500) } })
  await runActions(agent, t.actions.filter((a) => a !== 'record_rejection'), { postId, ideaId: post.ideaId, title: post.title, mode: 'copilot', problems: [], isNew: false, reason })
}

/** Supervised opt-out: out of the queue (kept approved, the agent will not reschedule it) or dropped. */
export async function cancelPost(agent: Agent, postId: string, discard: boolean, reason?: string | null) {
  const post = await prisma.marketingPost.findFirst({ where: { id: postId, agentId: agent.id }, select: { status: true, ideaId: true, title: true, agentMeta: true } })
  if (!post) throw new AgentError('Publicación no encontrada')
  const t = nextAgentState(post.status as AgentState, 'cancelled', 'copilot', { discard })
  if (!t) throw new AgentError('Solo se cancela lo que está programado')
  await cancelScheduled(postId)
  await prisma.marketingPost.update({
    where: { id: postId },
    data: { status: t.state === 'archived' ? 'archived' : 'approved', optOutDeadline: null, rejectedReason: discard ? reason?.slice(0, 500) || 'Cancelada antes de salir' : null, agentMeta: json({ ...((post.agentMeta as object) ?? {}), hold: !discard }) },
  })
  if (discard && post.ideaId) await prisma.marketingIdea.update({ where: { id: post.ideaId }, data: { status: 'rejected', rejectedReason: reason?.slice(0, 500) || 'Cancelada antes de salir' } }).catch(() => null)
}

export async function decideIdeas(agent: Agent, ids: string[], decision: 'accept' | 'reject', userId: string, reason?: string | null) {
  const ideas = await prisma.marketingIdea.findMany({ where: { id: { in: ids.slice(0, 50) }, agentId: agent.id } })
  let changed = 0
  for (const idea of ideas) {
    const t = nextAgentState(idea.status === 'proposed' ? 'idea_proposed' : idea.status === 'accepted' ? 'idea_accepted' : 'idea_drafted', decision === 'accept' ? 'idea_accepted' : 'idea_rejected', 'copilot')
    if (!t) continue
    await prisma.marketingIdea.update({ where: { id: idea.id }, data: { status: t.state === 'idea_accepted' ? 'accepted' : 'rejected', rejectedReason: decision === 'reject' ? reason?.slice(0, 500) || null : null, decidedById: userId, decidedAt: new Date() } })
    changed++
  }
  return changed
}

/** Kill switch: nothing of the agent stays queued; drafts, reviews and published posts are untouched. */
export async function pauseAgent(agentId: string) {
  await prisma.marketingAgent.update({ where: { id: agentId }, data: { status: 'paused' } })
  const queued = await prisma.marketingPost.findMany({ where: { agentId, status: 'scheduled' }, select: { id: true } })
  for (const p of queued) {
    const t = nextAgentState('scheduled', 'paused', 'copilot')!
    if (t.actions.includes('cancel_scheduled')) await cancelScheduled(p.id)
    await prisma.marketingPost.update({ where: { id: p.id }, data: { optOutDeadline: null } })
  }
  return queued.length
}

// ─── Learn ──────────────────────────────────────────────────────────────────

function statsTable(stats: LearningStats) {
  const lines = DIMENSIONS.map((d) => {
    const items = stats.byDimension[d]
    return items.length ? `${DIMENSION_LABEL[d]}: ${items.slice(0, 6).map((x) => `${x.value} ${x.smoothedLift.toFixed(2)}× (${x.n}${x.lowData ? ', pocos datos' : ''})`).join('; ')}` : ''
  }).filter(Boolean)
  const best = stats.best.map((p) => `${p.title} ${p.lift.toFixed(2)}×`).join('; ')
  const worst = stats.worst.map((p) => `${p.title} ${p.lift.toFixed(2)}×`).join('; ')
  const rej = stats.rejections.byReason.map((r) => `${r.reason} (${r.n})`).join('; ')
  return [...lines, best ? `Mejores: ${best}` : '', worst ? `Peores: ${worst}` : '', rej ? `Motivos de rechazo: ${rej}` : ''].filter(Boolean).join('\n')
}

/** Weekly retrospective. In autopilot its recommendations apply within the limits; otherwise they wait for a person. */
export async function learn(agent: Agent, now = new Date()) {
  return withRun(agent, 'learn', null, async (meter) => {
    const config = configOf(agent)
    const rows = await learningRows({ agentId: agent.id }, now)
    if (rows.length < 3) {
      await prisma.marketingAgent.update({ where: { id: agent.id }, data: { lastLearnedAt: now } })
      return { summary: `Aún no hay suficientes resultados: ${rows.length} envíos con 48 h medidos (hacen falta 3)`, value: null, skipped: true }
    }
    const ai = await assertCanSpend(agent)
    const stats = learningStats(rows, config.kpi, await rejectionsFor(agent.id, now))
    const ctx = await promptContext(agent, now)
    const from = agent.lastLearnedAt ?? rows[rows.length - 1].publishedAt
    const input = await callTool(agent, ai.defaultModel, {
      kind: 'marketing_agent_learn', system: ctx.system, tool: LEARN_TOOL, maxTokens: 2500, effort: 'medium',
      task: learnTask({ from: bogota(from).key, to: bogota(now).key, table: statsTable(stats) }),
    }, meter)
    const parsed = parseRetrospective(input)
    if (!parsed.ok) throw new AgentError(parsed.errors.join(' · '))
    const strategy = strategyOf(agent)
    const auto = agent.mode === 'autopilot' && !agent.degradedReason && strategy
    const applied = auto ? applyRecommendations(config, strategy!, parsed.value.recommendations) : null
    if (applied) await prisma.marketingAgent.update({ where: { id: agent.id }, data: { config: json(applied.config), strategy: json(applied.strategy) } })
    const learning = await prisma.marketingAgentLearning.create({
      data: {
        agentId: agent.id, periodStart: from, periodEnd: now, sampleSize: rows.length, metricsByDimension: json(stats),
        insights: parsed.value.insights.map((i) => `- ${i}`).join('\n'), recommendations: json(parsed.value.recommendations),
        applied: Boolean(applied), appliedAt: applied ? now : null,
      },
    })
    await prisma.marketingAgent.update({ where: { id: agent.id }, data: { lastLearnedAt: now } })
    await notify(noticeTarget(agent), {
      type: 'learning', title: `Lo que aprendió el agente esta semana: ${agent.campaign.name}`,
      body: `${parsed.value.insights.slice(0, 3).join('\n')}${applied ? `\nAplicado: ${applied.applied.join('; ') || 'nada que cambiar'}` : parsed.value.recommendations.length ? '\nHay recomendaciones esperando tu aprobación.' : ''}`,
      url: agentUrl(agent.id), dedupeKey: `learning:${learning.id}`,
    })
    return { summary: `${parsed.value.insights.length} hallazgos y ${parsed.value.recommendations.length} recomendaciones${applied ? ` (${applied.applied.length} aplicadas)` : ''}`, value: learning.id, output: { applied: applied?.applied ?? [], skipped: applied?.skipped ?? [] } }
  })
}

/** A person approves a retrospective's recommendations (copilot and supervised). */
export async function applyLearning(agent: Agent, learningId: string, userId: string) {
  const learning = await prisma.marketingAgentLearning.findFirst({ where: { id: learningId, agentId: agent.id } })
  if (!learning) throw new AgentError('Aprendizaje no encontrado')
  if (learning.applied) throw new AgentError('Ya se aplicó')
  const strategy = strategyOf(agent)
  if (!strategy) throw new AgentError('El agente no tiene estrategia')
  const r = applyRecommendations(configOf(agent), strategy, (learning.recommendations as Recommendation[]) ?? [])
  await prisma.$transaction([
    prisma.marketingAgent.update({ where: { id: agent.id }, data: { config: json(r.config), strategy: json(r.strategy) } }),
    prisma.marketingAgentLearning.update({ where: { id: learning.id }, data: { applied: true, appliedAt: new Date(), appliedById: userId } }),
  ])
  return r
}

// ─── The cycle ──────────────────────────────────────────────────────────────

/** Budget, workspace cap and the accounts it publishes with: forced to copilot while any fails. */
async function refreshDegradation(agent: Agent, now: Date) {
  const config = configOf(agent)
  const [spent, ws, accounts] = await Promise.all([agentSpend(agent.id, now), checkWorkspaceBudget(agent.workspaceId), workspaceAccounts(agent.workspaceId)])
  const chosen = accounts.filter((a) => config.channels[a.channel].enabled && (!config.channels[a.channel].accountIds.length || config.channels[a.channel].accountIds.includes(a.id)))
  const reason = degradation({ agentBudget: { spentUsd: spent, capUsd: agent.monthlyBudgetUsd }, workspaceBlocked: ws.state === 'blocked', brokenAccounts: chosen.filter((a) => !a.ok).map((a) => a.name) })
  const level = budgetLevel(spent, agent.monthlyBudgetUsd)
  const target = noticeTarget(agent)
  if (level !== 'ok') {
    await notify(target, {
      type: 'budget', title: level === 'blocked' ? `El agente agotó su presupuesto del mes: ${agent.campaign.name}` : `El agente usó el 80 % de su presupuesto: ${agent.campaign.name}`,
      body: `Lleva $${spent.toFixed(2)} de $${agent.monthlyBudgetUsd.toFixed(2)} este mes.${level === 'blocked' ? ' Deja de redactar hasta el próximo mes o hasta que subas el presupuesto.' : ''}`,
      url: agentUrl(agent.id), dedupeKey: `budget:${agent.id}:${periodOf(now)}:${level}`,
    })
  }
  if (reason !== agent.degradedReason) {
    await prisma.marketingAgent.update({ where: { id: agent.id }, data: { degradedReason: reason } })
    agent.degradedReason = reason
    const kind: NoticeType = 'degraded'
    if (reason) await notify(target, { type: kind, title: `El agente pasó a copiloto: ${agent.campaign.name}`, body: `${reason}. Mientras tanto, cada pieza espera tu aprobación.`, url: agentUrl(agent.id), dedupeKey: `degraded:${agent.id}:${bogota(now).key}:${reason.slice(0, 40)}` })
    else await notify(target, { type: kind, title: `El agente volvió a su modo: ${agent.campaign.name}`, body: 'Se resolvió lo que lo tenía en copiloto.', url: agentUrl(agent.id) })
  }
  return { reason, level, wsBlocked: ws.state === 'blocked' }
}

/** Outcome notices for the agent's posts that finished publishing. */
async function outcomeNotices(agent: Agent) {
  const done = await prisma.marketingPost.findMany({ where: { agentId: agent.id, status: { in: ['published', 'partial', 'failed'] }, agentNoticeSentAt: null }, select: { id: true, title: true, status: true, publications: { where: { status: 'failed' }, select: { lastError: true }, take: 1 } }, take: 20 })
  for (const p of done) {
    const failed = p.status !== 'published'
    await notify(noticeTarget(agent), {
      type: failed ? 'failed' : 'published', title: failed ? `Falló al publicar «${p.title}»` : `Publicada: «${p.title}»`,
      body: failed ? p.publications[0]?.lastError ?? 'Revisa los envíos.' : null, url: postUrl(p.id), postId: p.id, dedupeKey: `outcome:${p.id}`,
    })
    await prisma.marketingPost.update({ where: { id: p.id }, data: { agentNoticeSentAt: new Date() } })
  }
}

/**
 * One pass of an active agent (cron every 30 min): notices, queue what people approved, drop stale
 * ideas, plan when the calendar has gaps, write what is due, learn weekly. Locked per agent; stops
 * calling the model when the time budget is short.
 */
export async function runAgentCycle(agentId: string, deadline = Date.now() + 240_000, now = new Date()) {
  const lock = await prisma.marketingAgent.updateMany({ where: { id: agentId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(now.getTime() + LOCK_MS) } })
  if (!lock.count) return { agentId, skipped: 'locked' }
  const report: string[] = []
  try {
    const agent = await loadAgent(agentId)
    if (!agent || agent.status !== 'active') return { agentId, skipped: 'inactive' }
    const config = configOf(agent)
    if (agent.campaign.endsAt && agent.campaign.endsAt.getTime() < now.getTime() && !config.alwaysOn) {
      await pauseAgent(agent.id)
      await prisma.marketingAgent.update({ where: { id: agent.id }, data: { status: 'finished' } })
      await notify(noticeTarget(agent), { type: 'learning', title: `La campaña terminó: ${agent.campaign.name}`, body: 'El agente se detuvo. Revisa los resultados en Estadísticas.', url: agentUrl(agent.id), dedupeKey: `finished:${agent.id}` })
      return { agentId, finished: true }
    }
    const deg = await refreshDegradation(agent, now)
    await outcomeNotices(agent)

    // Approved but not queued: a person approved it (copilot timing), or the agent did and scheduling
    // failed (it keeps its mode, unless the agent is now in copilot: then a person must approve it)
    const approved = await prisma.marketingPost.findMany({ where: { agentId: agent.id, status: 'approved', publications: { none: { status: 'scheduled' } } }, select: { id: true, title: true, agentMeta: true, approvedById: true, variants: { select: { channel: true } } }, take: 10 })
    for (const p of approved) {
      if ((p.agentMeta as { hold?: boolean } | null)?.hold) continue
      let mode: AgentMode = 'copilot'
      if (!p.approvedById) {
        mode = modeFor(agent, p.variants.map((v) => v.channel as MarketingChannel))
        if (mode === 'copilot') {
          await prisma.marketingPost.update({ where: { id: p.id }, data: { status: 'review', approvedAt: null } })
          await runActions(agent, ['notify_approval'], { postId: p.id, ideaId: null, title: p.title, mode, problems: [], isNew: true })
          continue
        }
      }
      const r = await schedulePiece(agent, p.id, mode, now)
      report.push(`programar ${p.id}: ${r.ok ? 'ok' : r.message}`)
    }

    const stale = await prisma.marketingIdea.updateMany({ where: { agentId: agent.id, status: { in: ['proposed', 'accepted'] }, targetDate: { lt: new Date(now.getTime() - IDEA_STALE_MS) } }, data: { status: 'discarded', rejectedReason: 'Pasó su fecha sin redactarse' } })
    if (stale.count) report.push(`${stale.count} ideas vencidas`)

    const aiAllowed = agent.strategyApprovedAt && deg.level !== 'blocked' && !deg.wsBlocked
    if (!aiAllowed) return { agentId, report, ai: false }
    const timeLeft = () => deadline - Date.now()

    let planned = false
    if (timeLeft() > 120_000 && (!agent.lastPlannedAt || now.getTime() - agent.lastPlannedAt.getTime() > PLAN_EVERY_MS)) {
      const r = await planIdeas(agent, now)
      report.push(`plan: ${r.ok ? r.summary : r.error}`)
      planned = r.ok && !r.skipped
    }

    const due = await prisma.marketingIdea.findMany({
      where: { agentId: agent.id, status: 'accepted', targetDate: { lte: new Date(now.getTime() + config.schedule.draftLeadHours * H) } },
      orderBy: [{ targetDate: 'asc' }, { score: 'desc' }],
      take: planned ? 1 : MAX_DRAFTS_PER_CYCLE,
    })
    for (const idea of due) {
      if (timeLeft() < 120_000) break
      const r = await draftIdea(agent, idea.id)
      report.push(`redactar: ${r.ok ? r.summary : r.error}`)
      if (!r.ok) break
      Object.assign(agent, await loadAgent(agent.id))
    }

    if (timeLeft() > 90_000 && (!agent.lastLearnedAt || now.getTime() - agent.lastLearnedAt.getTime() > LEARN_EVERY_MS)) {
      const r = await learn(agent, now)
      report.push(`aprender: ${r.ok ? r.summary : r.error}`)
    }
    return { agentId, report }
  } catch (err) {
    logger.error('Agent cycle failed', { agentId, err: err instanceof Error ? err.message : err })
    return { agentId, error: err instanceof Error ? err.message : 'error' }
  } finally {
    await prisma.marketingAgent.update({ where: { id: agentId }, data: { lockedUntil: null, lastRunAt: new Date() } }).catch(() => null)
  }
}

/** Cron: active agents, least recently run first, within the function's time. */
export async function runMarketingAgents(budgetMs = 250_000) {
  const deadline = Date.now() + budgetMs
  const agents = await prisma.marketingAgent.findMany({ where: { status: 'active' }, orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } }, select: { id: true }, take: 20 })
  const results = []
  for (const a of agents) {
    if (deadline - Date.now() < 60_000) break
    results.push(await runAgentCycle(a.id, deadline))
  }
  return { agents: agents.length, ran: results.length, results }
}
