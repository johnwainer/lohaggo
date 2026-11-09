/**
 * Resource library of a workspace (see library-core). It has no table of its own: the files are the posts'
 * MarketingMedia rows plus the AI candidates nobody chose, which are recorded in AdminAuditLog
 * (action MARKETING_ASSET_CANDIDATE, entity = the post, details = url/publicId/prompt/style/orientation/
 * service); archiving a resource is another audit mark (MARKETING_ASSET_ARCHIVE, entity = the workspace).
 * Files stay in Cloudinary: reusing one never re-uploads it, and a copy records where it came from.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { brandedUrl, type Orientation } from '@/lib/marketing/images-core'
import { LIBRARY_SOURCE_PREFIX, videoPosterUrl } from '@/lib/marketing/media'
import { saveVariants } from '@/lib/marketing/service'
import { workspaceStats } from '@/lib/marketing/stats'
import { postResults } from '@/lib/marketing/post-results'
import {
  ARCHIVE_ACTION,
  CANDIDATE_ACTION,
  archivedKeys,
  assetKey,
  buildLibrary,
  libraryFacets,
  pickReusable,
  rankPieces,
  readCandidate,
  REEDITION_SUFFIX,
  reeditionTitle,
  serviceOfPost,
  type LibraryAsset,
  type PieceRow,
  type PostInfo,
  type PostResultView,
} from '@/lib/marketing/library-core'

const logger = createLogger('marketing-library')

export class LibraryError extends Error {}

const DAY = 24 * 3600_000
/** Results window: what a post did in the last year */
const RESULTS_DAYS = 365

/**
 * Every image the AI generated for a post, chosen or not: they were paid for, so they stay available in
 * the library. Never throws (generation already succeeded).
 */
export async function recordCandidates(p: {
  workspaceId: string; postId: string; prompt: string; style?: string | null; orientation: Orientation; service?: string | null; credit: string
  files: Array<{ url: string; publicId: string; width: number | null; height: number | null; bytes: number | null }>
}) {
  if (!p.files.length) return
  await prisma.adminAuditLog.createMany({
    data: p.files.map((f) => ({
      action: CANDIDATE_ACTION, entityType: 'MarketingPost', entityId: p.postId,
      // "ws" first and always present: candidates are listed by workspace with a text match on it
      details: JSON.stringify({ ws: p.workspaceId, url: f.url, publicId: f.publicId, width: f.width, height: f.height, bytes: f.bytes, prompt: p.prompt.slice(0, 1500), style: p.style?.slice(0, 300) ?? null, orientation: p.orientation, service: p.service ?? null, credit: p.credit }),
    })),
  }).catch((err) => logger.warn('Could not record AI candidates', { postId: p.postId, err: err instanceof Error ? err.message : err }))
}

type JsonObj = Record<string, unknown>
const objOf = (v: unknown): JsonObj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObj) : {})
const strOf = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

async function postResultsByPost(workspaceId: string, now: Date) {
  const stats = await workspaceStats({ workspaceIds: [workspaceId], from: new Date(now.getTime() - RESULTS_DAYS * DAY), to: now }).catch(() => null)
  return new Map<string, PostResultView & { channels: string[]; formats: Record<string, string>; publishedAt: Date | null }>(
    (stats?.posts ?? []).map((r) => [r.postId, { reach: r.totals.reach, webViews: r.totals.webViews, engagementRate: r.engagementRate, channels: r.channels, formats: r.formats as Record<string, string>, publishedAt: r.publishedAt }]),
  )
}

/** The whole library of a workspace (archived included, flagged), with the filters' facets. */
export async function loadLibrary(workspaceId: string, opts: { results?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date()
  const [media, candidateRows, marks, catalog] = await Promise.all([
    prisma.marketingMedia.findMany({
      where: { post: { workspaceId } },
      select: { id: true, postId: true, url: true, originalUrl: true, publicId: true, kind: true, source: true, alt: true, width: true, height: true, durationSec: true, credit: true, creditUrl: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    }),
    prisma.adminAuditLog.findMany({ where: { action: CANDIDATE_ACTION, details: { contains: `"ws":${JSON.stringify(workspaceId)}` } }, select: { id: true, entityId: true, createdAt: true, details: true }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    // The newest marks (the latest one per asset wins): read newest first, folded oldest to newest
    prisma.adminAuditLog.findMany({ where: { action: ARCHIVE_ACTION, entityType: 'Workspace', entityId: workspaceId }, select: { details: true }, orderBy: { createdAt: 'desc' }, take: 5000 }).then((r) => r.reverse()),
    prisma.service.findMany({ select: { name: true } }).then((s) => s.map((x) => x.name.trim()).filter(Boolean)).catch(() => [] as string[]),
  ])
  const candidates = candidateRows.map(readCandidate).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const postIds = Array.from(new Set([...media.map((m) => m.postId), ...candidates.map((c) => c.postId).filter((x): x is string => Boolean(x))]))
  const [rows, results] = await Promise.all([
    postIds.length ? prisma.marketingPost.findMany({ where: { workspaceId, id: { in: postIds } }, select: { id: true, title: true, status: true, pillar: true, publishedAt: true, createdAt: true, features: true, agentMeta: true } }) : [],
    opts.results === false ? new Map<string, PostResultView>() : postResultsByPost(workspaceId, now),
  ])
  const posts: PostInfo[] = rows.map((p) => {
    const f = objOf(p.features)
    const m = objOf(p.agentMeta)
    const r = results.get(p.id)
    return {
      id: p.id, title: p.title, status: p.status, pillar: p.pillar ?? strOf(f.pillar), publishedAt: p.publishedAt, createdAt: p.createdAt,
      service: serviceOfPost({ title: p.title, service: strOf(f.service) ?? strOf(m.service) }, catalog), style: strOf(m.imageStyle),
      result: r ? { reach: r.reach, webViews: r.webViews, engagementRate: r.engagementRate } : null,
    }
  })
  const assets = buildLibrary({ media, candidates, posts, archived: archivedKeys(marks) })
  return { assets, facets: libraryFacets(assets) }
}

export async function findAsset(workspaceId: string, key: string) {
  const { assets } = await loadLibrary(workspaceId, { results: false })
  return assets.find((a) => a.key === key) ?? null
}

export async function setArchived(p: { workspaceId: string; key: string; archived: boolean; actorId: string; actorEmail: string | null }) {
  const asset = await findAsset(p.workspaceId, p.key)
  if (!asset) throw new LibraryError('Recurso no encontrado en la biblioteca')
  // Already in that state: no new mark (repeated clicks must not fill the log)
  if (Boolean(asset.archived) === p.archived) return
  await prisma.adminAuditLog.create({ data: { action: ARCHIVE_ACTION, entityType: 'Workspace', entityId: p.workspaceId, actorId: p.actorId, actorEmail: p.actorEmail, details: JSON.stringify({ key: p.key, archived: p.archived }) } })
}

/**
 * A library file added to a post: the same Cloudinary file (nothing is re-uploaded), its alt text and
 * credit, and source «library-<origin>» so the AI label of Meta and the crops still apply.
 */
export async function addLibraryAsset(p: { workspaceId: string; postId: string; asset: LibraryAsset; brand: boolean; alt?: string | null }) {
  const a = p.asset
  if (a.archived) throw new LibraryError('Ese recurso está archivado')
  const existing = await prisma.marketingMedia.findMany({ where: { postId: p.postId }, select: { url: true, originalUrl: true, publicId: true } })
  if (existing.length >= 10) throw new LibraryError('Máximo 10 archivos por publicación')
  if (existing.some((m) => assetKey(m) === a.key)) throw new LibraryError('Ese recurso ya está en la publicación')
  const kit = a.kind === 'image' && p.brand ? await prisma.marketingBrandKit.findUnique({ where: { workspaceId: p.workspaceId } }) : null
  const branded = kit ? brandedUrl(a.url, kit) : null
  return prisma.marketingMedia.create({
    data: {
      postId: p.postId, url: branded || a.url, originalUrl: a.url, branded: Boolean(branded), publicId: a.publicId, kind: a.kind,
      mime: a.kind === 'video' ? 'video/mp4' : 'image/jpeg', width: a.width, height: a.height, durationSec: a.durationSec,
      alt: (p.alt?.trim() || a.alt)?.slice(0, 200) || null, position: existing.length, source: `${LIBRARY_SOURCE_PREFIX}${a.origin}`,
      credit: a.credit?.slice(0, 200) || null, creditUrl: a.creditUrl?.startsWith('https://') ? a.creditUrl.slice(0, 500) : null,
    },
  })
}

export type LibraryPick = { key: string; url: string; origin: string; candidate: boolean; lastUsedAt: string | null; fromPostId: string | null; fromTitle: string | null }

/**
 * The agent's reuse: images of the library for this piece (same service, right orientation, rested
 * `afterDays`), copied into the post. Returns what it took so the piece records it; [] when nothing fits.
 */
export async function reuseForPiece(p: { workspaceId: string; postId: string; service: string | null; orientation: Orientation; n: number; afterDays: number; brand: boolean; alt: string }) {
  if (!p.service) return []
  const { assets } = await loadLibrary(p.workspaceId)
  const picked = pickReusable(assets, { service: p.service, orientation: p.orientation, n: p.n, afterDays: p.afterDays, now: new Date(), excludePostId: p.postId })
  const out: LibraryPick[] = []
  for (const a of picked) {
    try {
      await addLibraryAsset({ workspaceId: p.workspaceId, postId: p.postId, asset: a, brand: p.brand, alt: a.alt || p.alt })
      out.push({ key: a.key, url: a.url, origin: a.origin, candidate: a.candidate && !a.uses, lastUsedAt: a.lastUsedAt, fromPostId: a.usedIn[0]?.postId ?? null, fromTitle: a.usedIn[0]?.title ?? null })
    } catch (err) {
      logger.warn('Library reuse failed for one asset', { postId: p.postId, key: a.key, err: err instanceof Error ? err.message : err })
    }
  }
  return out
}

/** Published pieces of the last year, best first, with what they brought. */
export async function topPieces(workspaceId: string, now = new Date()): Promise<PieceRow[]> {
  const results = await postResultsByPost(workspaceId, now)
  const ids = Array.from(results.keys())
  if (!ids.length) return []
  const [posts, credited, reeditions, catalog] = await Promise.all([
    prisma.marketingPost.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, title: true, features: true, agentMeta: true, media: { select: { url: true, kind: true }, orderBy: { position: 'asc' }, take: 1 } } }),
    postResults(ids, new Date(now.getTime() - RESULTS_DAYS * DAY)).catch(() => new Map()),
    prisma.marketingPost.findMany({ where: { workspaceId, title: { endsWith: REEDITION_SUFFIX } }, select: { agentMeta: true }, take: 2000 }).catch(() => []),
    prisma.service.findMany({ select: { name: true } }).then((s) => s.map((x) => x.name.trim()).filter(Boolean)).catch(() => [] as string[]),
  ])
  const reCount = new Map<string, number>()
  for (const r of reeditions) {
    const from = strOf(objOf(objOf(r.agentMeta).reusedFrom).postId)
    if (from) reCount.set(from, (reCount.get(from) ?? 0) + 1)
  }
  const rows = posts.map((p): PieceRow => {
    const r = results.get(p.id)!
    const c = credited.get(p.id)
    const m = p.media[0]
    return {
      postId: p.id, title: p.title, publishedAt: r.publishedAt?.toISOString() ?? null, channels: r.channels, formats: r.formats,
      thumb: m ? (m.kind === 'video' ? videoPosterUrl(m.url) : m.url) : null,
      reach: r.reach, webViews: r.webViews, engagementRate: r.engagementRate, requests: c?.requests ?? 0, bookings: c?.bookings ?? 0,
      service: serviceOfPost({ title: p.title, service: strOf(objOf(p.features).service) ?? strOf(objOf(p.agentMeta).service) }, catalog),
      reeditions: reCount.get(p.id) ?? 0,
    }
  })
  return rankPieces(rows).slice(0, 60)
}

/**
 * «Reutilizar» a piece that worked: a new draft with its texts and files (same Cloudinary files) for a
 * person or the agent to adapt. Tracking links name the new post, so results are credited to it. Never
 * scheduled or published here.
 */
export async function reeditPost(p: { workspaceId: string; postId: string; actorId: string }) {
  const src = await prisma.marketingPost.findFirst({ where: { id: p.postId, workspaceId: p.workspaceId }, include: { variants: true, media: { orderBy: { position: 'asc' } } } })
  if (!src) throw new LibraryError('Publicación no encontrada')
  const features = objOf(src.features)
  const post = await prisma.marketingPost.create({
    data: {
      workspaceId: src.workspaceId, campaignId: src.campaignId, title: reeditionTitle(src.title), brief: src.brief, createdById: p.actorId, origin: 'human', pillar: src.pillar, status: 'draft',
      ...(src.features ? { features: { ...features, weekday: null, hour: null } as Prisma.InputJsonValue } : {}),
      agentMeta: { reusedFrom: { postId: src.id, title: src.title, at: new Date().toISOString() }, service: strOf(features.service) ?? strOf(objOf(src.agentMeta).service), imageSource: 'library' } as Prisma.InputJsonValue,
    },
  })
  const ids = new Map<string, string>()
  for (const m of src.media) {
    const { id, postId: _p, createdAt: _c, ...rest } = m
    void _p; void _c
    const copy = await prisma.marketingMedia.create({ data: { ...rest, postId: post.id } })
    ids.set(id, copy.id)
  }
  const swap = (s: string | null) => (s ? s.split(src.id).join(post.id) : s)
  await saveVariants(post.id, src.variants.map((v) => ({
    channel: v.channel,
    body: swap(v.body) ?? '',
    format: v.format,
    publishOptions: v.publishOptions == null ? null : (JSON.parse(swap(JSON.stringify(v.publishOptions))!) as Prisma.InputJsonValue),
    linkUrl: swap(v.linkUrl),
    mediaIds: v.mediaIds.map((x) => ids.get(x)).filter((x): x is string => Boolean(x)),
    ...(v.channel === 'WEB' ? { slug: v.slug, seoTitle: v.seoTitle, seoDescription: v.seoDescription, excerpt: v.excerpt, coverUrl: v.coverUrl, category: v.category, tags: v.tags, noindex: v.noindex } : {}),
    aiGenerated: v.aiGenerated,
  })))
  return post
}
