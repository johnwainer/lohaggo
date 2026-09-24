/**
 * Whitelists and bounds what the screens can write. Returns only the provided fields (PATCH-friendly). Pure.
 */
import { slugify } from '@/lib/marketing/seo'

export const CHANNELS = ['WEB', 'FACEBOOK', 'INSTAGRAM'] as const
export const POST_EDITABLE_STATUS = ['draft', 'review', 'approved', 'archived'] as const
export const CAMPAIGN_STATUS = ['draft', 'active', 'paused', 'done'] as const
export const CAMPAIGN_OBJECTIVES = ['reach', 'traffic', 'leads', 'engagement', 'sales', 'brand'] as const
export const IG_FORMATS = ['feed', 'reel', 'carousel'] as const

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const trimmed = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined)
const date = (v: unknown) => {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}
const url = (v: unknown) => {
  if (v === null || v === '') return null
  const s = trimmed(v, 1000)
  if (s === undefined) return undefined
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw new Error('El enlace debe empezar por https://')
  return s
}

export function sanitizeCampaignInput(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => { if (v !== undefined) out[k] = v }
  set('name', trimmed(b.name, 120))
  set('objective', oneOf(b.objective, CAMPAIGN_OBJECTIVES))
  if (b.description !== undefined) out.description = trimmed(b.description, 2000) || null
  set('startsAt', date(b.startsAt))
  set('endsAt', date(b.endsAt))
  if (b.budget !== undefined) {
    const n = b.budget === null || b.budget === '' ? null : Number(b.budget)
    if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error('Presupuesto inválido')
    out.budget = n
  }
  set('status', oneOf(b.status, CAMPAIGN_STATUS))
  if (typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color)) out.color = b.color
  if (out.name === '') throw new Error('La campaña necesita un nombre')
  if (out.startsAt instanceof Date && out.endsAt instanceof Date && out.endsAt < out.startsAt) throw new Error('La fecha de fin es anterior al inicio')
  return out
}

export function sanitizePostInput(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  if (b.title !== undefined) {
    const t = trimmed(b.title, 200)
    if (!t) throw new Error('La publicación necesita un título')
    out.title = t
  }
  if (b.brief !== undefined) out.brief = trimmed(b.brief, 4000) || null
  if (b.campaignId !== undefined) out.campaignId = typeof b.campaignId === 'string' && b.campaignId ? b.campaignId : null
  const status = oneOf(b.status, POST_EDITABLE_STATUS)
  if (status) out.status = status
  return out
}

export type VariantPatch = Record<string, unknown> & { channel: (typeof CHANNELS)[number] }

export function sanitizeVariantInput(b: Record<string, unknown>): VariantPatch {
  const channel = oneOf(b.channel, CHANNELS)
  if (!channel) throw new Error('Canal inválido')
  const out: VariantPatch = { channel }
  const set = (k: string, v: unknown) => { if (v !== undefined) out[k] = v }
  set('body', text(b.body, channel === 'WEB' ? 100_000 : 70_000))
  set('linkUrl', url(b.linkUrl))
  if (Array.isArray(b.mediaIds)) out.mediaIds = Array.from(new Set(b.mediaIds.filter((x): x is string => typeof x === 'string'))).slice(0, 10)
  if (typeof b.aiGenerated === 'boolean') out.aiGenerated = b.aiGenerated
  if (channel === 'INSTAGRAM' && b.format !== undefined) out.format = oneOf(b.format, IG_FORMATS) ?? null
  if (channel === 'WEB') {
    if (b.slug !== undefined) out.slug = b.slug ? slugify(String(b.slug)) || null : null
    if (b.seoTitle !== undefined) out.seoTitle = trimmed(b.seoTitle, 120) || null
    if (b.seoDescription !== undefined) out.seoDescription = trimmed(b.seoDescription, 320) || null
    if (b.excerpt !== undefined) out.excerpt = trimmed(b.excerpt, 500) || null
    set('coverUrl', url(b.coverUrl))
    if (b.category !== undefined) out.category = trimmed(b.category, 60) || null
    if (Array.isArray(b.tags)) out.tags = Array.from(new Set(b.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 12).map((t) => t.slice(0, 40))
    set('canonicalUrl', url(b.canonicalUrl))
    if (typeof b.noindex === 'boolean') out.noindex = b.noindex
  }
  return out
}

/** Direct uploads: only files in this post's folder of our Cloudinary account are accepted. */
export function validateUploadedMedia(b: Record<string, unknown>, cloudName: string, folder: string) {
  const u = typeof b.url === 'string' ? b.url : ''
  const publicId = typeof b.publicId === 'string' ? b.publicId : ''
  const m = u.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|video)\/upload\//)
  if (!m || m[1] !== cloudName) throw new Error('El archivo no está en la cuenta de Cloudinary de la plataforma')
  if (!publicId.startsWith(`${folder}/`)) throw new Error('El archivo no pertenece a esta publicación')
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  const mime = typeof b.mime === 'string' ? b.mime.toLowerCase().slice(0, 80) : null
  return {
    url: u, publicId, kind: m[2] as 'image' | 'video', mime,
    bytes: num(b.bytes) !== null ? Math.round(num(b.bytes)!) : null,
    width: num(b.width) !== null ? Math.round(num(b.width)!) : null,
    height: num(b.height) !== null ? Math.round(num(b.height)!) : null,
    durationSec: num(b.durationSec),
    alt: trimmed(b.alt, 200) || null,
  }
}
