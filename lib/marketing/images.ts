import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'
import { cloudinaryService } from '@/lib/cloudinary'
import { logFixedCostCall } from '@/lib/ai/calls'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { getAiSettings } from '@/lib/ai/settings'
import { isCloudinaryUrl } from '@/lib/marketing/media'
import { mediaFolder } from '@/lib/marketing/service'
import {
  IMAGE_PROVIDERS,
  aspectFor,
  brandedUrl,
  finalPrompt,
  fromPexels,
  type ImageCandidate,
  type ImageProvider,
  type Orientation,
  type PexelsPhoto,
  matchServices,
} from '@/lib/marketing/images-core'

const logger = createLogger('marketing-images')

/** Generation requests per workspace per 24 h, whatever the monthly AI cap says. */
export const DAILY_GENERATIONS = 25

export class ImageError extends Error {}

type Keys = { pexels?: string; gemini?: string; openai?: string; cloudflare?: string }
export type ImageSettings = {
  keys: Keys
  provider: ImageProvider
  models: Partial<Record<ImageProvider, string>>
  cloudflareAccountId: string | null
  costPerImageUsd: number
  /** The text-AI OpenAI key (IA · Plataforma): image backup when there is no OpenAI key for images */
  textOpenaiKey: string | null
}

let cache: { at: number; value: ImageSettings } | null = null

export async function getImageSettings(force = false): Promise<ImageSettings> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.value
  const row = await prisma.marketingImageSettings.upsert({ where: { id: 'platform' }, create: { id: 'platform' }, update: {} })
  let keys: Keys = {}
  try { keys = row.keysEncrypted ? decryptConfig<Keys>(row.keysEncrypted) : {} } catch { keys = {} }
  const value: ImageSettings = {
    keys,
    provider: (row.provider in IMAGE_PROVIDERS ? row.provider : 'none') as ImageProvider,
    models: (row.models as Partial<Record<ImageProvider, string>> | null) || {},
    cloudflareAccountId: row.cloudflareAccountId,
    costPerImageUsd: row.costPerImageUsd,
    textOpenaiKey: (await getAiSettings().catch(() => null))?.openaiKey ?? null,
  }
  cache = { at: Date.now(), value }
  return value
}

/** undefined = keep, '' / null = remove. */
export async function saveImageSettings(input: { keys?: Partial<Record<keyof Keys, string | null>>; provider?: ImageProvider; models?: Partial<Record<ImageProvider, string>>; cloudflareAccountId?: string | null; costPerImageUsd?: number; updatedByEmail: string }) {
  const current = await getImageSettings(true)
  const keys: Keys = { ...current.keys }
  for (const [k, v] of Object.entries(input.keys || {}) as Array<[keyof Keys, string | null]>) {
    if (v === undefined) continue
    if (v) keys[k] = v.trim()
    else delete keys[k]
  }
  await prisma.marketingImageSettings.upsert({
    where: { id: 'platform' },
    create: { id: 'platform' },
    update: {},
  })
  await prisma.marketingImageSettings.update({
    where: { id: 'platform' },
    data: {
      keysEncrypted: Object.keys(keys).length ? encryptConfig(keys) : null,
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.models ? { models: { ...current.models, ...input.models } } : {}),
      ...(input.cloudflareAccountId !== undefined ? { cloudflareAccountId: input.cloudflareAccountId || null } : {}),
      ...(input.costPerImageUsd !== undefined ? { costPerImageUsd: input.costPerImageUsd } : {}),
      updatedByEmail: input.updatedByEmail,
    },
  })
  cache = null
}

type GenProvider = Exclude<ImageProvider, 'none'>
const GEN_PROVIDERS: GenProvider[] = ['openai', 'gemini', 'cloudflare']

function keyFor(s: ImageSettings, p: GenProvider) {
  return (p === 'openai' ? s.keys.openai || s.textOpenaiKey : s.keys[p]) || null
}

/**
 * The providers to try, in order: the chosen one first, then every other one with a key. "Ninguno"
 * means no AI images at all, so nothing is tried.
 */
export function imageChain(s: ImageSettings): Array<{ provider: GenProvider; key: string }> {
  if (s.provider === 'none') return []
  const order = [s.provider, ...GEN_PROVIDERS.filter((p) => p !== s.provider)]
  return order.flatMap((p) => {
    const key = keyFor(s, p)
    return key && (p !== 'cloudflare' || s.cloudflareAccountId) ? [{ provider: p, key }] : []
  })
}

export function providerReady(s: ImageSettings) {
  if (s.provider === 'none') return { ready: false, reason: 'No hay un proveedor de IA de imágenes configurado' }
  if (imageChain(s).length) return { ready: true, reason: null }
  if (!s.keys[s.provider]) return { ready: false, reason: `Falta la clave de ${IMAGE_PROVIDERS[s.provider].label}` }
  if (s.provider === 'cloudflare' && !s.cloudflareAccountId) return { ready: false, reason: 'Falta el Account ID de Cloudflare' }
  return { ready: false, reason: 'Ningún proveedor de imágenes tiene clave' }
}

// ─── Pexels ──────────────────────────────────────────────────────────────────

export async function searchPexels(query: string, orientation: Orientation, page = 1, perPage = 15, keyOverride?: string) {
  const key = keyOverride || (await getImageSettings()).keys.pexels
  if (!key) throw new ImageError('Falta la clave de Pexels (Publicaciones → Marca e imágenes)')
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', query.slice(0, 200))
  url.searchParams.set('orientation', orientation)
  url.searchParams.set('per_page', String(Math.min(40, Math.max(1, perPage))))
  url.searchParams.set('page', String(Math.max(1, page)))
  url.searchParams.set('locale', 'es-ES')
  const res = await fetch(url, { headers: { Authorization: key }, cache: 'no-store' })
  if (res.status === 401 || res.status === 403) throw new ImageError('Pexels rechazó la clave')
  if (res.status === 429) throw new ImageError('Se alcanzó el límite de búsquedas de Pexels por ahora; intenta en un rato')
  if (!res.ok) throw new ImageError(`Pexels respondió ${res.status}`)
  const data = (await res.json()) as { photos?: PexelsPhoto[]; total_results?: number }
  // Thumbnails are served through our server (Pexels' CDN refuses to be embedded from another site)
  const results = (data.photos || []).map(fromPexels).map((c) => ({ ...c, previewUrl: `/api/admin/marketing/images/preview?url=${encodeURIComponent(c.previewUrl)}` }))
  return { results, total: data.total_results ?? 0 }
}

// ─── AI generation ───────────────────────────────────────────────────────────

type Generated = { dataUri: string }

async function fetchReference(url: string) {
  const cloud = cloudinaryService.cloudName()
  if (!isCloudinaryUrl(url) || !cloud || !url.startsWith(`https://res.cloudinary.com/${cloud}/`)) throw new ImageError('La imagen de referencia debe ser una de la publicación')
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new ImageError('No se pudo leer la imagen de referencia')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 8 * 1024 * 1024) throw new ImageError('La imagen de referencia pesa más de 8 MB')
  return { base64: buf.toString('base64'), mime: res.headers.get('content-type') || 'image/jpeg', buf }
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 90_000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await p(c.signal) } finally { clearTimeout(t) }
}

async function gemini(key: string, model: string, prompt: string, o: Orientation, ref: Awaited<ReturnType<typeof fetchReference>> | null): Promise<Generated> {
  const call = (withAspect: boolean) => withTimeout((signal) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...(ref ? [{ inlineData: { mimeType: ref.mime, data: ref.base64 } }] : []), { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], ...(withAspect ? { imageConfig: { aspectRatio: aspectFor(o).ratio } } : {}) },
    }),
  }))
  let res = await call(true)
  // Older image models don't take imageConfig: the ratio is already in the prompt
  if (res.status === 400) res = await call(false)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ImageError(`Gemini: ${data?.error?.message || res.status}`)
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = data?.candidates?.[0]?.content?.parts || []
  const img = parts.find((p) => p.inlineData?.data)
  if (!img?.inlineData) throw new ImageError(`Gemini no devolvió una imagen${parts.find((p) => p.text)?.text ? `: ${parts.find((p) => p.text)!.text!.slice(0, 200)}` : ''}`)
  return { dataUri: `data:${img.inlineData.mimeType};base64,${img.inlineData.data}` }
}

async function openai(key: string, model: string, prompt: string, o: Orientation, n: number, ref: Awaited<ReturnType<typeof fetchReference>> | null): Promise<Generated[]> {
  const size = aspectFor(o).openaiSize
  let res: Response
  if (ref) {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', prompt)
    form.append('size', size)
    form.append('n', String(n))
    form.append('image', new Blob([new Uint8Array(ref.buf)], { type: ref.mime }), 'referencia.png')
    res = await withTimeout((signal) => fetch('https://api.openai.com/v1/images/edits', { method: 'POST', signal, headers: { Authorization: `Bearer ${key}` }, body: form }), 150_000)
  } else {
    res = await withTimeout((signal) => fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, size, n }),
    }), 150_000)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ImageError(`OpenAI: ${data?.error?.message || res.status}`)
  const items: Array<{ b64_json?: string; url?: string }> = data?.data || []
  const out = items.map((d) => (d.b64_json ? { dataUri: `data:image/png;base64,${d.b64_json}` } : d.url ? { dataUri: d.url } : null)).filter((x): x is Generated => Boolean(x))
  if (!out.length) throw new ImageError('OpenAI no devolvió imágenes')
  return out
}

async function cloudflare(token: string, accountId: string, model: string, prompt: string): Promise<Generated> {
  const res = await withTimeout((signal) => fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: 'POST', signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, steps: 4 }),
  }))
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) throw new ImageError(`Cloudflare: ${data?.errors?.[0]?.message || res.status}`)
  const b64 = data?.result?.image
  if (!b64) throw new ImageError('Cloudflare no devolvió una imagen')
  return { dataUri: `data:image/jpeg;base64,${b64}` }
}

async function generateWith(s: ImageSettings, provider: GenProvider, key: string, prompt: string, params: { orientation: Orientation; n: number }, ref: Awaited<ReturnType<typeof fetchReference>> | null) {
  const model = s.models[provider]?.trim() || IMAGE_PROVIDERS[provider].defaultModel
  if (provider === 'openai') return { model, images: await openai(key, model, prompt, params.orientation, params.n, ref) }
  const one = () => (provider === 'gemini' ? gemini(key, model, prompt, params.orientation, ref) : cloudflare(key, s.cloudflareAccountId!, model, prompt))
  const settled = await Promise.allSettled(Array.from({ length: params.n }, one))
  const images = settled.filter((r): r is PromiseFulfilledResult<Generated> => r.status === 'fulfilled').map((r) => r.value)
  if (!images.length) throw (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason
  return { model, images }
}

/**
 * Generates `n` images with the configured provider (and, if it fails — no credit, bad key, outage —
 * with every other provider that has a key, before giving up), stores them in the post's Cloudinary folder
 * (so the preview is fast and choosing one needs no re-upload) and logs the cost.
 */
export async function generateImages(params: { workspaceId: string; postId: string; prompt: string; style?: string | null; orientation: Orientation; n: number; referenceUrl?: string | null }): Promise<ImageCandidate[]> {
  const s = await getImageSettings()
  const ready = providerReady(s)
  if (!ready.ready) throw new ImageError(ready.reason!)
  const budget = await checkWorkspaceBudget(params.workspaceId)
  if (budget.state === 'blocked') throw new ImageError(`Tope mensual de IA alcanzado (${budget.pct}%)`)
  // Independent of the monthly cap (which may be unset): a hard daily limit per workspace
  const today = await prisma.aiCall.count({ where: { workspaceId: params.workspaceId, kind: 'image_generation', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
  if (today >= DAILY_GENERATIONS) throw new ImageError(`Límite diario de generación alcanzado (${DAILY_GENERATIONS} pedidos en 24 h). Usa fotos de Pexels o inténtalo mañana.`)
  const chain = imageChain(s)
  const ref = params.referenceUrl && chain.some((c) => IMAGE_PROVIDERS[c.provider].supportsReference) ? await fetchReference(params.referenceUrl) : null
  const started = Date.now()

  let provider: GenProvider | null = null
  let model = ''
  let images: Generated[] = []
  const failures: string[] = []
  for (const c of chain) {
    const withRef = IMAGE_PROVIDERS[c.provider].supportsReference ? ref : null
    try {
      const r = await generateWith(s, c.provider, c.key, finalPrompt(params.prompt, { style: params.style, orientation: params.orientation, withReference: Boolean(withRef) }), params, withRef)
      provider = c.provider
      model = r.model
      images = r.images
      break
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failures.push(message)
      logger.warn('Image provider failed, trying the next one', { provider: c.provider, err: message })
    }
  }
  if (!provider) throw new ImageError(failures.length > 1 ? `Ningún proveedor de imágenes respondió: ${failures.join(' · ')}` : failures[0] || 'No hay un proveedor de IA de imágenes configurado')
  const meta = IMAGE_PROVIDERS[provider]
  const folder = `${mediaFolder(params.workspaceId, params.postId)}/ia`
  const uploaded = (await Promise.all(images.map((g) => cloudinaryService.uploadRemote(g.dataUri, folder).catch((err) => { logger.warn('Upload of generated image failed', { err: err instanceof Error ? err.message : err }); return null }))))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
  // The provider charged for every image; the request is logged even if none could be stored (it counts for the daily limit)
  await logFixedCostCall({ provider, model, kind: 'image_generation', workspaceId: params.workspaceId, costUsd: s.costPerImageUsd * images.length, latencyMs: Date.now() - started })
  if (!uploaded.length) throw new ImageError('Las imágenes se generaron pero no se pudieron guardar en Cloudinary; inténtalo de nuevo')
  return uploaded.map((u, i) => ({
    source: 'ai', id: `ai:${u.public_id}:${i}`, previewUrl: u.secure_url.replace('/upload/', '/upload/c_limit,w_600/'), fullUrl: u.secure_url,
    width: u.width ?? null, height: u.height ?? null, alt: null, credit: `Generada con ${meta.label}`, creditUrl: null, publicId: u.public_id, bytes: u.bytes ?? null,
  }))
}

// ─── Brand kit & import ──────────────────────────────────────────────────────

export async function getBrandKit(workspaceId: string) {
  return prisma.marketingBrandKit.findUnique({ where: { workspaceId } })
}

/**
 * Adds a chosen image to the post: Pexels photos are copied to Cloudinary (the post must not depend on
 * a third-party URL); AI images are already there. The logo is laid over when asked.
 */
export async function importImage(params: {
  workspaceId: string
  postId: string
  candidate: { source: 'pexels' | 'ai'; url: string; publicId?: string | null; width?: number | null; height?: number | null; bytes?: number | null; alt?: string | null; credit?: string | null; creditUrl?: string | null }
  brand: boolean
}) {
  const count = await prisma.marketingMedia.count({ where: { postId: params.postId } })
  if (count >= 10) throw new ImageError('Máximo 10 archivos por publicación')
  const c = params.candidate
  let file = { url: c.url, publicId: c.publicId ?? null, width: c.width ?? null, height: c.height ?? null, bytes: c.bytes ?? null, mime: 'image/jpeg' }
  if (c.source === 'pexels') {
    // Downloaded by our server and sent to Cloudinary as data (Pexels' CDN may refuse other fetchers)
    const res = await fetch(c.url, { cache: 'no-store' }).catch(() => null)
    const type = res?.headers.get('content-type') || ''
    if (!res?.ok || !type.startsWith('image/')) throw new ImageError('No se pudo descargar la foto de Pexels; prueba con otra')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 15 * 1024 * 1024) throw new ImageError('La foto pesa demasiado; prueba con otra')
    const up = await cloudinaryService.uploadRemote(`data:${type};base64,${buf.toString('base64')}`, mediaFolder(params.workspaceId, params.postId))
    file = { url: up.secure_url, publicId: up.public_id, width: up.width ?? null, height: up.height ?? null, bytes: up.bytes ?? null, mime: up.format === 'png' ? 'image/png' : 'image/jpeg' }
  }
  const kit = params.brand ? await getBrandKit(params.workspaceId) : null
  const branded = kit ? brandedUrl(file.url, kit) : null
  return prisma.marketingMedia.create({
    data: {
      postId: params.postId, url: branded || file.url, originalUrl: file.url, branded: Boolean(branded), publicId: file.publicId, kind: 'image', mime: file.mime,
      bytes: file.bytes, width: file.width, height: file.height, alt: c.alt?.slice(0, 200) || null, position: count,
      source: c.source, credit: c.credit?.slice(0, 200) || null, creditUrl: c.creditUrl?.startsWith('https://') ? c.creditUrl.slice(0, 500) : null,
    },
  })
}

/** Logo on / off for one image of a post (any source). */
export async function setMediaBranding(workspaceId: string, mediaId: string, on: boolean) {
  const m = await prisma.marketingMedia.findUnique({ where: { id: mediaId } })
  if (!m || m.kind !== 'image') throw new ImageError('Solo las imágenes pueden llevar el logo')
  const original = m.originalUrl || m.url
  if (!on) return prisma.marketingMedia.update({ where: { id: m.id }, data: { url: original, originalUrl: original, branded: false } })
  const kit = await getBrandKit(workspaceId)
  if (!kit?.logoPublicId) throw new ImageError('Sube primero el logo en Publicaciones → Marca e imágenes')
  const url = brandedUrl(original, kit)
  if (!url) throw new ImageError('Esta imagen no está en Cloudinary: no se le puede poner el logo')
  return prisma.marketingMedia.update({ where: { id: m.id }, data: { url, originalUrl: original, branded: true } })
}

/** Catalog service names (for the "Servicio" picker) and the ones this post talks about. */
export async function serviceSuggestions(postId: string) {
  const [post, services] = await Promise.all([
    prisma.marketingPost.findUnique({ where: { id: postId }, select: { title: true, brief: true, variants: { select: { body: true, seoTitle: true } }, campaign: { select: { name: true, description: true } } } }),
    prisma.service.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])
  const names = Array.from(new Set(services.map((s) => s.name.trim()).filter(Boolean)))
  if (!post) return { services: names, matched: [] as string[] }
  const text = [post.brief, post.campaign?.name, post.campaign?.description, ...post.variants.map((v) => `${v.seoTitle || ''} ${v.body.slice(0, 3000)}`)].filter(Boolean).join(' ')
  return { services: names, matched: matchServices(post.title, text, names) }
}
