/**
 * Ad agent, pure part: what a person asks for, the package the model must return (validated here) and the
 * tracking parameters for Meta Ads. Shared by the server and the admin screen (no server imports).
 */

export const AD_OBJECTIVES = {
  messages: { label: 'Mensajes (WhatsApp, Messenger, Instagram)', meta: 'Interacción → Mensajes' },
  leads: { label: 'Clientes potenciales', meta: 'Clientes potenciales' },
  traffic: { label: 'Visitas al sitio', meta: 'Tráfico' },
  awareness: { label: 'Reconocimiento de marca', meta: 'Reconocimiento' },
  engagement: { label: 'Interacción con la publicación', meta: 'Interacción' },
} as const
export type AdObjective = keyof typeof AD_OBJECTIVES

export const AD_DESTINATIONS = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Mensaje directo de Instagram',
  website: 'Sitio web (lohaggo.com)',
} as const
export type AdDestination = keyof typeof AD_DESTINATIONS

/** Meta's call-to-action buttons, with the label Meta shows in Spanish. */
export const AD_CTAS = {
  WHATSAPP_MESSAGE: 'Enviar mensaje de WhatsApp',
  SEND_MESSAGE: 'Enviar mensaje',
  LEARN_MORE: 'Más información',
  GET_QUOTE: 'Solicitar presupuesto',
  BOOK_NOW: 'Reservar',
  CONTACT_US: 'Contactarnos',
  SIGN_UP: 'Registrarte',
  CALL_NOW: 'Llamar',
} as const
export type AdCta = keyof typeof AD_CTAS

/** Image formats the agent can make (Meta feed 1:1 and 4:5; horizontal for the right column and links). */
export const AD_FORMATS = {
  square: { label: 'Cuadrada 1:1', use: 'Feed de Facebook e Instagram' },
  portrait: { label: 'Vertical 4:5', use: 'Feed de Instagram y Facebook (la que más ocupa en el celular)' },
  landscape: { label: 'Horizontal 16:9', use: 'Columna derecha y anuncios con enlace' },
} as const
export type AdFormat = keyof typeof AD_FORMATS

/** Meta's limits (characters): the visible part before «Ver más», and what the field accepts. */
export const AD_LIMITS = { primaryVisible: 125, primaryMax: 600, headline: 40, description: 30 }

export type AdInput = {
  campaignId: string | null
  service: string | null
  city: string | null
  objective: AdObjective
  destination: AdDestination
  offer: string | null
  audience: string | null
  instruction: string | null
  formats: AdFormat[]
  variants: number
  images: number
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = <T extends string>(v: unknown, options: Record<T, unknown>, fallback: T): T => (typeof v === 'string' && v in options ? (v as T) : fallback)
const intIn = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function sanitizeAdInput(raw: unknown): AdInput {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const formats = Array.isArray(r.formats) ? Array.from(new Set(r.formats.filter((f): f is AdFormat => typeof f === 'string' && f in AD_FORMATS))) : []
  return {
    campaignId: str(r.campaignId, 40) || null,
    service: str(r.service, 120) || null,
    city: str(r.city, 80) || null,
    objective: oneOf(r.objective, AD_OBJECTIVES, 'messages'),
    destination: oneOf(r.destination, AD_DESTINATIONS, 'whatsapp'),
    offer: str(r.offer, 400) || null,
    audience: str(r.audience, 600) || null,
    instruction: str(r.instruction, 1000) || null,
    formats: formats.length ? formats : ['portrait', 'square'],
    variants: intIn(r.variants, 1, 5, 3),
    images: intIn(r.images, 0, 4, 2),
  }
}

// ─── The package ────────────────────────────────────────────────────────────

export type AdVariant = { angle: string; primaryText: string; headline: string; description: string; cta: AdCta; visualHook: string }
export type AdImagePlan = { purpose: string; prompt: string; alt: string }
export type AdPackage = {
  title: string
  summary: string
  metaObjective: string
  audience: { locations: string[]; ageMin: number; ageMax: number; gender: 'all' | 'women' | 'men'; interests: string[]; exclusions: string[]; note: string }
  placements: string[]
  budget: { dailyCop: number; days: number; note: string }
  variants: AdVariant[]
  images: AdImagePlan[]
  checklist: string[]
  risks: string[]
  /** Ids of the ads created in Meta Ads Manager from this package (typed by a person): chats whose ad id matches are credited to the package */
  metaAdIds?: string[]
}

/** Meta ad ids from free text (commas, spaces or lines): digits only, deduplicated, at most 50. */
export function parseMetaAdIds(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map((x) => String(x ?? '')) : String(v ?? '').split(/[\s,;]+/)
  return Array.from(new Set(raw.map((x) => x.trim()).filter((x) => /^\d{5,30}$/.test(x)))).slice(0, 50)
}

/** Meta ad ids stored on a package's output JSON. */
export function metaAdIdsOf(output: unknown): string[] {
  return output && typeof output === 'object' && !Array.isArray(output) ? parseMetaAdIds((output as { metaAdIds?: unknown }).metaAdIds ?? []) : []
}

type Json = Record<string, unknown>
type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] }
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const strs = (v: unknown, maxItems: number, maxLen: number) => (Array.isArray(v) ? v : []).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems)

/** The model's package, bounded and checked against Meta's limits; nothing is used from free text. */
export function parseAdPackage(input: unknown, want: { variants: number; images: number }): Parsed<AdPackage> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  const errors: string[] = []
  const title = str(input.nombre, 120)
  if (!title) errors.push('Falta el nombre de la pauta')
  const a = isObj(input.publico) ? input.publico : {}
  const ageMin = intIn(a.edad_min, 18, 65, 25)
  const ageMax = intIn(a.edad_max, 18, 65, 55)
  const b = isObj(input.presupuesto) ? input.presupuesto : {}
  const variants: AdVariant[] = []
  for (const v of (Array.isArray(input.variantes) ? input.variantes : []).filter(isObj).slice(0, 5)) {
    const primaryText = str(v.texto_principal, AD_LIMITS.primaryMax)
    const headline = str(v.titulo, 80)
    const description = str(v.descripcion, 80)
    if (!primaryText || !headline) continue
    if (headline.length > AD_LIMITS.headline) errors.push(`Título de más de ${AD_LIMITS.headline} caracteres: «${headline}»`)
    if (description.length > AD_LIMITS.description) errors.push(`Descripción de más de ${AD_LIMITS.description} caracteres: «${description}»`)
    variants.push({ angle: str(v.angulo, 160), primaryText, headline, description, cta: oneOf(v.cta, AD_CTAS, 'LEARN_MORE'), visualHook: str(v.gancho_visual, 200) })
  }
  if (variants.length < Math.min(want.variants, 1) || variants.length < want.variants) errors.push(`Se pidieron ${want.variants} variantes de texto con texto principal y título (llegaron ${variants.length})`)
  const images: AdImagePlan[] = (Array.isArray(input.imagenes) ? input.imagenes : []).filter(isObj)
    .map((i) => ({ purpose: str(i.proposito, 160), prompt: str(i.prompt, 900), alt: str(i.alt, 200) }))
    .filter((i) => i.prompt)
    .slice(0, want.images)
  if (images.length < want.images) errors.push(`Se pidieron ${want.images} imágenes con su descripción (prompt) (llegaron ${images.length})`)
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title,
      summary: str(input.resumen, 1200),
      metaObjective: str(input.objetivo_meta, 300),
      audience: {
        locations: strs(a.ubicaciones, 10, 80),
        ageMin: Math.min(ageMin, ageMax), ageMax: Math.max(ageMin, ageMax),
        gender: a.genero === 'mujeres' ? 'women' : a.genero === 'hombres' ? 'men' : 'all',
        interests: strs(a.intereses, 15, 80),
        exclusions: strs(a.exclusiones, 10, 80),
        note: str(a.nota, 400),
      },
      placements: strs(input.ubicaciones_anuncio, 10, 200),
      budget: { dailyCop: intIn(b.diario_cop, 0, 50_000_000, 0), days: intIn(b.dias, 0, 90, 0), note: str(b.nota, 400) },
      variants,
      images,
      checklist: strs(input.checklist, 15, 300),
      risks: strs(input.riesgos, 8, 300),
    },
  }
}

// ─── Tracking ───────────────────────────────────────────────────────────────

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pauta'

/**
 * «Parámetros de URL» for the ad in Meta Ads Manager: Meta fills {{site_source_name}} (fb / ig) and the ad's
 * id, so every visit is tracked by network and ad in Resultados.
 */
export function adUrlParams(title: string, draftId?: string) {
  return `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign=${draftId ? `ad-${adRefCode(draftId)}` : slug(title)}&utm_content={{ad.id}}`
}

/** Short code of an ad package: in its UTM campaign and its WhatsApp ref, so both land on the same row of the board. */
export const adRefCode = (draftId: string) => draftId.slice(-8).toLowerCase()

/**
 * Prefilled message of a Click-to-WhatsApp ad («Mensaje de bienvenida» → pregunta frecuente / mensaje
 * prellenado in Ads Manager). Its `(ref: ad-…)` tag ties the chat, and any request it ends in, to this package.
 */
export function adWelcomeMessage(draftId: string, service: string | null) {
  const what = service ? `quiero pedir ${service.toLowerCase()}` : 'necesito un servicio'
  return `Hola, vi su anuncio y ${what} (ref: ad-${adRefCode(draftId)})`
}

export const cloudinaryDownload = (url: string) => url.replace('/image/upload/', '/image/upload/fl_attachment/')
