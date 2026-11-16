import { cleanNoteText } from '@/lib/agents/bus-core'

export type ShareArticle = {
  title: string
  excerpt: string | null
  slug: string
  tags: string[]
  keyword?: string | null
  serviceName?: string | null
  cityName?: string | null
}

export type ShareKit = { url: string; whatsapp: string; facebook: string; instagram: string; hashtags: string[] }

export const SHARE_LIMITS = { whatsapp: 350, facebook: 450, instagram: 600 } as const

const BASE = 'https://www.lohaggo.com/blog'
const EMOJI = /[\u2190-\u2BFF\uFE0F\u200D]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g
const FALLBACK_TAGS = ['hogar', 'serviciosdelhogar', 'mantenimiento', 'colombia', 'consejos']

export function shareUrl(slug: string, channel: 'whatsapp' | 'facebook' | 'instagram') {
  return `${BASE}/${encodeURIComponent(slug)}?utm_source=${channel}&utm_medium=social&utm_campaign=guia-compartida`
}

/** "#PlomeroMedellín" style: lower case, no accents, no spaces or symbols. Empty when nothing is left. */
export function hashtagOf(text: string): string {
  const core = String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return core.length >= 3 && core.length <= 30 ? `#${core}` : ''
}

const plain = (v: unknown, max: number) => cleanNoteText(v, max).replace(EMOJI, '').replace(/\[(?:correo|número|enlace externo)\]/g, '').replace(/\s+/g, ' ').trim()

function clip(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, Math.max(0, max - 1))
  const at = cut.lastIndexOf(' ')
  const base = (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, '')
  return `${base}…`
}

/** A sentence that ends in punctuation, so the next phrase never glues onto it. */
const sentence = (t: string) => (t && !/[.!?…»"]$/.test(t) ? `${t}.` : t)

/** Fills the template with the title and excerpt, shrinking the excerpt first and then the title until it fits. */
function fit(limit: number, title: string, excerpt: string, build: (t: string, e: string) => string): string {
  let t = clip(title, 140)
  let e = excerpt
  let out = build(t, e)
  while (out.length > limit && e) { e = clip(e, Math.max(0, e.length - Math.max(10, out.length - limit))); if (e.length < 25) e = ''; out = build(t, e) }
  while (out.length > limit && t.length > 20) { t = clip(t, Math.max(20, t.length - Math.max(5, out.length - limit))); out = build(t, e) }
  return out.length > limit ? out.slice(0, limit) : out
}

function hashtagsFor(a: ShareArticle): string[] {
  const service = plain(a.serviceName, 60)
  const city = plain(a.cityName, 60)
  const candidates = [
    '#lohaggo',
    service && city ? hashtagOf(`${service}${city}`) : '',
    hashtagOf(service),
    hashtagOf(city),
    ...a.tags.map((t) => hashtagOf(plain(t, 40))),
    hashtagOf(plain(a.keyword, 40)),
  ]
  const out: string[] = []
  for (const h of candidates) if (h && !out.includes(h)) out.push(h)
  for (const f of FALLBACK_TAGS) { if (out.length >= 5) break; const h = `#${f}`; if (!out.includes(h)) out.push(h) }
  return out.slice(0, 8)
}

export function shareKit(a: ShareArticle): ShareKit {
  const title = plain(a.title, 200)
  const excerpt = plain(a.excerpt, 400)
  const hashtags = hashtagsFor(a)

  const waUrl = shareUrl(a.slug, 'whatsapp')
  const fbUrl = shareUrl(a.slug, 'facebook')

  const whatsapp = fit(SHARE_LIMITS.whatsapp, title, excerpt, (t, e) =>
    `Te comparto esta guía de LoHaggo: «${t}».${e ? ` ${sentence(e)}` : ''} Te la dejo aquí 👇\n${waUrl}`)
  const facebook = fit(SHARE_LIMITS.facebook, title, excerpt, (t, e) =>
    `${t}\n\n${e ? `${sentence(e)}\n\n` : ''}Lee la guía completa en LoHaggo 👇\n${fbUrl}`)

  const tagLine = hashtags.join(' ')
  const instagram = fit(SHARE_LIMITS.instagram, title, excerpt, (t, e) =>
    `💡 ${t}\n\n${e ? `${sentence(e)}\n\n` : ''}Guárdala para cuando la necesites.\nEnlace en la bio\n\n${tagLine}`)

  return { url: waUrl, whatsapp, facebook, instagram, hashtags }
}
