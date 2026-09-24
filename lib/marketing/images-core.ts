/**
 * Image suggestions for posts: free stock photos (Pexels) and, if configured, an AI image provider.
 * The brand logo is never drawn by an AI: it is laid over the image by Cloudinary. Pure.
 */
import type { MarketingChannel } from '@/lib/marketing/channel-rules'

export const IMAGE_PROVIDERS = {
  none: { label: 'Ninguno (solo fotos de Pexels)', defaultModel: '', supportsReference: false, needsAccount: false, keyHint: '' },
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash-image', supportsReference: true, needsAccount: false, keyHint: 'Clave de Google AI Studio (aistudio.google.com → Get API key)' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-image-1', supportsReference: true, needsAccount: false, keyHint: 'Clave de la API de OpenAI (platform.openai.com → API keys)' },
  cloudflare: { label: 'Cloudflare Workers AI (FLUX)', defaultModel: '@cf/black-forest-labs/flux-1-schnell', supportsReference: false, needsAccount: true, keyHint: 'Token de API con permiso «Workers AI» y el Account ID de Cloudflare' },
} as const
export type ImageProvider = keyof typeof IMAGE_PROVIDERS
export const PROVIDER_IDS = Object.keys(IMAGE_PROVIDERS) as ImageProvider[]

export const ORIENTATIONS = ['portrait', 'square', 'landscape'] as const
export type Orientation = (typeof ORIENTATIONS)[number]

/** What each network shows best: Instagram 4:5 vertical, Facebook and the blog horizontal. */
export function defaultOrientation(channel: MarketingChannel, format?: string | null): Orientation {
  if (channel === 'INSTAGRAM') return format === 'feed' || format === 'carousel' || format === 'reel' || !format ? 'portrait' : 'square'
  return 'landscape'
}

/** Aspect ratio sent to each provider for an orientation. */
export function aspectFor(o: Orientation) {
  return o === 'portrait' ? { ratio: '4:5', openaiSize: '1024x1536', w: 4, h: 5 } : o === 'square' ? { ratio: '1:1', openaiSize: '1024x1024', w: 1, h: 1 } : { ratio: '16:9', openaiSize: '1536x1024', w: 16, h: 9 }
}

export const LOGO_POSITIONS = {
  north_west: 'Arriba a la izquierda',
  north_east: 'Arriba a la derecha',
  south_west: 'Abajo a la izquierda',
  south_east: 'Abajo a la derecha',
} as const
export type LogoPosition = keyof typeof LOGO_POSITIONS

export type BrandKit = { logoPublicId: string | null; logoPosition: string; logoScale: number; logoOpacity: number; logoMargin: number }

const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/

/**
 * The same Cloudinary image with the logo laid over it (a URL transformation: the original file is
 * untouched and the logo can be removed any time). Null when there is no logo or the URL is not ours.
 */
export function brandedUrl(url: string, kit: BrandKit | null | undefined) {
  if (!kit?.logoPublicId) return null
  const m = url.match(CLOUDINARY_IMAGE)
  if (!m) return null
  const pos = (kit.logoPosition in LOGO_POSITIONS ? kit.logoPosition : 'south_east') as LogoPosition
  const scale = Math.min(0.5, Math.max(0.05, kit.logoScale || 0.18))
  const opacity = Math.min(100, Math.max(10, Math.round(kit.logoOpacity || 90)))
  const margin = Math.min(200, Math.max(0, Math.round(kit.logoMargin ?? 24)))
  const layer = kit.logoPublicId.replace(/\//g, ':')
  return `${m[1]}l_${layer},fl_relative,w_${scale},o_${opacity}/fl_layer_apply,g_${pos},x_${margin},y_${margin}/${m[2]}`
}

/** Pexels photo → what the picker needs (credit is required by Pexels' guidelines). */
export type PexelsPhoto = {
  id: number
  width: number
  height: number
  url: string
  alt?: string
  photographer: string
  photographer_url: string
  avg_color?: string
  src: { original: string; large2x: string; large: string; medium: string; small?: string; portrait?: string; landscape?: string; tiny?: string }
}

export type ImageCandidate = {
  source: 'pexels' | 'ai'
  id: string
  previewUrl: string
  fullUrl: string
  width: number | null
  height: number | null
  alt: string | null
  credit: string | null
  creditUrl: string | null
  publicId?: string | null
  bytes?: number | null
}

export function fromPexels(p: PexelsPhoto): ImageCandidate {
  // Large enough for Instagram (1440) and Open Graph, compressed by Pexels' CDN
  const sep = p.src.original.includes('?') ? '&' : '?'
  return {
    source: 'pexels',
    id: `pexels:${p.id}`,
    previewUrl: p.src.medium || p.src.large,
    fullUrl: `${p.src.original}${sep}auto=compress&cs=tinysrgb&w=2000`,
    width: p.width,
    height: p.height,
    alt: p.alt?.trim() || null,
    credit: `Foto de ${p.photographer} en Pexels`,
    creditUrl: p.photographer_url || p.url,
  }
}

export function isPexelsImageUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'images.pexels.com'
  } catch {
    return false
  }
}

export const STYLE_PRESETS = [
  ['realista', 'fotografía realista, luz natural, alta calidad, sin texto'],
  ['ilustración', 'ilustración plana moderna, colores morado y naranja, sin texto'],
  ['cercana', 'escena cotidiana en un hogar colombiano, cálida y cercana, sin texto'],
  ['producto', 'composición limpia sobre fondo claro, estilo editorial, sin texto'],
] as const

/**
 * The final instruction to the generator. Brand rules always go in: no text or logos drawn by the
 * AI (the real logo is laid over by Cloudinary), no people's faces recognisable as real persons.
 */
export function finalPrompt(prompt: string, opts: { style?: string | null; orientation: Orientation; withReference: boolean }) {
  const a = aspectFor(opts.orientation)
  return [
    prompt.trim(),
    opts.style?.trim() ? `Estilo: ${opts.style.trim()}.` : '',
    opts.withReference ? 'Usa la imagen adjunta como referencia de estilo, colores y composición.' : '',
    `Formato ${a.ratio}.`,
    'No incluyas textos, letras, marcas de agua ni logotipos en la imagen.',
  ].filter(Boolean).join(' ')
}

export function clampCount(n: unknown) {
  const x = Math.floor(Number(n))
  return Number.isFinite(x) ? Math.min(4, Math.max(1, x)) : 2
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'para', 'a', 'con', 'por', 'servicio', 'servicios'])

/** Root of a service name that also matches its trade: "Plomería" → "plomer" (plomero), "Cerrajería" → "cerraj". */
function stemsOf(name: string) {
  return norm(name).split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, Math.max(5, Math.min(7, w.length - 2))))
}

/**
 * Catalog services a post talks about, best match first (title counts more than the text). Photo
 * suggestions are just these names: simple searches return the most relevant stock photos.
 */
export function matchServices(title: string, text: string, services: string[]) {
  const t = ` ${norm(title)} `
  const b = ` ${norm(text)} `
  const scored = services.map((name) => {
    const stems = stemsOf(name)
    if (!stems.length) return { name, score: 0 }
    const hits = (hay: string) => stems.filter((s) => hay.includes(` ${s}`)).length / stems.length
    const exact = t.includes(` ${norm(name)} `) ? 2 : b.includes(` ${norm(name)} `) ? 1 : 0
    return { name, score: exact * 3 + hits(t) * 2 + hits(b) }
  })
  return scored.filter((s) => s.score >= 1).sort((a, b) => b.score - a.score).map((s) => s.name).slice(0, 5)
}

/** Default description for AI generation: the service, in a Colombian home. */
export function servicePrompt(service: string) {
  return `Profesional de ${service.toLowerCase()} trabajando en un hogar colombiano, escena real y cercana.`
}
