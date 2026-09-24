import { graphFetch, MetaGraphError } from '@/lib/messaging/meta-graph'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'

/**
 * Publishing and insights on Facebook Pages and Instagram (Content Publishing API). Every call goes
 * through graphFetch, so errors arrive as MetaGraphError with code/subcode for classifyGraphError.
 */

export type PublishMedia = { url: string; kind: 'image' | 'video' }
export type PublishResult = { status: 'published'; externalId: string; permalink: string | null } | { status: 'processing'; containerId: string }

type Ctx = { app: MetaAppConfig; token: string }
const opts = (c: Ctx, extra: Record<string, unknown> = {}) => ({ version: c.app.graphVersion, token: c.token, ...extra })

async function fbPermalink(c: Ctx, id: string) {
  const d = await graphFetch<{ permalink_url?: string }>(id, opts(c, { query: { fields: 'permalink_url' } })).catch(() => null)
  const url = d?.permalink_url || null
  return url && url.startsWith('/') ? `https://www.facebook.com${url}` : url
}

// ─── Facebook Page ───────────────────────────────────────────────────────────

export async function publishToFacebook(c: Ctx, pageId: string, p: { message: string; link?: string | null; media: PublishMedia[] }): Promise<PublishResult> {
  const videos = p.media.filter((m) => m.kind === 'video')
  const images = p.media.filter((m) => m.kind === 'image')

  if (videos.length) {
    const res = await graphFetch<{ id: string }>(`${pageId}/videos`, opts(c, { method: 'POST', body: { file_url: videos[0].url, description: p.message }, timeoutMs: 60000 }))
    return { status: 'published', externalId: res.id, permalink: await fbPermalink(c, res.id) }
  }
  if (images.length === 1) {
    const res = await graphFetch<{ id: string; post_id?: string }>(`${pageId}/photos`, opts(c, { method: 'POST', body: { url: images[0].url, message: p.message, published: true }, timeoutMs: 60000 }))
    const id = res.post_id || res.id
    return { status: 'published', externalId: id, permalink: await fbPermalink(c, id) }
  }
  if (images.length > 1) {
    // Several photos: upload unpublished, then one feed post that attaches them all
    const ids: string[] = []
    for (const img of images) {
      const r = await graphFetch<{ id: string }>(`${pageId}/photos`, opts(c, { method: 'POST', body: { url: img.url, published: false }, timeoutMs: 60000 }))
      ids.push(r.id)
    }
    const res = await graphFetch<{ id: string }>(`${pageId}/feed`, opts(c, { method: 'POST', body: { message: p.message, attached_media: ids.map((id) => ({ media_fbid: id })) } }))
    return { status: 'published', externalId: res.id, permalink: await fbPermalink(c, res.id) }
  }
  const res = await graphFetch<{ id: string }>(`${pageId}/feed`, opts(c, { method: 'POST', body: { message: p.message, ...(p.link ? { link: p.link } : {}) } }))
  return { status: 'published', externalId: res.id, permalink: await fbPermalink(c, res.id) }
}

// ─── Instagram ───────────────────────────────────────────────────────────────

async function igPermalink(c: Ctx, mediaId: string) {
  const d = await graphFetch<{ permalink?: string }>(mediaId, opts(c, { query: { fields: 'permalink' } })).catch(() => null)
  return d?.permalink || null
}

async function igPublishContainer(c: Ctx, igId: string, containerId: string): Promise<PublishResult> {
  const res = await graphFetch<{ id: string }>(`${igId}/media_publish`, opts(c, { method: 'POST', body: { creation_id: containerId } }))
  return { status: 'published', externalId: res.id, permalink: await igPermalink(c, res.id) }
}

export async function containerStatus(c: Ctx, containerId: string) {
  const d = await graphFetch<{ status_code?: string; status?: string }>(containerId, opts(c, { query: { fields: 'status_code,status' } }))
  return { code: d.status_code || 'IN_PROGRESS', detail: d.status || null }
}

/**
 * Creates the container(s). Images are usually ready at once and are published in the same call;
 * videos (reels, carousels with video) stay "processing" and the worker publishes them later.
 */
export async function publishToInstagram(c: Ctx, igId: string, p: { caption: string; format: 'feed' | 'reel' | 'carousel'; media: PublishMedia[] }): Promise<PublishResult> {
  let containerId: string
  if (p.format === 'carousel') {
    const children: string[] = []
    for (const m of p.media) {
      const body = m.kind === 'video' ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true } : { image_url: m.url, is_carousel_item: true }
      children.push((await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body, timeoutMs: 60000 }))).id)
    }
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { media_type: 'CAROUSEL', children: children.join(','), caption: p.caption } }))).id
  } else if (p.format === 'reel') {
    const video = p.media.find((m) => m.kind === 'video')
    if (!video) throw new MetaGraphError('Un reel necesita un video', { status: 400 })
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { media_type: 'REELS', video_url: video.url, caption: p.caption, share_to_feed: true }, timeoutMs: 60000 }))).id
  } else {
    const image = p.media.find((m) => m.kind === 'image')
    if (!image) throw new MetaGraphError('La publicación necesita una imagen', { status: 400 })
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { image_url: image.url, caption: p.caption }, timeoutMs: 60000 }))).id
  }
  const hasVideo = p.media.some((m) => m.kind === 'video')
  if (hasVideo) return { status: 'processing', containerId }
  // Images: a short wait covers the usual case; otherwise the worker finishes it
  for (let i = 0; i < 3; i++) {
    const s = await containerStatus(c, containerId).catch(() => ({ code: 'IN_PROGRESS', detail: null }))
    if (s.code === 'FINISHED') return igPublishContainer(c, igId, containerId)
    if (s.code === 'ERROR' || s.code === 'EXPIRED') throw new MetaGraphError(`Instagram rechazó el archivo: ${s.detail || s.code}`, { status: 400 })
    await new Promise((r) => setTimeout(r, 2000))
  }
  return { status: 'processing', containerId }
}

/** Worker: a container created earlier → publish when ready. */
export async function finishInstagramContainer(c: Ctx, igId: string, containerId: string): Promise<PublishResult | { status: 'error'; detail: string }> {
  const s = await containerStatus(c, containerId)
  if (s.code === 'FINISHED') return igPublishContainer(c, igId, containerId)
  if (s.code === 'ERROR' || s.code === 'EXPIRED') return { status: 'error', detail: `Instagram no pudo procesar el archivo: ${s.detail || s.code}` }
  return { status: 'processing', containerId }
}

/** Remaining posts in Instagram's 24 h publishing quota (100 per account). */
export async function instagramQuota(c: Ctx, igId: string) {
  const d = await graphFetch<{ data?: Array<{ quota_usage?: number; config?: { quota_total?: number } }> }>(`${igId}/content_publishing_limit`, opts(c, { query: { fields: 'quota_usage,config' } })).catch(() => null)
  const row = d?.data?.[0]
  if (!row) return null
  return { used: row.quota_usage ?? 0, total: row.config?.quota_total ?? 100 }
}

// ─── Idempotency: what the account published recently ────────────────────────

export async function recentFacebookPosts(c: Ctx, pageId: string) {
  const d = await graphFetch<{ data?: Array<{ id: string; message?: string; created_time: string; permalink_url?: string }> }>(`${pageId}/published_posts`, opts(c, { query: { fields: 'id,message,created_time,permalink_url', limit: 15 } }))
  return (d.data || []).map((p) => ({ id: p.id, message: p.message ?? null, createdAt: new Date(p.created_time), permalink: p.permalink_url ?? null }))
}

export async function recentInstagramMedia(c: Ctx, igId: string) {
  const d = await graphFetch<{ data?: Array<{ id: string; caption?: string; timestamp: string; permalink?: string }> }>(`${igId}/media`, opts(c, { query: { fields: 'id,caption,timestamp,permalink', limit: 15 } }))
  return (d.data || []).map((p) => ({ id: p.id, message: p.caption ?? null, createdAt: new Date(p.timestamp), permalink: p.permalink ?? null }))
}

// ─── Insights ────────────────────────────────────────────────────────────────

export type Metrics = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; raw: Record<string, unknown> }

const empty = (): Metrics => ({ reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, videoViews: 0, raw: {} })

type InsightRow = { name: string; values?: Array<{ value: number | Record<string, number> }>; total_value?: { value: number } }
const valueOf = (row?: InsightRow) => {
  if (!row) return 0
  if (row.total_value) return Number(row.total_value.value) || 0
  const v = row.values?.[0]?.value
  return typeof v === 'number' ? v : v ? Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0) : 0
}

/** Meta renames insight metrics over time; the first set that the API accepts wins. */
async function firstInsights(c: Ctx, id: string, sets: string[], edge = 'insights') {
  for (const metric of sets) {
    try {
      const d = await graphFetch<{ data?: InsightRow[] }>(`${id}/${edge}`, opts(c, { query: { metric } }))
      return new Map((d.data || []).map((r) => [r.name, r]))
    } catch (err) {
      if (!(err instanceof MetaGraphError) || err.code !== 100) throw err
    }
  }
  return new Map<string, InsightRow>()
}

export async function facebookMetrics(c: Ctx, externalId: string, isVideo: boolean): Promise<Metrics> {
  const m = empty()
  if (isVideo) {
    const ins = await firstInsights(c, externalId, ['total_video_views,total_video_impressions_unique,total_video_impressions', 'total_video_views'], 'video_insights')
    m.videoViews = valueOf(ins.get('total_video_views'))
    m.reach = valueOf(ins.get('total_video_impressions_unique'))
    m.impressions = valueOf(ins.get('total_video_impressions'))
    m.raw.insights = Object.fromEntries(ins)
    return m
  }
  const post = await graphFetch<{ shares?: { count?: number }; comments?: { summary?: { total_count?: number } }; reactions?: { summary?: { total_count?: number } } }>(externalId, opts(c, {
    query: { fields: 'shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)' },
  }))
  m.shares = post.shares?.count ?? 0
  m.comments = post.comments?.summary?.total_count ?? 0
  m.likes = post.reactions?.summary?.total_count ?? 0
  const ins = await firstInsights(c, externalId, [
    'post_total_media_view_unique,post_media_view,post_clicks',
    'post_impressions_unique,post_impressions,post_clicks',
    'post_clicks',
  ]).catch(() => new Map<string, InsightRow>())
  m.reach = valueOf(ins.get('post_total_media_view_unique') || ins.get('post_impressions_unique'))
  m.impressions = valueOf(ins.get('post_media_view') || ins.get('post_impressions'))
  m.clicks = valueOf(ins.get('post_clicks'))
  m.raw = { post, insights: Object.fromEntries(ins) }
  return m
}

export async function instagramMetrics(c: Ctx, mediaId: string): Promise<Metrics> {
  const m = empty()
  const ins = await firstInsights(c, mediaId, [
    'reach,likes,comments,shares,saved,views',
    'reach,likes,comments,shares,saved,impressions',
    'reach,likes,comments,saved',
  ])
  m.reach = valueOf(ins.get('reach'))
  m.likes = valueOf(ins.get('likes'))
  m.comments = valueOf(ins.get('comments'))
  m.shares = valueOf(ins.get('shares'))
  m.saves = valueOf(ins.get('saved'))
  m.impressions = valueOf(ins.get('views') || ins.get('impressions'))
  m.videoViews = valueOf(ins.get('views'))
  m.raw = { insights: Object.fromEntries(ins) }
  return m
}

/**
 * Cloudinary creates each network's version of a file (size, format, logo) on its first request, and
 * the networks give up if it is not ready when they fetch it. Ask for it first and wait until it is
 * served as real media (videos may take a while to transcode).
 */
export async function warmMedia(url: string, kind: 'image' | 'video', maxWaitMs = kind === 'video' ? 90_000 : 30_000) {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < maxWaitMs) {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 25_000)
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-2047' }, cache: 'no-store', signal: c.signal })
      const type = res.headers.get('content-type') || ''
      await res.arrayBuffer().catch(() => null)
      if ((res.ok || res.status === 206) && (type.startsWith('image/') || type.startsWith('video/'))) return
      last = `${res.status} ${type}`
    } catch (err) {
      last = err instanceof Error ? err.message : 'error'
    } finally {
      clearTimeout(t)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new MetaGraphError(`El archivo no estuvo listo a tiempo para publicarlo (${last}); se reintenta`, { status: 503 })
}
