/**
 * Editorial review, server part: settings, one review pass (proofreader then editor) with its records,
 * the post's review state and the publishing gate. No agent logic here: the agent (and the routes for
 * people) call it with their own context and budget check.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { callClaude, describeApiError, type CallResult } from '@/lib/ai/anthropic'
import type { AiCallKind } from '@/lib/ai/calls'
import { getAiSettings } from '@/lib/ai/settings'
import {
  activeCriteria,
  applyCorrections,
  collectTexts,
  contentHash,
  editorOutcome,
  gateReason,
  parseEditor,
  parseProofread,
  type Correction,
  type EditorOutcome,
  type Instruction,
  type RejectedCorrection,
} from '@/lib/marketing/editorial-core'
import { EDITOR_TOOL, SPELLING_TOOL, editorSystem, editorTask, proofreadSystem, proofreadTask } from '@/lib/marketing/editorial-prompt'
import { CRITERION_LABEL, PASSING, editorialFromRow, reviewApplies, type EditorialSettings, type ReviewStatus } from '@/lib/marketing/editorial-rubric'
import { notify, postUrl } from '@/lib/marketing/agent-notices'

const logger = createLogger('marketing-editorial')

const CALL_TIMEOUT_MS = 120_000
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getEditorialSettings(workspaceId: string): Promise<EditorialSettings> {
  const row = await prisma.marketingEditorialSettings.findUnique({ where: { workspaceId } }).catch((err) => {
    // Before the SQL runs the table does not exist: the review is off rather than breaking publishing
    logger.warn('Editorial settings unavailable', { err: err instanceof Error ? err.message : err })
    return undefined
  })
  if (row === undefined) return { ...editorialFromRow(null), spellingEnabled: false, editorEnabled: false, required: false }
  return editorialFromRow(row as Parameters<typeof editorialFromRow>[0])
}

export async function saveEditorialSettings(workspaceId: string, s: EditorialSettings, userId: string | null) {
  const data = { ...s, rubric: json(s.rubric), updatedById: userId }
  return prisma.marketingEditorialSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data })
}

// ─── Post texts ─────────────────────────────────────────────────────────────

const reviewInclude = { variants: true, media: { select: { id: true, alt: true } } } satisfies Prisma.MarketingPostInclude
export type ReviewPost = Prisma.MarketingPostGetPayload<{ include: typeof reviewInclude }>

export const loadReviewPost = (postId: string) => prisma.marketingPost.findUnique({ where: { id: postId }, include: reviewInclude })
export const hashOf = (post: Pick<ReviewPost, 'title' | 'variants' | 'media'>) => contentHash(post)

/** Writes the proofread texts back where each one lives. */
async function writeTexts(post: ReviewPost, before: Record<string, string>, after: Record<string, string>) {
  for (const key of Object.keys(after)) {
    if (after[key] === before[key]) continue
    if (key === 'title') { await prisma.marketingPost.update({ where: { id: post.id }, data: { title: after[key].slice(0, 200) } }); continue }
    const media = /^media\.(.+)\.alt$/.exec(key)
    if (media) { await prisma.marketingMedia.updateMany({ where: { id: media[1], postId: post.id }, data: { alt: after[key] } }); continue }
    const [channel, field] = key.split('.')
    const variant = post.variants.find((v) => v.channel === channel)
    if (!variant || !['body', 'seoTitle', 'seoDescription', 'excerpt'].includes(field)) continue
    await prisma.marketingPostVariant.update({ where: { id: variant.id }, data: { [field]: after[key] } })
  }
}

// ─── One pass ───────────────────────────────────────────────────────────────

export type ReviewEnv = {
  workspaceId: string
  agentId: string | null
  brand: string
  treatment: 'tú' | 'usted'
  /** Catalog, voice, banned lists, promotions and strategy the editor checks against */
  context: string
  /** Service, city and brand names: the proofreader never changes them */
  protectedWords: string[]
  trigger: 'agent' | 'manual' | 'publish'
  createdById?: string | null
  /** Why no more may be spent now (agent budget, workspace cap, no provider), or null */
  canSpend: () => Promise<string | null>
  /** Each model call, for the caller's meter (the agent's run) */
  onCost?: (r: CallResult) => void
}

export type PassResult = {
  status: 'approved' | 'changes' | 'rejected' | 'failed'
  score: number | null
  instructions: Instruction[]
  corrections: number
  summary: string
  error: string | null
  costUsd: number
}

class ReviewError extends Error {}

async function callReviewer(env: ReviewEnv, p: { model: string; kind: AiCallKind; system: string; task: string; tool: Anthropic.Tool; maxTokens: number }, spent: { cost: number; tokensIn: number; tokensOut: number; model: string | null }) {
  let maxTokens = p.maxTokens
  for (let attempt = 0; ; attempt++) {
    let r: CallResult
    try {
      r = await callClaude(
        { model: p.model, system: [{ type: 'text', text: p.system }], messages: [{ role: 'user', content: p.task }], tools: [p.tool], maxTokens, effort: 'medium', timeoutMs: CALL_TIMEOUT_MS },
        { kind: p.kind, workspaceId: env.workspaceId },
      )
    } catch (err) {
      throw new ReviewError(describeApiError(err))
    }
    spent.cost += r.costUsd
    spent.tokensIn += r.usage.inputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens
    spent.tokensOut += r.usage.outputTokens
    spent.model = r.model
    env.onCost?.(r)
    if (r.message.stop_reason === 'refusal') throw new ReviewError('El modelo no quiso hacer la revisión')
    if (r.message.stop_reason === 'max_tokens') {
      if (attempt === 0) { maxTokens *= 2; continue }
      throw new ReviewError('La revisión salió demasiado larga')
    }
    const block = r.message.content.find((b) => b.type === 'tool_use' && b.name === p.tool.name)
    if (!block || block.type !== 'tool_use') throw new ReviewError('El revisor no entregó la respuesta en el formato pedido')
    return block.input
  }
}

const meterOf = () => ({ cost: 0, tokensIn: 0, tokensOut: 0, model: null as string | null })

async function record(post: ReviewPost, env: ReviewEnv, round: number, reviewer: 'spelling' | 'editor', data: Partial<Prisma.MarketingReviewUncheckedCreateInput>, m: ReturnType<typeof meterOf>) {
  await prisma.marketingReview.create({
    data: {
      postId: post.id, workspaceId: post.workspaceId, agentId: env.agentId, round, reviewer, trigger: env.trigger, createdById: env.createdById ?? null,
      costUsd: m.cost, tokensIn: m.tokensIn, tokensOut: m.tokensOut, model: m.model, verdict: 'error', ...data,
    },
  })
}

/** Proofreader. Returns the corrections applied, or throws ReviewError. */
async function proofread(post: ReviewPost, s: EditorialSettings, env: ReviewEnv, round: number, fallbackModel: string) {
  const m = meterOf()
  const texts = collectTexts(post)
  const before = Object.fromEntries(texts.map((t) => [t.key, t.text]))
  try {
    const why = await env.canSpend()
    if (why) throw new ReviewError(why)
    const call = (task: string) => callReviewer(env, { model: s.spellingModel || fallbackModel, kind: 'marketing_review_spelling', system: proofreadSystem(s, env.treatment, env.brand), task, tool: SPELLING_TOOL, maxTokens: texts.some((t) => t.key === 'WEB.body') ? 6000 : 2500 }, m)
    let parsed = parseProofread(await call(proofreadTask(texts)), texts)
    if (!parsed.ok) parsed = parseProofread(await call(`${proofreadTask(texts)}\n\nTu respuesta anterior no sirvió: ${parsed.errors.join(' · ')}`), texts)
    if (!parsed.ok) throw new ReviewError(parsed.errors.join(' · '))
    const protectedWords = [...s.neverCorrect, env.brand, ...env.protectedWords].filter((w) => w && w.length >= 2)
    const result = applyCorrections(before, parsed.value, protectedWords)
    await writeTexts(post, before, result.texts)
    await record(post, env, round, 'spelling', { verdict: result.applied.length ? 'corrected' : 'clean', changes: json(result.applied), rejected: json(result.rejected), summary: `${result.applied.length} corrección(es)${result.rejected.length ? `, ${result.rejected.length} descartada(s)` : ''}` }, m)
    return { applied: result.applied, rejected: result.rejected }
  } catch (err) {
    const message = err instanceof ReviewError ? err.message : describeApiError(err)
    await record(post, env, round, 'spelling', { error: message.slice(0, 1000) }, m).catch(() => null)
    throw new ReviewError(`Corrector: ${message}`)
  }
}

async function edit(post: ReviewPost, s: EditorialSettings, env: ReviewEnv, round: number, previous: Instruction[] | null, defaultModel: string): Promise<EditorOutcome & { summary: string }> {
  const m = meterOf()
  const texts = collectTexts(post)
  const channels = post.variants.map((v) => v.channel)
  const criteria = activeCriteria(s.rubric, channels)
  try {
    const why = await env.canSpend()
    if (why) throw new ReviewError(why)
    const system = editorSystem({ brand: env.brand, settings: s, criteria, treatment: env.treatment, context: env.context })
    const task = editorTask({ texts, channels, round, previous, brief: post.brief })
    const call = (t: string) => callReviewer(env, { model: s.editorModel || defaultModel, kind: 'marketing_review_editor', system, task: t, tool: EDITOR_TOOL, maxTokens: 3500 }, m)
    let parsed = parseEditor(await call(task), criteria)
    if (!parsed.ok) parsed = parseEditor(await call(`${task}\n\nTu respuesta anterior no sirvió; corrige esto: ${parsed.errors.join(' · ')}`), criteria)
    if (!parsed.ok) throw new ReviewError(parsed.errors.join(' · '))
    const out = editorOutcome(parsed.value, criteria, s.minScore)
    const verdict = out.result
    await record(post, env, round, 'editor', {
      verdict, score: out.score, scores: json(parsed.value.scores), instructions: json(out.instructions), summary: parsed.value.summary.slice(0, 1000), contentHash: hashOf(post),
    }, m)
    return { ...out, summary: parsed.value.summary }
  } catch (err) {
    const message = err instanceof ReviewError ? err.message : describeApiError(err)
    await record(post, env, round, 'editor', { error: message.slice(0, 1000) }, m).catch(() => null)
    throw new ReviewError(`Editor: ${message}`)
  }
}

/**
 * One review pass over what is saved now: proofreader (corrects in place) then editor (scores, decides).
 * Never throws: a reviewer that cannot run leaves the pass as «failed», and a failed review never lets
 * the piece out. `spellingOnly`: just the proofreader (the editor's button «Revisar ortografía»).
 */
export async function reviewPass(postId: string, s: EditorialSettings, env: ReviewEnv, opts: { round: number; previous?: Instruction[] | null; spellingOnly?: boolean }): Promise<PassResult> {
  const started = { cost: 0 }
  const track: ReviewEnv = { ...env, onCost: (r) => { started.cost += r.costUsd; env.onCost?.(r) } }
  let corrections = 0
  try {
    let post = await loadReviewPost(postId)
    if (!post) throw new ReviewError('Publicación no encontrada')
    const ai = await getAiSettings()
    if (s.spellingEnabled || opts.spellingOnly) {
      const r = await proofread(post, s, track, opts.round, ai.fallbackModel)
      corrections = r.applied.length
      if (r.applied.length) post = (await loadReviewPost(postId))!
    }
    if (opts.spellingOnly) return { status: 'approved', score: null, instructions: [], corrections, summary: `${corrections} corrección(es) de ortografía`, error: null, costUsd: started.cost }
    if (!s.editorEnabled) return { status: 'approved', score: null, instructions: [], corrections, summary: 'Corregida (editor apagado)', error: null, costUsd: started.cost }
    const out = await edit(post, s, track, opts.round, opts.previous ?? null, ai.defaultModel)
    return { status: out.result, score: out.score, instructions: out.instructions, corrections, summary: out.summary, error: null, costUsd: started.cost }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'La revisión falló'
    logger.warn('Review pass failed', { postId, message })
    return { status: 'failed', score: null, instructions: [], corrections, summary: message, error: message, costUsd: started.cost }
  }
}

/** The post's review state after a pass: what was reviewed (fingerprint) and how it ended. */
export async function saveReviewState(postId: string, status: ReviewStatus, p: { score?: number | null; rounds?: number }) {
  const post = await loadReviewPost(postId)
  if (!post) return
  await prisma.marketingPost.update({
    where: { id: postId },
    data: { reviewStatus: status, reviewHash: hashOf(post), reviewedAt: new Date(), ...(p.score !== undefined ? { reviewScore: p.score } : {}), ...(p.rounds !== undefined ? { reviewRounds: p.rounds } : {}) },
  })
}

/**
 * After a person's edit: a review that no longer matches the texts becomes «stale» (no model call,
 * the autosave may run every few seconds). Returns true when it changed.
 */
export async function markStaleIfChanged(postId: string) {
  const post = await loadReviewPost(postId).catch(() => null)
  if (!post?.reviewHash || post.reviewStatus === 'stale' || post.reviewStatus === 'pending') return false
  if (hashOf(post) === post.reviewHash) return false
  await prisma.marketingPost.update({ where: { id: postId }, data: { reviewStatus: 'stale' } })
  return true
}

// ─── Publishing gate ────────────────────────────────────────────────────────

/** Why this post may not be scheduled or published now (null = it may). */
export async function editorialGate(post: Pick<ReviewPost, 'workspaceId' | 'origin' | 'reviewStatus' | 'reviewHash' | 'title' | 'variants'> & { media: Array<{ id: string; alt: string | null }> }) {
  const s = await getEditorialSettings(post.workspaceId)
  return gateReason(s, post, hashOf(post))
}

/**
 * The worker found a post whose review does not cover what would go out: it does not publish, the
 * post goes back to review (stale if it changed) and the team is told.
 */
export async function holdForReview(postId: string, reason: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { id: true, title: true, agentId: true, workspaceId: true, reviewHash: true, reviewStatus: true, status: true } })
  if (!post) return
  await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: reason } })
  const full = await loadReviewPost(postId)
  const stale = full && post.reviewHash && hashOf(full) !== post.reviewHash
  await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'review', approvedAt: null, approvedById: null, scheduledAt: null, ...(stale ? { reviewStatus: 'stale' } : {}) } })
  if (post.agentId) {
    const agent = await prisma.marketingAgent.findUnique({ where: { id: post.agentId }, select: { id: true, workspaceId: true, config: true } })
    const email = Boolean((agent?.config as { notify?: { email?: boolean } } | null)?.notify?.email ?? true)
    if (agent) await notify({ id: agent.id, workspaceId: agent.workspaceId, email }, { type: 'editorial_review', title: `No se publicó «${post.title}»`, body: reason, url: postUrl(postId), postId, dedupeKey: `edhold:${postId}:${post.reviewHash ?? 'none'}` })
  }
}

// ─── What people see ────────────────────────────────────────────────────────

export async function reviewsOf(postId: string) {
  return prisma.marketingReview.findMany({ where: { postId }, orderBy: { createdAt: 'desc' }, take: 30 })
}

/** Last 30 days of the workspace: volume, first-time approvals, rounds, corrections, reasons, cost. */
export async function editorialStats(workspaceId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 3600_000)
  const rows = await prisma.marketingReview.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    select: { id: true, postId: true, round: true, reviewer: true, verdict: true, score: true, scores: true, changes: true, costUsd: true, createdAt: true, trigger: true, summary: true, error: true, post: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 3000,
  })
  const s = await getEditorialSettings(workspaceId)
  const posts = new Set(rows.map((r) => r.postId))
  const editor = rows.filter((r) => r.reviewer === 'editor' && r.verdict !== 'error')
  const firstByPost = new Map<string, (typeof editor)[number]>()
  for (const r of [...editor].reverse()) if (r.round === 0 && !firstByPost.has(r.postId)) firstByPost.set(r.postId, r)
  const firstApproved = Array.from(firstByPost.values()).filter((r) => r.verdict === 'approved').length
  const maxRound = new Map<string, number>()
  for (const r of editor) maxRound.set(r.postId, Math.max(maxRound.get(r.postId) ?? 0, r.round))
  const spelling = rows.filter((r) => r.reviewer === 'spelling' && r.verdict !== 'error')
  const corrections = spelling.reduce((n, r) => n + (Array.isArray(r.changes) ? r.changes.length : 0), 0)
  const reasons = new Map<string, number>()
  for (const r of editor.filter((x) => x.verdict !== 'approved')) {
    for (const c of (Array.isArray(r.scores) ? r.scores : []) as Array<{ id?: string; score?: number }>) {
      if (c.id && typeof c.score === 'number' && c.score < s.minScore) reasons.set(c.id, (reasons.get(c.id) ?? 0) + 1)
    }
  }
  const scores = editor.map((r) => r.score).filter((n): n is number => typeof n === 'number')
  return {
    reviewed: posts.size,
    firstPass: firstByPost.size,
    firstApproved,
    avgRounds: maxRound.size ? Array.from(maxRound.values()).reduce((a, b) => a + b, 0) / maxRound.size : 0,
    correctionsPerPiece: spelling.length ? corrections / new Set(spelling.map((r) => r.postId)).size : 0,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    errors: rows.filter((r) => r.verdict === 'error').length,
    reasons: Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ id, label: CRITERION_LABEL[id as keyof typeof CRITERION_LABEL] ?? id, n })),
    costUsd: rows.reduce((n, r) => n + r.costUsd, 0),
    recent: rows.slice(0, 25).map((r) => ({ id: r.id, postId: r.postId, title: r.post.title, reviewer: r.reviewer, verdict: r.verdict, score: r.score, round: r.round, trigger: r.trigger, summary: r.summary, error: r.error, costUsd: r.costUsd, createdAt: r.createdAt, corrections: Array.isArray(r.changes) ? r.changes.length : 0 })),
  }
}

export { PASSING, reviewApplies }
export type { Correction, RejectedCorrection }
