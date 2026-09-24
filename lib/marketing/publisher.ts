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
import {
  CONTAINER_TIMEOUT_MS,
  MAX_ATTEMPTS,
  STALE_CLAIM_MS,
  aggregatePostStatus,
  classifyGraphError,
  findAlreadyPublished,
  nextAttemptAt,
  type PostStatus,
  type PublicationStatus,
} from '@/lib/marketing/publisher-core'
import {
  finishInstagramContainer,
  publishToFacebook,
  publishToInstagram,
  recentFacebookPosts,
  recentInstagramMedia,
  type PublishResult,
} from '@/lib/marketing/meta-publish'

const logger = createLogger('marketing-publisher')

/** The Meta account type each social channel publishes through. */
export const CONNECTION_CHANNEL: Record<Exclude<MarketingChannel, 'WEB'>, 'MESSENGER' | 'INSTAGRAM'> = { FACEBOOK: 'MESSENGER', INSTAGRAM: 'INSTAGRAM' }

export type Target = { channel: MarketingChannel; connectionId: string | null }

export class PublishValidationError extends Error {
  constructor(public issues: Array<{ channel: string; account?: string; message: string }>) {
    super(issues.map((i) => `${i.channel}${i.account ? ` (${i.account})` : ''}: ${i.message}`).join(' · '))
  }
}

const postInclude = { variants: true, media: { orderBy: { position: 'asc' as const } } } satisfies Prisma.MarketingPostInclude
type FullPost = Prisma.MarketingPostGetPayload<{ include: typeof postInclude }>

function mediaFor(post: FullPost, variant: FullPost['variants'][number]) {
  const all = post.media
  if (!variant.mediaIds.length) return all
  const byId = new Map(all.map((m) => [m.id, m]))
  return variant.mediaIds.map((id) => byId.get(id)).filter((m): m is FullPost['media'][number] => Boolean(m))
}

const infoOf = (m: FullPost['media'][number]): MediaInfo => ({ kind: m.kind === 'video' ? 'video' : 'image', mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, durationSec: m.durationSec })

export function validatePostForChannel(post: FullPost, channel: MarketingChannel) {
  const variant = post.variants.find((v) => v.channel === channel)
  if (!variant) return { variant: null, validation: null }
  const validation = validateVariant(channel, {
    body: variant.body, format: variant.format, linkUrl: variant.linkUrl, media: mediaFor(post, variant).map(infoOf),
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
 * scheduled publications of the post that did not run yet are replaced.
 */
export async function schedulePost(postId: string, targets: Target[], when: Date) {
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
  if (issues.length) throw new PublishValidationError(issues)

  await prisma.$transaction([
    prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Reprogramada' } }),
    prisma.marketingPublication.createMany({
      data: rows.map((r) => ({ postId, variantId: r.variantId, channel: r.channel, connectionId: r.connectionId, scheduledAt: when, idempotencyKey: `${postId}:${r.channel}:${r.connectionId || 'web'}:${randomUUID()}` })),
    }),
    prisma.marketingPost.update({ where: { id: postId }, data: { scheduledAt: when } }),
  ])
  await refreshPostStatus(postId)
  return prisma.marketingPublication.findMany({ where: { postId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } })
}

/** Publish now: schedule for this instant and run those publications inside this request. */
export async function publishNow(postId: string, targets: Target[]) {
  const created = await schedulePost(postId, targets, new Date())
  const due = created.filter((p) => p.status === 'scheduled')
  const claimed = await claim(due.map((p) => p.id))
  await Promise.all(claimed.map((p) => runPublication(p)))
  return prisma.marketingPublication.findMany({ where: { postId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } })
}

export async function cancelScheduled(postId: string) {
  await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Cancelada' } })
  await prisma.marketingPost.update({ where: { id: postId }, data: { scheduledAt: null } })
  await refreshPostStatus(postId)
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
    prisma.marketingPublication.findMany({ where: { postId }, select: { status: true, publishedAt: true } }),
  ])
  if (!post) return
  const status = aggregatePostStatus(post.status as PostStatus, pubs.map((p) => p.status as PublicationStatus))
  const firstPublished = pubs.map((p) => p.publishedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  await prisma.marketingPost.update({ where: { id: postId }, data: { status, publishedAt: post.publishedAt ?? firstPublished } })
}

async function finish(pub: MarketingPublication, data: Prisma.MarketingPublicationUpdateInput) {
  await prisma.marketingPublication.update({ where: { id: pub.id }, data: { ...data, claimToken: null } })
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

    // A previous attempt may have published before dying: adopt that post instead of duplicating it
    if (pub.attempts > 1) {
      const recent = pub.channel === 'FACEBOOK' ? await recentFacebookPosts(ctx, pageId).catch(() => []) : await recentInstagramMedia(ctx, conn.externalId).catch(() => [])
      const existing = findAlreadyPublished(recent, variant.body, pub.scheduledAt)
      if (existing) return finish(pub, { status: 'published', externalId: existing.id, permalink: existing.permalink, publishedAt: existing.createdAt })
    }

    const media = mediaFor(post, variant).map((m) => ({ url: deliveryUrl(pub.channel as MarketingChannel, m.url, infoOf(m)), kind: infoOf(m).kind }))
    let result: PublishResult
    if (pub.channel === 'FACEBOOK') {
      result = await publishToFacebook(ctx, pageId, { message: variant.body, link: variant.linkUrl, media })
    } else {
      const format = instagramFormat(variant.format, mediaFor(post, variant).map(infoOf))
      result = await publishToInstagram(ctx, conn.externalId, { caption: variant.body, format, media })
    }
    if (result.status === 'processing') return finish(pub, { status: 'processing', containerId: result.containerId })
    return finish(pub, { status: 'published', externalId: result.externalId, permalink: result.permalink, publishedAt: new Date(), lastError: null })
  } catch (err) {
    await fail(pub, err)
  }
}

/** Instagram containers still being processed by Meta (videos): publish them when ready. */
async function runProcessing(limit: number) {
  const items = await prisma.marketingPublication.findMany({
    where: { status: 'processing', containerId: { not: null } },
    include: { connection: true },
    orderBy: { claimedAt: 'asc' },
    take: limit,
  })
  let done = 0
  for (const pub of items) {
    try {
      if (!pub.connection || !pub.containerId) { await finish(pub, { status: 'failed', lastError: 'La cuenta ya no está conectada' }); continue }
      if (pub.claimedAt && Date.now() - pub.claimedAt.getTime() > CONTAINER_TIMEOUT_MS) {
        await finish(pub, { status: 'failed', lastError: 'Instagram no terminó de procesar el video en 30 minutos' })
        continue
      }
      const token = getConnectionCredentials(pub.connection)?.pageAccessToken
      if (!token) { await finish(pub, { status: 'failed', lastError: 'Token no disponible: reconecta la cuenta' }); continue }
      const r = await finishInstagramContainer({ app: await requireMetaApp(), token }, pub.connection.externalId, pub.containerId)
      if (r.status === 'published') {
        await finish(pub, { status: 'published', externalId: r.externalId, permalink: r.permalink, publishedAt: new Date(), lastError: null })
        done++
      } else if (r.status === 'error') {
        await finish(pub, { status: 'failed', lastError: r.detail })
      }
    } catch (err) {
      await fail(pub, err)
    }
  }
  return done
}

/**
 * The worker (cron, every minute): frees claims of workers that died, takes what is due, runs it with
 * limited concurrency, then advances Instagram videos that were processing.
 */
export async function runDuePublications(limit = 20) {
  const now = new Date()
  // Worker died mid-publication: back to the queue (the idempotency check avoids a duplicate)
  const stale = { status: 'publishing', claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } }
  await prisma.marketingPublication.updateMany({ where: { ...stale, attempts: { gte: MAX_ATTEMPTS } }, data: { status: 'failed', claimToken: null, lastError: 'Se interrumpió el envío varias veces' } })
  await prisma.marketingPublication.updateMany({ where: stale, data: { status: 'scheduled', claimToken: null, lastError: 'Se interrumpió el envío; se reintenta' } })
  const due = await prisma.marketingPublication.findMany({ where: { status: 'scheduled', scheduledAt: { lte: now } }, orderBy: { scheduledAt: 'asc' }, take: limit, select: { id: true } })
  const claimed = await claim(due.map((d) => d.id))
  for (let i = 0; i < claimed.length; i += 5) await Promise.all(claimed.slice(i, i + 5).map((p) => runPublication(p)))
  const processed = await runProcessing(limit)
  return { ran: claimed.length, containersPublished: processed }
}
