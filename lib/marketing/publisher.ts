import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import type { ChannelConnection, MarketingPublication, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { MetaGraphError } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, getConnectionMeta, requireMetaApp } from '@/lib/messaging/meta-channels'
import { instagramFormat, validateVariant, type MarketingChannel, type MediaInfo } from '@/lib/marketing/channel-rules'
import { deliveryUrl } from '@/lib/marketing/media'
import { articleUrl } from '@/lib/marketing/seo'
import { editorialGate, holdForReview } from '@/lib/marketing/editorial'
import {
  CONTAINER_TIMEOUT_MS,
  MAX_ATTEMPTS,
  STALE_CLAIM_MS,
  aggregatePostStatus,
  classifyGraphError,
  findAlreadyPublished,
  latestPerTarget,
  nextAttemptAt,
  type PostStatus,
  type PublicationStatus,
} from '@/lib/marketing/publisher-core'
import {
  FB_REEL_PREFIX,
  finishFacebookReel,
  finishInstagramContainer,
  publishToFacebook,
  publishToInstagram,
  recentFacebookPosts,
  recentFacebookReels,
  recentFacebookStories,
  recentInstagramMedia,
  recentInstagramStories,
  warmMedia,
  type PublishResult,
} from '@/lib/marketing/meta-publish'
import { STORY_TTL_MS, isStory, readPublishOptions, resolveFormat } from '@/lib/marketing/publish-options'

const logger = createLogger('marketing-publisher')

/** The Meta account type each social channel publishes through. */
export const CONNECTION_CHANNEL: Record<Exclude<MarketingChannel, 'WEB'>, 'MESSENGER' | 'INSTAGRAM'> = { FACEBOOK: 'MESSENGER', INSTAGRAM: 'INSTAGRAM' }

export type Target = { channel: MarketingChannel; connectionId: string | null }

export class PublishValidationError extends Error {
  constructor(public issues: Array<{ channel: string; account?: string; message: string }>) {
    super(issues.map((i) => `${i.channel}${i.account ? ` (${i.account})` : ''}: ${i.message}`).join(' · '))
  }
}

export const postInclude = { variants: true, media: { orderBy: { position: 'asc' as const } } } satisfies Prisma.MarketingPostInclude
export type FullPost = Prisma.MarketingPostGetPayload<{ include: typeof postInclude }>

export function mediaFor(post: FullPost, variant: FullPost['variants'][number]) {
  const all = post.media
  if (!variant.mediaIds.length) return all
  const byId = new Map(all.map((m) => [m.id, m]))
  return variant.mediaIds.map((id) => byId.get(id)).filter((m): m is FullPost['media'][number] => Boolean(m))
}

export const infoOf = (m: FullPost['media'][number]): MediaInfo => ({ kind: m.kind === 'video' ? 'video' : 'image', mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, durationSec: m.durationSec, source: m.source })

export function validatePostForChannel(post: FullPost, channel: MarketingChannel) {
  const variant = post.variants.find((v) => v.channel === channel)
  if (!variant) return { variant: null, validation: null }
  const validation = validateVariant(channel, {
    body: variant.body, format: variant.format, options: readPublishOptions(variant.publishOptions), linkUrl: variant.linkUrl, media: mediaFor(post, variant).map(infoOf),
    title: post.title, slug: variant.slug, seoTitle: variant.seoTitle, seoDescription: variant.seoDescription, coverUrl: variant.coverUrl,
  })
  return { variant, validation }
}

/** Token already known to be broken (daily health check): fail fast with the reason instead of calling Meta. */
function brokenToken(conn: ChannelConnection) {
  const health = (conn.capabilities as { tokenHealth?: { valid?: boolean; error?: string } } | null)?.tokenHealth
  return health && health.valid === false ? health.error || 'El token de la cuenta no es válido' : null
}

/**
 * Creates one publication per target (channel + account) at `when`. Validates every target first and
 * refuses the whole schedule if one has errors, so nothing goes out half-checked. Previously
 * scheduled publications of the post that did not run yet are replaced (with `keepOtherTargets`, only
 * those of the same channel and account: the agent schedules each channel at its own hour).
 */
export async function schedulePost(postId: string, targets: Target[], when: Date, opts: { keepOtherTargets?: boolean } = {}) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, include: postInclude })
  if (!post) throw new Error('Publicación no encontrada')
  if (!targets.length) throw new PublishValidationError([{ channel: '—', message: 'Elige al menos un canal' }])

  const connections = await prisma.channelConnection.findMany({ where: { id: { in: targets.map((t) => t.connectionId).filter((x): x is string => Boolean(x)) } } })
  const issues: Array<{ channel: string; account?: string; message: string }> = []
  const rows: Array<{ channel: MarketingChannel; connectionId: string | null; variantId: string }> = []
  const seen = new Set<string>()
  for (const t of targets) {
    const key = `${t.channel}:${t.connectionId || 'web'}`
    if (seen.has(key)) continue
    seen.add(key)
    const { variant, validation } = validatePostForChannel(post, t.channel)
    if (!variant || !validation) { issues.push({ channel: t.channel, message: 'Falta el texto para este canal' }); continue }
    for (const e of validation.errors) issues.push({ channel: t.channel, message: e.message })
    if (t.channel !== 'WEB') {
      const conn = connections.find((c) => c.id === t.connectionId)
      if (!conn || conn.workspaceId !== post.workspaceId || conn.channel !== CONNECTION_CHANNEL[t.channel]) { issues.push({ channel: t.channel, message: 'Cuenta no válida para este canal' }); continue }
      if (!conn.enabled) issues.push({ channel: t.channel, account: conn.name, message: 'La cuenta está pausada en Admin → Canales' })
      const broken = brokenToken(conn)
      if (broken) issues.push({ channel: t.channel, account: conn.name, message: broken })
    } else if (variant.slug) {
      const clash = await prisma.marketingPostVariant.findFirst({ where: { slug: variant.slug, id: { not: variant.id } }, select: { id: true } })
      if (clash) issues.push({ channel: 'WEB', message: `La URL /blog/${variant.slug} ya la usa otro artículo` })
    }
    rows.push({ channel: t.channel, connectionId: t.channel === 'WEB' ? null : t.connectionId, variantId: variant.id })
  }
  // Every way into the queue passes here: a mandatory editorial review must cover exactly these texts
  const held = await editorialGate(post)
  if (held) issues.push({ channel: 'Revisión editorial', message: held })
  if (issues.length) throw new PublishValidationError(issues)

  const replaced: Prisma.MarketingPublicationWhereInput = opts.keepOtherTargets
    // Same channel left without account by a disconnect: replaced too (it could only fail)
    ? { postId, status: 'scheduled', OR: rows.flatMap((r) => [{ channel: r.channel, connectionId: r.connectionId }, ...(r.channel === 'WEB' ? [] : [{ channel: r.channel, connectionId: null }])]) }
    : { postId, status: 'scheduled' }
  const earliestOther = opts.keepOtherTargets
    ? await prisma.marketingPublication.findFirst({ where: { postId, status: 'scheduled', NOT: { OR: rows.map((r) => ({ channel: r.channel, connectionId: r.connectionId })) } }, orderBy: { scheduledAt: 'asc' }, select: { scheduledAt: true } })
    : null
  const postWhen = earliestOther && earliestOther.scheduledAt < when ? earliestOther.scheduledAt : when
  // A send waiting to retry may already be on the network: the new row keeps its attempts and start, so
  // the next run still checks for it before posting again
  const retrying = await prisma.marketingPublication.findMany({ where: { ...replaced, attempts: { gt: 0 } }, select: { channel: true, connectionId: true, attempts: true, createdAt: true } })
  const carried = new Map(retrying.map((r) => [targetKey(r), r]))
  await prisma.$transaction([
    prisma.marketingPublication.updateMany({ where: replaced, data: { status: 'cancelled', lastError: 'Reprogramada' } }),
    prisma.marketingPublication.createMany({
      data: rows.map((r) => {
        const prev = carried.get(targetKey(r))
        return { postId, variantId: r.variantId, channel: r.channel, connectionId: r.connectionId, scheduledAt: when, idempotencyKey: `${postId}:${r.channel}:${r.connectionId || 'web'}:${randomUUID()}`, ...(prev ? { attempts: prev.attempts, createdAt: prev.createdAt } : {}) }
      }),
    }),
    prisma.marketingPost.update({ where: { id: postId }, data: { scheduledAt: postWhen } }),
  ])
  await refreshPostStatus(postId)
  return prisma.marketingPublication.findMany({ where: { postId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } })
}

const targetKey = (t: { channel: string; connectionId: string | null }) => `${t.channel}:${t.connectionId || 'web'}`

/**
 * Publish now: schedule for this instant and run those publications inside this request. A target that
 * is going out or already went out is refused (a double click must not post twice) unless `republish`;
 * what is scheduled on the other channels (e.g. the agent's slots) stays unless `replaceOthers`.
 */
export async function publishNow(postId: string, targets: Target[], opts: { republish?: boolean; replaceOthers?: boolean } = {}) {
  if (!opts.republish && targets.length) {
    const pubs = await prisma.marketingPublication.findMany({ where: { postId }, select: { channel: true, connectionId: true, status: true, createdAt: true } })
    const latest = new Map(latestPerTarget(pubs).map((p) => [targetKey(p), p.status]))
    const busy: Array<{ channel: string; message: string }> = []
    for (const t of targets) {
      const st = latest.get(targetKey({ channel: t.channel, connectionId: t.channel === 'WEB' ? null : t.connectionId }))
      if (st === 'published') busy.push({ channel: t.channel, message: 'Ya se publicó en esta cuenta. Confirma si quieres publicarla otra vez' })
      else if (st === 'publishing' || st === 'processing') busy.push({ channel: t.channel, message: 'Ya se está publicando en esta cuenta' })
    }
    if (busy.length) throw new PublishValidationError(busy)
  }
  const created = await schedulePost(postId, targets, new Date(), { keepOtherTargets: !opts.replaceOthers })
  const wanted = new Set(targets.map((t) => targetKey({ channel: t.channel, connectionId: t.channel === 'WEB' ? null : t.connectionId })))
  const now = Date.now()
  const due = created.filter((p) => p.status === 'scheduled' && wanted.has(targetKey(p)) && p.scheduledAt.getTime() <= now)
  const claimed = await claim(due.map((p) => p.id))
  await Promise.all(claimed.map((p) => runPublication(p)))
  return prisma.marketingPublication.findMany({ where: { postId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } })
}

export async function cancelScheduled(postId: string, opts: { byPerson?: boolean } = {}) {
  await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Cancelada' } })
  await prisma.marketingPost.update({ where: { id: postId }, data: { scheduledAt: null } })
  if (opts.byPerson) await holdAgentPost(postId)
  await refreshPostStatus(postId)
}

/**
 * A person cancelled or took down an agent post: the agent must not queue it again on its own
 * (approving it again clears the hold).
 */
export async function holdAgentPost(postId: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { agentId: true, agentMeta: true } })
  if (!post?.agentId) return
  const meta = post.agentMeta && typeof post.agentMeta === 'object' && !Array.isArray(post.agentMeta) ? (post.agentMeta as Prisma.JsonObject) : {}
  await prisma.marketingPost.update({ where: { id: postId }, data: { agentMeta: { ...meta, hold: true } } })
}

/** Takes the listed scheduled publications atomically: a publication is run by one worker only. */
async function claim(ids: string[]) {
  if (!ids.length) return []
  const token = randomUUID()
  await prisma.marketingPublication.updateMany({
    where: { id: { in: ids }, status: 'scheduled' },
    data: { status: 'publishing', claimToken: token, claimedAt: new Date(), attempts: { increment: 1 } },
  })
  return prisma.marketingPublication.findMany({ where: { claimToken: token } })
}

export async function refreshPostStatus(postId: string) {
  const [post, pubs] = await Promise.all([
    prisma.marketingPost.findUnique({ where: { id: postId }, select: { status: true, publishedAt: true } }),
    prisma.marketingPublication.findMany({ where: { postId }, select: { status: true, publishedAt: true, channel: true, connectionId: true, createdAt: true } }),
  ])
  if (!post) return
  const status = aggregatePostStatus(post.status as PostStatus, latestPerTarget(pubs).map((p) => p.status as PublicationStatus))
  const firstPublished = pubs.map((p) => p.publishedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  await prisma.marketingPost.update({ where: { id: postId }, data: { status, publishedAt: post.publishedAt ?? firstPublished } })
}

/**
 * Writes the outcome only while the claim is still ours and never over a row already published (a
 * worker whose claim went stale must not undo what another worker finished).
 */
async function finish(pub: MarketingPublication, data: Prisma.MarketingPublicationUpdateManyMutationInput) {
  await prisma.marketingPublication.updateMany({
    where: { id: pub.id, status: { not: 'published' }, ...(pub.claimToken ? { claimToken: pub.claimToken } : {}) },
    data: { ...data, claimToken: null },
  })
  await refreshPostStatus(pub.postId)
}

async function fail(pub: MarketingPublication, err: unknown) {
  const kind = err instanceof MetaGraphError
    ? classifyGraphError({ code: err.code, subcode: err.subcode, status: err.status, message: err.message })
    : { retryable: false, tokenProblem: false, reason: err instanceof Error ? err.message : 'Error desconocido' }
  if (kind.tokenProblem && pub.connectionId) {
    await prisma.channelConnection.update({ where: { id: pub.connectionId }, data: { status: 'ERROR', lastError: kind.reason } }).catch(() => null)
  }
  const retryAt = kind.retryable ? nextAttemptAt(pub.attempts, new Date()) : null
  logger.warn('Publication failed', { publicationId: pub.id, channel: pub.channel, attempts: pub.attempts, retry: Boolean(retryAt), reason: kind.reason })
  await finish(pub, retryAt ? { status: 'scheduled', scheduledAt: retryAt, lastError: kind.reason } : { status: 'failed', lastError: kind.reason })
}

function revalidateBlog(slug?: string | null) {
  try {
    revalidatePath('/blog')
    if (slug) revalidatePath(`/blog/${slug}`)
    revalidatePath('/sitemap.xml')
  } catch {
    // Outside a request (tests, scripts): nothing to revalidate
  }
}

/** Runs one claimed publication. Never throws: the outcome is written on the publication. */
export async function runPublication(pub: MarketingPublication) {
  try {
    const post = await prisma.marketingPost.findUnique({ where: { id: pub.postId }, include: postInclude })
    const variant = post?.variants.find((v) => v.id === pub.variantId)
    if (!post || !variant) return finish(pub, { status: 'failed', lastError: 'La publicación o su texto ya no existe' })

    const { validation } = validatePostForChannel(post, pub.channel as MarketingChannel)
    if (validation && !validation.ok) return finish(pub, { status: 'failed', lastError: validation.errors.map((e) => e.message).join(' · ') })

    // Last check (also for the calendar's drag, retries and re-queued sends): what goes out is what the review approved
    const held = await editorialGate(post)
    if (held) {
      await holdForReview(post.id, held)
      return finish(pub, { status: 'cancelled', lastError: held })
    }

    if (pub.channel === 'WEB') {
      const now = new Date()
      await prisma.marketingPostVariant.update({ where: { id: variant.id }, data: { webPublishedAt: variant.webPublishedAt ?? now } })
      revalidateBlog(variant.slug)
      return finish(pub, { status: 'published', externalId: variant.slug, permalink: variant.slug ? articleUrl(variant.slug) : null, publishedAt: now })
    }

    const conn = pub.connectionId ? await prisma.channelConnection.findUnique({ where: { id: pub.connectionId } }) : null
    if (!conn) return finish(pub, { status: 'failed', lastError: 'La cuenta ya no está conectada' })
    if (!conn.enabled) return finish(pub, { status: 'failed', lastError: `La cuenta "${conn.name}" está pausada` })
    const broken = brokenToken(conn)
    if (broken) return finish(pub, { status: 'failed', lastError: broken })
    const token = getConnectionCredentials(conn)?.pageAccessToken
    if (!token) return finish(pub, { status: 'failed', lastError: 'Token no disponible: reconecta la cuenta' })
    const ctx = { app: await requireMetaApp(), token }
    const pageId = getConnectionMeta(conn).pageId || conn.externalId

    const social = pub.channel as 'FACEBOOK' | 'INSTAGRAM'
    const files = mediaFor(post, variant)
    const format = resolveFormat(social, variant.format, files.map(infoOf))
    const story = isStory(format)

    // A previous attempt may have reached Meta before dying: reuse or adopt it instead of posting twice
    if (pub.attempts > 1) {
      if (pub.containerId) {
        const fbReel = pub.containerId.startsWith(FB_REEL_PREFIX)
        const r = fbReel
          ? await finishFacebookReel(ctx, pub.containerId.slice(FB_REEL_PREFIX.length)).catch(() => null)
          : await finishInstagramContainer(ctx, conn.externalId, pub.containerId).catch(() => null)
        if (r?.status === 'published') {
          const at = new Date()
          return finish(pub, { status: 'published', externalId: r.externalId, permalink: r.permalink, publishedAt: at, lastError: null, ...(story ? { expiresAt: new Date(at.getTime() + STORY_TTL_MS) } : {}) })
        }
        // Still being processed by Meta: the worker follows it (no new upload)
        if (r?.status === 'processing') return finish(pub, { status: 'processing', containerId: r.containerId })
        // A container already published by the first attempt answers as an error: look for the post itself
        const existing = await findPreviousAttempt(pub, { ctx, pageId, igId: conn.externalId, format, body: variant.body })
        if (existing) return finish(pub, { status: 'published', externalId: existing.id, permalink: existing.permalink, publishedAt: existing.createdAt, ...(story ? { expiresAt: new Date(existing.createdAt.getTime() + STORY_TTL_MS) } : {}) })
      } else if (!story) {
        // No container saved: only a text match can tell (a story without container never reached Meta)
        const existing = await findPreviousAttempt(pub, { ctx, pageId, igId: conn.externalId, format, body: variant.body })
        if (existing) return finish(pub, { status: 'published', externalId: existing.id, permalink: existing.permalink, publishedAt: existing.createdAt })
      }
    }
    const saveContainer = async (containerId: string) => { await prisma.marketingPublication.updateMany({ where: { id: pub.id, claimToken: pub.claimToken }, data: { containerId } }) }

    const options = readPublishOptions(variant.publishOptions)
    const media = files.map((m) => ({ url: deliveryUrl(social, m.url, infoOf(m), format, options), kind: infoOf(m).kind, alt: m.alt }))
    // The network's version of each file must exist before Meta fetches it
    await Promise.all(media.map((m) => warmMedia(m.url, m.kind)))
    const aiGenerated = files.some((m) => m.source === 'ai')
    let result: PublishResult
    if (social === 'FACEBOOK') {
      result = await publishToFacebook(ctx, pageId, { message: variant.body, link: variant.linkUrl, media, format: format as 'post' | 'reel' | 'story', options, aiGenerated }, saveContainer)
    } else {
      result = await publishToInstagram(ctx, conn.externalId, { caption: story ? '' : variant.body, format: format as 'feed' | 'carousel' | 'reel' | 'trial_reel' | 'story', media, options, aiGenerated }, saveContainer)
    }
    if (result.status === 'processing') return finish(pub, { status: 'processing', containerId: result.containerId })
    const now = new Date()
    return finish(pub, { status: 'published', externalId: result.externalId, permalink: result.permalink, publishedAt: now, lastError: null, ...(story ? { expiresAt: new Date(now.getTime() + STORY_TTL_MS) } : {}) })
  } catch (err) {
    await fail(pub, err)
  }
}

/**
 * What an earlier attempt of this publication may have left on the account. Posts and reels are matched
 * by their text; stories carry no text, so a story created after the publication that no other
 * publication of ours already owns is taken as this one.
 */
async function findPreviousAttempt(pub: MarketingPublication, p: { ctx: { app: Awaited<ReturnType<typeof requireMetaApp>>; token: string }; pageId: string; igId: string; format: string; body: string }) {
  if (isStory(p.format)) {
    const stories = pub.channel === 'FACEBOOK' ? await recentFacebookStories(p.ctx, p.pageId).catch(() => []) : await recentInstagramStories(p.ctx, p.igId).catch(() => [])
    const candidates = stories.filter((x) => x.createdAt.getTime() >= pub.createdAt.getTime() - 60_000).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    if (!candidates.length) return null
    const owned = new Set((await prisma.marketingPublication.findMany({ where: { externalId: { in: candidates.map((x) => x.id) }, NOT: { id: pub.id } }, select: { externalId: true } })).map((x) => x.externalId))
    return candidates.find((x) => !owned.has(x.id)) ?? null
  }
  const recent = pub.channel === 'FACEBOOK'
    ? p.format === 'reel' ? await recentFacebookReels(p.ctx, p.pageId).catch(() => []) : await recentFacebookPosts(p.ctx, p.pageId).catch(() => [])
    : await recentInstagramMedia(p.ctx, p.igId).catch(() => [])
  // scheduledAt was moved to the retry time: the first attempt ran after the publication was created
  return findAlreadyPublished(recent, p.body, pub.createdAt)
}

/**
 * Claim marker of a processing container: `proc:<epoch ms>` (13 digits until the year 2286, so the
 * markers compare as strings), which lets a claim left by a dead worker expire.
 */
const procToken = (ms: number) => `proc:${ms}`

/** Takes one processing container for this worker only (two crons must not publish it twice). */
async function claimProcessing(pub: MarketingPublication) {
  const now = Date.now()
  const token = `${procToken(now)}:${randomUUID()}`
  const r = await prisma.marketingPublication.updateMany({
    where: { id: pub.id, status: 'processing', OR: [{ claimToken: null }, { claimToken: { lt: procToken(now - STALE_CLAIM_MS) } }] },
    data: { claimToken: token },
  })
  return r.count ? { ...pub, claimToken: token } : null
}

/** Videos still being processed by Meta (Instagram containers, Facebook reels): publish them when ready. */
async function runProcessing(limit: number) {
  const items = await prisma.marketingPublication.findMany({
    where: { status: 'processing', containerId: { not: null } },
    include: { connection: true },
    orderBy: { claimedAt: 'asc' },
    take: limit,
  })
  const variants = await prisma.marketingPostVariant.findMany({ where: { id: { in: items.map((i) => i.variantId) } }, select: { id: true, format: true } })
  const formatOf = new Map(variants.map((v) => [v.id, v.format]))
  let done = 0
  for (const candidate of items) {
    const claimed = await claimProcessing(candidate)
    if (!claimed) continue
    const pub = { ...candidate, claimToken: claimed.claimToken }
    const release = () => prisma.marketingPublication.updateMany({ where: { id: pub.id, claimToken: pub.claimToken }, data: { claimToken: null } })
    const fbReel = Boolean(pub.containerId?.startsWith(FB_REEL_PREFIX))
    // A Facebook reel was sent with «publish when ready»: Meta may publish it after any timeout of ours
    const timeoutMs = fbReel ? 3 * 3600_000 : CONTAINER_TIMEOUT_MS
    try {
      if (!pub.connection || !pub.containerId) { await finish(pub, { status: 'failed', lastError: 'La cuenta ya no está conectada' }); continue }
      const token = getConnectionCredentials(pub.connection)?.pageAccessToken
      if (!token) { await finish(pub, { status: 'failed', lastError: 'Token no disponible: reconecta la cuenta' }); continue }
      const ctx = { app: await requireMetaApp(), token }
      // The state first, the timeout after: a video that finished late is published, not failed
      const r = fbReel
        ? await finishFacebookReel(ctx, pub.containerId.slice(FB_REEL_PREFIX.length))
        : await finishInstagramContainer(ctx, pub.connection.externalId, pub.containerId)
      if (r.status === 'published') {
        const now = new Date()
        await finish(pub, { status: 'published', externalId: r.externalId, permalink: r.permalink, publishedAt: now, lastError: null, ...(isStory(formatOf.get(pub.variantId)) ? { expiresAt: new Date(now.getTime() + STORY_TTL_MS) } : {}) })
        done++
      } else if (r.status === 'error') {
        await finish(pub, { status: 'failed', lastError: r.detail })
      } else if (pub.claimedAt && Date.now() - pub.claimedAt.getTime() > timeoutMs) {
        await finish(pub, { status: 'failed', lastError: fbReel ? 'Facebook lleva 3 horas procesando el reel. Revisa la página antes de reintentar: puede haberse publicado solo' : 'Instagram no terminó de procesar el video en 30 minutos' })
      } else {
        // Still processing: release the claim for the next run
        await release()
      }
    } catch (err) {
      // A transient error while checking is not a failed send: re-queuing would upload the video again
      const kind = err instanceof MetaGraphError ? classifyGraphError({ code: err.code, subcode: err.subcode, status: err.status, message: err.message }) : { retryable: true }
      if (kind.retryable) { await release(); continue }
      await fail(pub, err)
    }
  }
  return done
}

/**
 * The worker (cron, every minute): frees claims of workers that died, takes what is due, runs it with
 * limited concurrency, then advances Instagram videos that were processing.
 */
export async function runDuePublications(limit = 20, budgetMs = 240_000) {
  const now = new Date()
  const started = Date.now()
  // Worker died mid-publication: back to the queue (the idempotency check avoids a duplicate)
  const stale = { status: 'publishing', claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } }
  await prisma.marketingPublication.updateMany({ where: { ...stale, attempts: { gte: MAX_ATTEMPTS } }, data: { status: 'failed', claimToken: null, lastError: 'Se interrumpió el envío varias veces' } })
  await prisma.marketingPublication.updateMany({ where: stale, data: { status: 'scheduled', claimToken: null, lastError: 'Se interrumpió el envío; se reintenta' } })
  // Videos Meta is processing first: they are quick checks and their wait counts against a timeout
  const processed = await runProcessing(limit)
  // Then the due sends in batches of 5, each batch taken only with enough time left to run it
  // (a send claimed and cut by the function's limit would use up one of its attempts for nothing)
  let ran = 0
  while (ran < limit && Date.now() - started < budgetMs - 150_000) {
    const due = await prisma.marketingPublication.findMany({ where: { status: 'scheduled', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 5, select: { id: true } })
    if (!due.length) break
    const claimed = await claim(due.map((d) => d.id))
    if (!claimed.length) break
    await Promise.all(claimed.map((p) => runPublication(p)))
    ran += claimed.length
  }
  return { ran, containersPublished: processed }
}
