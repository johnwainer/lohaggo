/**
 * New AI images, with real colors, for the pieces not published yet whose AI image came out with the old
 * amber, sepia-like cast (generated before SEPIA_FIX_BEFORE_VERSION). Each file is replaced in place: the
 * same MarketingMedia row (so every version, schedule and review keeps pointing at it), the logo again if it
 * had one, and the reel made from that photo follows it. The old file stays in the resource library.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { generateImages, getBrandKit } from '@/lib/marketing/images'
import { brandedUrl, servicePrompt } from '@/lib/marketing/images-core'
import { SEPIA_FIX_BEFORE_VERSION, isAiSource, needsColorFix } from '@/lib/marketing/media'
import { CANDIDATE_ACTION } from '@/lib/marketing/library-core'
import { readAgentConfig } from '@/lib/marketing/agent-input'
import { defaultImageStyleConfig, resolveStyle } from '@/lib/marketing/image-styles'

const logger = createLogger('marketing-recolor')

/** Pieces whose images can still change: not publishing nor published. */
const OPEN_STATUSES = ['draft', 'review', 'approved', 'scheduled']

type Pending = { mediaId: string; postId: string; title: string; status: string; url: string }

/** The AI images of unpublished pieces that still have the old cast. */
export async function sepiaImagesPending(workspaceId?: string): Promise<Pending[]> {
  const rows = await prisma.marketingMedia.findMany({
    where: { kind: 'image', post: { status: { in: OPEN_STATUSES }, ...(workspaceId ? { workspaceId } : {}) } },
    select: { id: true, url: true, originalUrl: true, source: true, kind: true, postId: true, post: { select: { title: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows
    .filter((m) => isAiSource(m.source) && needsColorFix(m.originalUrl || m.url, { kind: 'image', source: m.source }))
    .map((m) => ({ mediaId: m.id, postId: m.postId, title: m.post.title, status: m.post.status, url: m.originalUrl || m.url }))
}

/** The prompt an image was made with (kept by the library since 2026-11-09), else its description and the service. */
async function promptFor(publicId: string | null, alt: string | null, service: string | null, title: string) {
  if (publicId) {
    const c = await prisma.adminAuditLog.findFirst({ where: { action: CANDIDATE_ACTION, details: { contains: publicId } }, select: { details: true } })
    try {
      const p = (JSON.parse(c?.details ?? '{}') as { prompt?: unknown }).prompt
      if (typeof p === 'string' && p.trim().length >= 10) return p
    } catch {
      // the description is used instead
    }
  }
  return [alt || title, servicePrompt(service || title)].filter(Boolean).join('. ').slice(0, 1500)
}

/**
 * Regenerates up to `limit` images within `budgetMs`. dryRun only lists them. Returns what changed and how
 * many are left (call again until none).
 */
export async function recolorSepiaImages(opts: { workspaceId?: string; dryRun?: boolean; limit?: number; budgetMs?: number } = {}) {
  const pending = await sepiaImagesPending(opts.workspaceId)
  if (opts.dryRun !== false) return { dryRun: true, pending: pending.length, pieces: Array.from(new Set(pending.map((p) => p.postId))).length, items: pending.slice(0, 60) }

  const deadline = Date.now() + (opts.budgetMs ?? 200_000)
  const done: Array<{ postId: string; title: string; mediaId: string; url: string }> = []
  const failed: Array<{ postId: string; title: string; error: string }> = []
  for (const p of pending.slice(0, opts.limit ?? 4)) {
    if (Date.now() > deadline) break
    try {
      const m = await prisma.marketingMedia.findUnique({ where: { id: p.mediaId } })
      const post = await prisma.marketingPost.findUnique({ where: { id: p.postId }, select: { id: true, title: true, status: true, workspaceId: true, features: true, agentMeta: true, agent: { select: { config: true } } } })
      if (!m || !post || !OPEN_STATUSES.includes(post.status)) continue
      const features = (post.features ?? {}) as { service?: unknown }
      const meta = (post.agentMeta ?? {}) as Record<string, unknown>
      const service = typeof features.service === 'string' ? features.service : typeof meta.service === 'string' ? meta.service : null
      const styles = post.agent ? readAgentConfig(post.agent.config).images.styles ?? defaultImageStyleConfig() : null
      const style = styles ? resolveStyle(styles, typeof meta.imageStyle === 'string' ? meta.imageStyle : null) : null
      const orientation = m.width && m.height ? (m.height > m.width ? 'portrait' as const : m.width > m.height ? 'landscape' as const : 'square' as const) : 'portrait' as const
      const prompt = await promptFor(m.publicId, m.alt, service, post.title)
      const [img] = await generateImages({ workspaceId: post.workspaceId, postId: post.id, prompt, style: style?.prompt ?? null, orientation, n: 1, service })
      if (!img) throw new Error('La IA no devolvió la imagen')
      const oldOriginal = m.originalUrl || m.url
      const kit = m.branded ? await getBrandKit(post.workspaceId) : null
      const branded = kit ? brandedUrl(img.fullUrl, kit) : null
      await prisma.$transaction([
        prisma.marketingMedia.update({
          where: { id: m.id },
          data: { url: branded || img.fullUrl, originalUrl: img.fullUrl, branded: Boolean(branded), publicId: img.publicId ?? null, width: img.width, height: img.height, bytes: img.bytes ?? null, source: 'ai', mime: 'image/png' },
        }),
        // The reel made from this photo is the same file animated: it follows the new one
        prisma.marketingMedia.updateMany({ where: { postId: post.id, kind: 'video', OR: [{ url: oldOriginal }, { originalUrl: oldOriginal }] }, data: { url: img.fullUrl, originalUrl: img.fullUrl } }),
        // The pre-test with Meta was about the old files
        prisma.marketingPost.update({ where: { id: post.id }, data: { agentMeta: { ...meta, preflight: undefined, recoloredAt: new Date().toISOString(), imageSource: 'ai', imageError: null } as object } }),
      ])
      done.push({ postId: post.id, title: post.title, mediaId: m.id, url: img.fullUrl })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'error'
      logger.warn('Recolor failed', { postId: p.postId, mediaId: p.mediaId, err: error })
      failed.push({ postId: p.postId, title: p.title, error: error.slice(0, 200) })
    }
  }
  const left = (await sepiaImagesPending(opts.workspaceId)).length
  return { dryRun: false, replaced: done.length, failed, left, items: done, cutoffVersion: SEPIA_FIX_BEFORE_VERSION }
}
