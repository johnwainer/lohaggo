import { graphFetch, MetaGraphError } from '@/lib/messaging/meta-graph'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'
import type { PublishOptions } from '@/lib/marketing/publish-options'

/**
 * Publishing and insights on Facebook Pages and Instagram (Content Publishing API). Every call goes
 * through graphFetch, so errors arrive as MetaGraphError with code/subcode for classifyGraphError.
 */

export type PublishMedia = { url: string; kind: 'image' | 'video'; alt?: string | null }
export type PublishResult = { status: 'published'; externalId: string; permalink: string | null } | { status: 'processing'; containerId: string }

type Ctx = { app: MetaAppConfig; token: string }
const opts = (c: Ctx, extra: Record<string, unknown> = {}) => ({ version: c.app.graphVersion, token: c.token, ...extra })

async function fbPermalink(c: Ctx, id: string) {
  const d = await graphFetch<{ permalink_url?: string }>(id, opts(c, { query: { fields: 'permalink_url' } })).catch(() => null)
  const url = d?.permalink_url || null
  return url && url.startsWith('/') ? `https://www.facebook.com${url}` : url
}

// ─── Facebook Page ───────────────────────────────────────────────────────────

/** Facebook: a regular post (text, link, photos, video), a reel or a story. Reels finish in the worker. */
export async function publishToFacebook(c: Ctx, pageId: string, p: { message: string; link?: string | null; media: PublishMedia[]; format?: 'post' | 'reel' | 'story'; options?: PublishOptions; aiGenerated?: boolean }): Promise<PublishResult> {
  if (p.format === 'reel') return startFacebookReel(c, pageId, p)
  if (p.format === 'story') return publishFacebookStory(c, pageId, p)
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

/** Marks a Facebook reel's video id in containerId so the worker knows how to finish it. */
export const FB_REEL_PREFIX = 'fb-reel:'

/**
 * Hosted file → Meta (rupload). Meta fetches the URL itself; the host must let facebookexternalhit in
 * (Cloudinary does).
 */
async function ruploadHosted(c: Ctx, uploadUrl: string, fileUrl: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `OAuth ${c.token}`, file_url: fileUrl }, signal: controller.signal, cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; debug_info?: { message?: string; retriable?: boolean }; error?: { message?: string; code?: number } }
    if (!res.ok || data.success === false || data.error) {
      throw new MetaGraphError(`Meta no pudo subir el video: ${data.debug_info?.message || data.error?.message || res.status}`, { status: data.debug_info?.retriable === false ? 400 : res.status || 503, code: data.error?.code })
    }
  } catch (err) {
    if (err instanceof MetaGraphError) throw err
    throw new MetaGraphError(err instanceof Error ? err.message : 'Error de red al subir el video', { status: 0 })
  } finally {
    clearTimeout(timer)
  }
}

async function startVideoSession(c: Ctx, pageId: string, edge: 'video_reels' | 'video_stories') {
  const s = await graphFetch<{ video_id: string; upload_url: string }>(`${pageId}/${edge}`, opts(c, { method: 'POST', body: { upload_phase: 'start' } }))
  if (!s.video_id || !s.upload_url) throw new MetaGraphError('Meta no abrió la sesión de subida del video', { status: 503 })
  return s
}

/** Reel: start → upload → finish with PUBLISHED. Meta publishes after processing; the worker follows it. */
async function startFacebookReel(c: Ctx, pageId: string, p: { message: string; media: PublishMedia[]; options?: PublishOptions }): Promise<PublishResult> {
  const video = p.media.find((m) => m.kind === 'video')
  if (!video) throw new MetaGraphError('Un reel necesita un video', { status: 400 })
  const session = await startVideoSession(c, pageId, 'video_reels')
  await ruploadHosted(c, session.upload_url, video.url)
  await graphFetch(`${pageId}/video_reels`, opts(c, {
    method: 'POST',
    body: {
      video_id: session.video_id, upload_phase: 'finish', video_state: 'PUBLISHED', description: p.message,
      ...(p.options?.locationId ? { place: p.options.locationId } : {}),
    },
    timeoutMs: 60000,
  }))
  return { status: 'processing', containerId: `${FB_REEL_PREFIX}${session.video_id}` }
}

/** Preflight: upload a reel or video story's file without publishing it; Meta's processing tells if it is accepted. */
export async function uploadFacebookVideoOnly(c: Ctx, pageId: string, edge: 'video_reels' | 'video_stories', fileUrl: string) {
  const session = await startVideoSession(c, pageId, edge)
  await ruploadHosted(c, session.upload_url, fileUrl)
  return session.video_id
}

/** Preflight: a photo uploaded unpublished (what a photo story starts with). */
export async function uploadFacebookPhotoOnly(c: Ctx, pageId: string, url: string) {
  return (await graphFetch<{ id: string }>(`${pageId}/photos`, opts(c, { method: 'POST', body: { url, published: false }, timeoutMs: 60000 }))).id
}

/** Processing state of an uploaded Facebook video: ready, still processing, or Meta's error. */
export async function facebookVideoState(c: Ctx, videoId: string) {
  type Phase = { status?: string; error?: { message?: string } }
  const d = await graphFetch<{ status?: { video_status?: string; uploading_phase?: Phase; processing_phase?: Phase } }>(videoId, opts(c, { query: { fields: 'status' } }))
  const st = d.status || {}
  const error = st.uploading_phase?.error?.message || st.processing_phase?.error?.message || (st.video_status === 'error' ? 'Meta no pudo procesar el video' : null)
  if (error) return { code: 'ERROR' as const, detail: error }
  if (st.video_status === 'ready' || st.processing_phase?.status === 'complete') return { code: 'FINISHED' as const, detail: null }
  return { code: 'IN_PROGRESS' as const, detail: st.video_status ?? null }
}

/** Worker: a Facebook reel uploaded earlier → published, still processing, or failed. */
export async function finishFacebookReel(c: Ctx, videoId: string): Promise<PublishResult | { status: 'error'; detail: string }> {
  type Phase = { status?: string; error?: { message?: string } }
  const d = await graphFetch<{ status?: { video_status?: string; processing_phase?: Phase; publishing_phase?: Phase & { publish_status?: string } }; permalink_url?: string }>(videoId, opts(c, { query: { fields: 'status,permalink_url' } }))
  const st = d.status || {}
  const failed = st.processing_phase?.error?.message || st.publishing_phase?.error?.message || (st.video_status === 'error' ? 'Meta no pudo procesar el video' : null)
  if (failed) return { status: 'error', detail: `Facebook rechazó el reel: ${failed}` }
  if (st.publishing_phase?.publish_status === 'published' || st.publishing_phase?.status === 'complete') {
    const url = d.permalink_url ? (d.permalink_url.startsWith('/') ? `https://www.facebook.com${d.permalink_url}` : d.permalink_url) : null
    return { status: 'published', externalId: videoId, permalink: url }
  }
  return { status: 'processing', containerId: `${FB_REEL_PREFIX}${videoId}` }
}

/** Story: a photo uploaded unpublished then shared as story, or a video through its upload session. */
async function publishFacebookStory(c: Ctx, pageId: string, p: { media: PublishMedia[]; aiGenerated?: boolean }): Promise<PublishResult> {
  const item = p.media[0]
  if (!item) throw new MetaGraphError('Una historia necesita una foto o un video', { status: 400 })
  let postId: string
  if (item.kind === 'video') {
    const session = await startVideoSession(c, pageId, 'video_stories')
    await ruploadHosted(c, session.upload_url, item.url)
    const r = await graphFetch<{ post_id?: string | number }>(`${pageId}/video_stories`, opts(c, { method: 'POST', body: { video_id: session.video_id, upload_phase: 'finish', ...(p.aiGenerated ? { is_ai_generated: true } : {}) }, timeoutMs: 60000 }))
    postId = String(r.post_id ?? session.video_id)
  } else {
    const photo = await graphFetch<{ id: string }>(`${pageId}/photos`, opts(c, { method: 'POST', body: { url: item.url, published: false }, timeoutMs: 60000 }))
    const r = await graphFetch<{ post_id?: string | number }>(`${pageId}/photo_stories`, opts(c, { method: 'POST', body: { photo_id: photo.id } }))
    postId = String(r.post_id ?? photo.id)
  }
  const stories = await recentFacebookStories(c, pageId).catch(() => [])
  return { status: 'published', externalId: postId, permalink: stories.find((x) => x.id === postId)?.permalink ?? null }
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

type IgFormatArg = 'feed' | 'reel' | 'carousel' | 'trial_reel' | 'story'

/** Extra fields Meta accepts per container type (alt text, collaborators, location, cover, trial, AI label). */
export function igContainerExtras(format: IgFormatArg, o: PublishOptions = {}, aiGenerated = false) {
  const x: Record<string, unknown> = {}
  if (format !== 'story' && o.collaborators?.length) x.collaborators = o.collaborators
  if (format !== 'story' && o.locationId) x.location_id = o.locationId
  if (format === 'reel' || format === 'trial_reel') {
    if (o.coverUrl) x.cover_url = o.coverUrl
    else if (o.thumbOffsetMs != null) x.thumb_offset = o.thumbOffsetMs
  }
  if (format === 'reel') x.share_to_feed = o.shareToFeed ?? true
  if (format === 'trial_reel') x.trial_params = { graduation_strategy: o.trialGraduation ?? 'MANUAL' }
  if (o.aiLabel ?? aiGenerated) x.is_ai_generated = true
  return x
}

/**
 * Creates the container(s). Images are usually ready at once and are published in the same call;
 * videos (reels, stories and carousels with video) stay "processing" and the worker publishes them later.
 */
type IgPayload = { caption: string; format: IgFormatArg; media: PublishMedia[]; options?: PublishOptions; aiGenerated?: boolean }

/** The container Meta checks and processes; nothing is visible until media_publish. Expires in 24 h. */
export async function createInstagramContainer(c: Ctx, igId: string, p: IgPayload): Promise<string> {
  const extras = igContainerExtras(p.format, p.options, p.aiGenerated)
  let containerId: string
  if (p.format === 'carousel') {
    const children: string[] = []
    for (const m of p.media) {
      const body = m.kind === 'video' ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true } : { image_url: m.url, is_carousel_item: true, ...(m.alt ? { alt_text: m.alt } : {}) }
      children.push((await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body, timeoutMs: 60000 }))).id)
    }
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { media_type: 'CAROUSEL', children: children.join(','), caption: p.caption, ...extras } }))).id
  } else if (p.format === 'reel' || p.format === 'trial_reel') {
    const video = p.media.find((m) => m.kind === 'video')
    if (!video) throw new MetaGraphError('Un reel necesita un video', { status: 400 })
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { media_type: 'REELS', video_url: video.url, caption: p.caption, ...extras }, timeoutMs: 60000 }))).id
  } else if (p.format === 'story') {
    const item = p.media[0]
    if (!item) throw new MetaGraphError('Una historia necesita una foto o un video', { status: 400 })
    const media = item.kind === 'video' ? { video_url: item.url } : { image_url: item.url }
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { media_type: 'STORIES', ...media, ...extras }, timeoutMs: 60000 }))).id
  } else {
    const image = p.media.find((m) => m.kind === 'image')
    if (!image) throw new MetaGraphError('La publicación necesita una imagen', { status: 400 })
    containerId = (await graphFetch<{ id: string }>(`${igId}/media`, opts(c, { method: 'POST', body: { image_url: image.url, caption: p.caption, ...(image.alt ? { alt_text: image.alt } : {}), ...extras }, timeoutMs: 60000 }))).id
  }
  return containerId
}

export async function publishToInstagram(c: Ctx, igId: string, p: IgPayload): Promise<PublishResult> {
  const containerId = await createInstagramContainer(c, igId, p)
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

/** Stories visible now (Instagram lists only the last 24 h): for the retry check, stories carry no caption. */
export async function recentInstagramStories(c: Ctx, igId: string) {
  const d = await graphFetch<{ data?: Array<{ id: string; timestamp: string; permalink?: string }> }>(`${igId}/stories`, opts(c, { query: { fields: 'id,timestamp,permalink', limit: 25 } }))
  return (d.data || []).map((p) => ({ id: p.id, message: null as string | null, createdAt: new Date(p.timestamp), permalink: p.permalink ?? null }))
}

export async function recentFacebookStories(c: Ctx, pageId: string) {
  const d = await graphFetch<{ data?: Array<{ post_id: string; creation_time: string | number; url?: string }> }>(`${pageId}/stories`, opts(c, { query: { limit: 25 } }))
  return (d.data || []).map((p) => ({ id: String(p.post_id), message: null as string | null, createdAt: new Date(Number(p.creation_time) * 1000), permalink: p.url ?? null }))
}

export async function recentFacebookReels(c: Ctx, pageId: string) {
  const d = await graphFetch<{ data?: Array<{ id: string; description?: string; updated_time: string | number }> }>(`${pageId}/video_reels`, opts(c, { query: { fields: 'id,description,updated_time', limit: 15 } }))
  const at = (v: string | number) => new Date(typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) * 1000 : String(v))
  return (d.data || []).map((p) => ({ id: p.id, message: p.description ?? null, createdAt: at(p.updated_time), permalink: null as string | null }))
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
async function firstInsights(c: Ctx, id: string, sets: string[], edge = 'insights', period?: 'lifetime') {
  for (const metric of sets) {
    try {
      const d = await graphFetch<{ data?: InsightRow[] }>(`${id}/${edge}`, opts(c, { query: period ? { metric, period } : { metric } }))
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
  // Lifetime: without it Meta answers post_total_media_view_unique per day for the last two days (reach read as 0)
  const ins = await firstInsights(c, externalId, [
    'post_total_media_view_unique,post_media_view,post_clicks',
    'post_impressions_unique,post_impressions,post_clicks',
    'post_clicks',
  ], 'insights', 'lifetime').catch(() => new Map<string, InsightRow>())
  m.reach = valueOf(ins.get('post_total_media_view_unique') || ins.get('post_impressions_unique'))
  m.impressions = valueOf(ins.get('post_media_view') || ins.get('post_impressions'))
  m.clicks = valueOf(ins.get('post_clicks'))
  m.raw = { post, insights: Object.fromEntries(ins) }
  return m
}

/** Instagram: post, reel (watch time) or story (replies, taps; only readable for 24 h). */
export async function instagramMetrics(c: Ctx, mediaId: string, kind: 'post' | 'reel' | 'story' = 'post'): Promise<Metrics> {
  const m = empty()
  const sets = kind === 'story'
    ? ['reach,views,replies,shares,navigation,follows,profile_visits,total_interactions', 'reach,views,replies,navigation', 'reach,replies']
    : kind === 'reel'
      ? ['reach,likes,comments,shares,saved,views,ig_reels_avg_watch_time,ig_reels_video_view_total_time', 'reach,likes,comments,shares,saved,views']
      : ['reach,likes,comments,shares,saved,views', 'reach,likes,comments,shares,saved,impressions', 'reach,likes,comments,saved']
  const ins = await firstInsights(c, mediaId, sets)
  m.reach = valueOf(ins.get('reach'))
  m.likes = valueOf(ins.get('likes'))
  // A story's replies are its conversations
  m.comments = valueOf(ins.get('comments') || ins.get('replies'))
  m.shares = valueOf(ins.get('shares'))
  m.saves = valueOf(ins.get('saved'))
  m.impressions = valueOf(ins.get('views') || ins.get('impressions'))
  m.videoViews = valueOf(ins.get('views'))
  m.clicks = valueOf(ins.get('profile_visits'))
  m.raw = { kind, insights: Object.fromEntries(ins) }
  return m
}

/** Facebook reel: plays, reach and average watch time (video_insights of the reel's video). */
export async function facebookReelMetrics(c: Ctx, videoId: string): Promise<Metrics> {
  const m = empty()
  const ins = await firstInsights(c, videoId, [
    'blue_reels_play_count,post_impressions_unique,post_video_avg_time_watched,post_video_social_actions',
    'blue_reels_play_count,post_impressions_unique',
    'total_video_views,total_video_impressions_unique',
  ], 'video_insights')
  m.videoViews = valueOf(ins.get('blue_reels_play_count') || ins.get('total_video_views'))
  m.impressions = m.videoViews
  m.reach = valueOf(ins.get('post_impressions_unique') || ins.get('total_video_impressions_unique'))
  m.raw = { kind: 'reel', insights: Object.fromEntries(ins) }
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
