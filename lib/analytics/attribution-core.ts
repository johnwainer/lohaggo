/**
 * Where a request or booking came from, as a normalized «touch». Pure: shared by the web (cookies), the chat
 * (the conversation's ad / web ref) and the attribution board, which groups touches by channel and campaign.
 */
import { parseAcquisition } from '@/lib/analytics/core'

export type Touch = {
  via: 'web' | 'chat'
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term?: string | null
  referrer?: string | null
  landing?: string | null
  /** `(ref: …)` tag: web-… | blog-… | post-… | ad-… */
  ref?: string | null
  adId?: string | null
  adHeadline?: string | null
  fbclid?: string | null
  gclid?: string | null
  ctwaClid?: string | null
  /** Conversation channel (WHATSAPP, INSTAGRAM…) for chat touches */
  channel?: string | null
  /** Browser ids kept for server conversions sent later (Purchase): Meta _fbp/_fbc, GA4 client id */
  fbp?: string | null
  fbc?: string | null
  gaClientId?: string | null
  at: string | null
}

export type Touches = { first: Touch | null; last: Touch | null }

const str = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** A touch from the first-touch (lh_acq) or last-touch (lh_lt) cookie; they share one shape. */
export function touchFromCookie(raw: string | null | undefined): Touch | null {
  const a = parseAcquisition(raw)
  if (!a) return null
  let extra: Record<string, unknown> = {}
  try {
    extra = JSON.parse(decodeURIComponent(raw as string)) ?? {}
  } catch {
    extra = {}
  }
  return { via: 'web', ...a, fbclid: str(extra.fbclid, 500), gclid: str(extra.gclid, 300) }
}

/** `_fbc` cookie value, or the one Meta would build from a fbclid click. */
export function fbcFrom(cookie: string | null | undefined, touch: Touch | null): string | null {
  if (cookie) return cookie.slice(0, 500)
  if (!touch?.fbclid) return null
  const ts = touch.at ? Date.parse(touch.at) : NaN
  return `fb.1.${Number.isFinite(ts) ? ts : Date.now()}.${touch.fbclid}`
}

/** `_ga` = GA1.1.123456.789 → 123456.789 (the GA4 client id). */
export function gaClientIdFrom(cookie: string | null | undefined): string | null {
  const m = /^GA\d\.\d\.(\d+\.\d+)$/.exec((cookie || '').trim())
  return m ? m[1] : null
}

type AdRef = { source?: string; adId?: string | null; ctwaClid?: string | null; headline?: string | null; ref?: string | null; at?: string }

function adTouch(ad: AdRef, channel: string | null): Touch {
  return {
    via: 'chat', channel, source: 'meta', medium: 'paid_social', campaign: null, content: ad.adId ?? null,
    adId: ad.adId ?? null, adHeadline: ad.headline ?? null, ctwaClid: ad.ctwaClid ?? null, ref: ad.ref ?? null, at: ad.at ?? null,
  }
}

function refTouch(ref: string, at: string | null, channel: string | null): Touch {
  const [kind] = ref.split('-')
  const rest = ref.slice(kind.length + 1)
  const base: Touch = { via: 'chat', channel, source: null, medium: null, campaign: null, content: null, ref, at }
  if (kind === 'post') return { ...base, source: 'publicacion', medium: 'social', content: rest }
  if (kind === 'ad') return { ...base, source: 'meta', medium: 'paid_social', campaign: ref }
  if (kind === 'blog') return { ...base, source: 'blog', medium: 'organic', content: rest }
  return { ...base, source: 'web', medium: 'website', content: rest }
}

/**
 * First and last touch of a conversation from its customFields (adReferral / lastAdReferral / webRef).
 * An ad-draft ref in the prefilled message (`ad-…`) names the campaign even when Meta sends no ad id.
 */
export function touchesFromConversation(customFields: unknown, channel: string | null): Touches {
  const f = (customFields && typeof customFields === 'object' && !Array.isArray(customFields) ? customFields : {}) as {
    adReferral?: AdRef; lastAdReferral?: AdRef; webRef?: string; webRefAt?: string
  }
  const webRef = typeof f.webRef === 'string' ? f.webRef : null
  const refT = webRef ? refTouch(webRef, f.webRefAt ?? null, channel) : null
  const withRef = (t: Touch) => (refT && refT.ref?.startsWith('ad-') && !t.campaign ? { ...t, campaign: refT.campaign, ref: refT.ref } : t)
  const first = f.adReferral ? withRef(adTouch(f.adReferral, channel)) : refT
  const last = f.lastAdReferral ? withRef(adTouch(f.lastAdReferral, channel)) : first
  const direct: Touch = { via: 'chat', channel, source: channel ? channel.toLowerCase() : 'chat', medium: 'direct', campaign: null, content: null, at: null }
  return { first: first ?? direct, last: last ?? first ?? direct }
}

export type ChannelKey =
  | 'meta_ads' | 'google_ads' | 'publicaciones' | 'instagram' | 'facebook' | 'blog' | 'gbp' | 'google'
  | 'otros_sitios' | 'sitio_web' | 'chat_directo' | 'directo' | 'sin_dato'

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  meta_ads: 'Anuncios de Meta',
  google_ads: 'Anuncios de Google',
  publicaciones: 'Publicaciones (IG/FB)',
  instagram: 'Instagram orgánico',
  facebook: 'Facebook orgánico',
  blog: 'Blog',
  gbp: 'Perfil de Google (GBP)',
  google: 'Google (búsqueda)',
  otros_sitios: 'Otros sitios',
  sitio_web: 'Botón de WhatsApp del sitio',
  chat_directo: 'Chat directo',
  directo: 'Directo',
  sin_dato: 'Sin dato',
}

export type TouchBucket = { channel: ChannelKey; campaign: string | null; content: string | null }

const has = (v: string | null | undefined, ...needles: string[]) => !!v && needles.some((n) => v.toLowerCase().includes(n))

/** Channel, campaign and content a touch is counted under. */
export function classifyTouch(t: Touch | null | undefined): TouchBucket {
  if (!t) return { channel: 'sin_dato', campaign: null, content: null }
  const campaign = t.campaign ?? null
  const content = t.content ?? null
  const ref = t.ref ?? ''
  // A chat that arrived with no ad and no ref (someone wrote to us on WhatsApp, Instagram or Messenger)
  if (t.via === 'chat' && t.medium === 'direct') return { channel: 'chat_directo', campaign: null, content: t.channel ?? null }
  const metaSource = has(t.source, 'facebook', 'instagram', 'meta', 'fb', 'ig', 'msg', 'an')
  if (t.adId || t.ctwaClid || ref.startsWith('ad-') || t.fbclid || has(t.medium, 'paid_social') || (has(t.medium, 'paid', 'cpc', 'ads') && metaSource)) {
    return { channel: 'meta_ads', campaign, content: content ?? t.adId ?? null }
  }
  if (t.gclid || has(t.medium, 'cpc', 'paid')) return { channel: 'google_ads', campaign, content }
  if (ref.startsWith('post-') || (has(t.medium, 'social', 'organic') && campaign && content && has(t.source, 'instagram', 'facebook'))) {
    return { channel: 'publicaciones', campaign, content }
  }
  if (has(t.source, 'gbp', 'business.google')) return { channel: 'gbp', campaign, content }
  if (ref.startsWith('blog-') || has(t.source, 'blog') || (t.landing ?? '').startsWith('/blog')) return { channel: 'blog', campaign, content: content ?? (ref ? ref.slice(5) : null) }
  if (has(t.source, 'instagram')) return { channel: 'instagram', campaign, content }
  if (has(t.source, 'facebook')) return { channel: 'facebook', campaign, content }
  if (has(t.source, 'google')) return { channel: 'google', campaign, content }
  if (ref.startsWith('web-')) return { channel: 'sitio_web', campaign, content: ref.slice(4) }
  if (t.via === 'chat') return { channel: 'chat_directo', campaign, content }
  if (t.medium === 'referral') return { channel: 'otros_sitios', campaign, content: t.source }
  return { channel: 'directo', campaign, content }
}

/** Keeps only what the JSON column needs (no nulls), so stored touches stay small. */
export function compactTouch(t: Touch | null): Record<string, unknown> | null {
  if (!t) return null
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

/** A stored touch (JSON column) back to a Touch, tolerant to missing fields. */
export function readTouch(v: unknown): Touch | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  return {
    via: o.via === 'chat' ? 'chat' : 'web',
    source: str(o.source), medium: str(o.medium), campaign: str(o.campaign), content: str(o.content), term: str(o.term),
    referrer: str(o.referrer), landing: str(o.landing), ref: str(o.ref), adId: str(o.adId), adHeadline: str(o.adHeadline),
    fbclid: str(o.fbclid, 500), gclid: str(o.gclid), ctwaClid: str(o.ctwaClid, 500), channel: str(o.channel),
    fbp: str(o.fbp), fbc: str(o.fbc, 500), gaClientId: str(o.gaClientId), at: str(o.at, 40),
  }
}
