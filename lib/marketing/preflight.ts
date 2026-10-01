/**
 * «Probar con Meta» without publishing: each Facebook / Instagram version of a post goes through
 * Meta's own checks. Instagram gets its container created (nothing is visible until media_publish and
 * the container expires in 24 h); Facebook gets the reel or story file uploaded without the publishing
 * step. Meta's answer (ready, still processing or its error) is what the publisher would meet later.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { describeGraphError, getConnectionCredentials, getConnectionMeta, requireMetaApp } from '@/lib/messaging/meta-channels'
import { deliveryUrl } from '@/lib/marketing/media'
import { readPublishOptions, resolveFormat } from '@/lib/marketing/publish-options'
import { containerStatus, createInstagramContainer, deleteFacebookObject, facebookVideoState, uploadFacebookPhotoOnly, uploadFacebookVideoOnly, warmMedia } from '@/lib/marketing/meta-publish'
import { CONNECTION_CHANNEL, infoOf, mediaFor, postInclude, validatePostForChannel } from '@/lib/marketing/publisher'
import type { MarketingChannel } from '@/lib/marketing/channel-rules'

const logger = createLogger('marketing-preflight')

export type PreflightResult = {
  channel: 'FACEBOOK' | 'INSTAGRAM'
  account: string
  format: string
  /** ok = Meta accepted it; pending = still processing when the wait ended (no error so far); skipped = nothing to test */
  status: 'ok' | 'pending' | 'failed' | 'skipped'
  detail: string
  checkedAt: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor(check: () => Promise<{ code: string; detail: string | null }>, maxMs: number) {
  const started = Date.now()
  let last: { code: string; detail: string | null } = { code: 'IN_PROGRESS', detail: null }
  while (Date.now() - started < maxMs) {
    last = await check().catch((err) => ({ code: 'IN_PROGRESS', detail: err instanceof Error ? err.message : null }))
    if (last.code === 'FINISHED' || last.code === 'ERROR' || last.code === 'EXPIRED') return last
    await sleep(5000)
  }
  return last
}

/**
 * Tests every social version of the post on every connected account of its channel (or only
 * `channels`). Waits up to `maxWaitMs` per file for Meta's processing. Stores the result in the
 * post's agentMeta.preflight so the editor, the agent and Haggo can read it.
 */
export async function preflightPost(postId: string, opts: { channels?: MarketingChannel[]; maxWaitMs?: number } = {}): Promise<PreflightResult[]> {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, include: postInclude })
  if (!post) throw new Error('Publicación no encontrada')
  const maxWait = opts.maxWaitMs ?? 90_000
  const results: PreflightResult[] = []
  const app = await requireMetaApp()
  const at = () => new Date().toISOString()
  for (const variant of post.variants) {
    const channel = variant.channel as MarketingChannel
    if (channel === 'WEB' || (opts.channels && !opts.channels.includes(channel))) continue
    const social = channel as 'FACEBOOK' | 'INSTAGRAM'
    const files = mediaFor(post, variant)
    const format = resolveFormat(social, variant.format, files.map(infoOf))
    const conns = await prisma.channelConnection.findMany({ where: { workspaceId: post.workspaceId, channel: CONNECTION_CHANNEL[social], enabled: true } })
    const { validation } = validatePostForChannel(post, channel)
    for (const conn of conns) {
      const base = { channel: social, account: conn.name, format, checkedAt: at() }
      if (validation && !validation.ok) { results.push({ ...base, status: 'failed', detail: validation.errors.map((e) => e.message).join(' · ') }); continue }
      const token = getConnectionCredentials(conn)?.pageAccessToken
      if (!token) { results.push({ ...base, status: 'failed', detail: 'Token no disponible: reconecta la cuenta' }); continue }
      const ctx = { app, token }
      const options = readPublishOptions(variant.publishOptions)
      const media = files.map((m) => ({ url: deliveryUrl(social, m.url, infoOf(m), format, options), kind: infoOf(m).kind, alt: m.alt }))
      try {
        await Promise.all(media.map((m) => warmMedia(m.url, m.kind)))
        if (social === 'INSTAGRAM') {
          const containerId = await createInstagramContainer(ctx, conn.externalId, { caption: format === 'story' ? '' : variant.body, format: format as 'feed' | 'carousel' | 'reel' | 'trial_reel' | 'story', media, options, aiGenerated: files.some((m) => m.source === 'ai') })
          const s = await waitFor(() => containerStatus(ctx, containerId), maxWait)
          results.push({ ...base, status: s.code === 'FINISHED' ? 'ok' : s.code === 'IN_PROGRESS' ? 'pending' : 'failed', detail: s.code === 'FINISHED' ? 'Instagram aceptó el archivo (no se publicó)' : s.code === 'IN_PROGRESS' ? 'Instagram sigue procesando el video; sin errores hasta ahora' : `Instagram lo rechazó: ${s.detail || s.code}` })
          continue
        }
        const pageId = getConnectionMeta(conn).pageId || conn.externalId
        const video = media.find((m) => m.kind === 'video')
        if (format === 'reel' || (format === 'story' && video)) {
          const videoId = await uploadFacebookVideoOnly(ctx, pageId, format === 'reel' ? 'video_reels' : 'video_stories', video!.url)
          const s = await waitFor(() => facebookVideoState(ctx, videoId), Math.min(maxWait, 30_000))
          results.push({ ...base, status: s.code === 'FINISHED' ? 'ok' : s.code === 'IN_PROGRESS' ? 'pending' : 'failed', detail: s.code === 'FINISHED' ? 'Facebook recibió el video completo y sin errores (no se publicó; lo procesa al publicar)' : s.code === 'IN_PROGRESS' ? 'Facebook sigue recibiendo el video; sin errores hasta ahora' : `Facebook lo rechazó: ${s.detail}` })
          // The test upload is not left in the Page's videos
          await deleteFacebookObject(ctx, videoId)
        } else if (format === 'story') {
          const photoId = await uploadFacebookPhotoOnly(ctx, pageId, media[0].url)
          await deleteFacebookObject(ctx, photoId)
          results.push({ ...base, status: 'ok', detail: 'Facebook aceptó la foto de la historia (no se publicó)' })
        } else {
          results.push({ ...base, status: 'skipped', detail: 'Las publicaciones normales de Facebook se validan al publicar' })
        }
      } catch (err) {
        logger.warn('Preflight failed', { postId, channel, conn: conn.id, err: describeGraphError(err) })
        results.push({ ...base, status: 'failed', detail: describeGraphError(err) })
      }
    }
  }
  const meta = (post.agentMeta as Record<string, unknown> | null) ?? {}
  await prisma.marketingPost.update({ where: { id: postId }, data: { agentMeta: { ...meta, preflight: results } } })
  return results
}
