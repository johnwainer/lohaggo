/**
 * Formats per network and the per-variant publishing options (MarketingPostVariant.publishOptions).
 * Pure: validated on save and read by the publisher, the editor, the agent and Haggo.
 */

export const IG_FORMATS = ['feed', 'carousel', 'reel', 'trial_reel', 'story'] as const
export const FB_FORMATS = ['post', 'reel', 'story'] as const
export type IgFormat = (typeof IG_FORMATS)[number]
export type FbFormat = (typeof FB_FORMATS)[number]

export const FORMAT_LABELS: Record<string, string> = {
  feed: 'Foto', carousel: 'Carrusel', reel: 'Reel', trial_reel: 'Reel de prueba', story: 'Historia', post: 'Publicación',
}

/** Text on screen: hard limits (60 / 25 read best in two seconds) */
export const SCREEN_TEXT_MAX = 90
export const SCREEN_CTA_MAX = 40

/** Stories stay visible (and their statistics readable) 24 h. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000

export type PublishOptions = {
  /** Reels: cover image (public https URL) or the frame at this millisecond */
  coverUrl?: string
  thumbOffsetMs?: number
  /** Instagram feed, carousel and reels: up to 3 usernames invited as collaborators */
  collaborators?: string[]
  /** Facebook Page id of a place (Pages Search API); Instagram and Facebook reels */
  locationId?: string
  /** Instagram reels: also show it in the profile grid (Meta's default) */
  shareToFeed?: boolean
  /** Instagram trial reels: graduate by hand in the app or automatically if it performs well */
  trialGraduation?: 'MANUAL' | 'SS_PERFORMANCE'
  /** Label «Hecho con IA»; when unset it follows the media (AI-generated images are always labelled) */
  aiLabel?: boolean
  /** Text on screen (stories and reels): the headline, kept for the review and Haggo */
  storyText?: string
  /** Text on screen: the call to action under the headline («Escríbenos por DM») */
  storyCta?: string
  /** Write storyText / storyCta on the image or video (Cloudinary draws them; an edit changes the picture too) */
  renderText?: boolean
}

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/

/** Whitelists the options the screens and the agent may write. Throws with a readable message. */
export function sanitizePublishOptions(raw: unknown): PublishOptions | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Opciones de publicación inválidas')
  const b = raw as Record<string, unknown>
  const out: PublishOptions = {}
  if (typeof b.coverUrl === 'string' && b.coverUrl.trim()) {
    const u = b.coverUrl.trim().slice(0, 1000)
    if (!/^https:\/\/[^\s]+$/i.test(u)) throw new Error('La portada del reel debe ser un enlace https://')
    out.coverUrl = u
  }
  if (b.thumbOffsetMs !== undefined && b.thumbOffsetMs !== null && b.thumbOffsetMs !== '') {
    const n = Math.round(Number(b.thumbOffsetMs))
    if (!Number.isFinite(n) || n < 0 || n > 15 * 60_000) throw new Error('El cuadro de portada debe estar dentro del video')
    out.thumbOffsetMs = n
  }
  if (Array.isArray(b.collaborators)) {
    const names = Array.from(new Set(b.collaborators.map((x) => String(x).trim().replace(/^@/, '')).filter(Boolean)))
    const bad = names.find((n) => !USERNAME_RE.test(n))
    if (bad) throw new Error(`«${bad}» no es un usuario de Instagram válido`)
    if (names.length > 3) throw new Error('Instagram admite hasta 3 colaboradores')
    if (names.length) out.collaborators = names
  }
  if (typeof b.locationId === 'string' && b.locationId.trim()) {
    if (!/^\d{5,25}$/.test(b.locationId.trim())) throw new Error('La ubicación debe ser el id numérico de un lugar de Facebook')
    out.locationId = b.locationId.trim()
  }
  if (typeof b.shareToFeed === 'boolean') out.shareToFeed = b.shareToFeed
  if (b.trialGraduation === 'MANUAL' || b.trialGraduation === 'SS_PERFORMANCE') out.trialGraduation = b.trialGraduation
  if (typeof b.aiLabel === 'boolean') out.aiLabel = b.aiLabel
  // What is drawn on screen is exactly what was saved and reviewed: over the limit it is refused, never cut
  if (typeof b.storyText === 'string' && b.storyText.trim()) {
    if (b.storyText.trim().length > SCREEN_TEXT_MAX) throw new Error(`El titular en pantalla admite hasta ${SCREEN_TEXT_MAX} caracteres (mejor 60)`)
    out.storyText = b.storyText.trim()
  }
  if (typeof b.storyCta === 'string' && b.storyCta.trim()) {
    if (b.storyCta.trim().length > SCREEN_CTA_MAX) throw new Error(`La llamada a la acción en pantalla admite hasta ${SCREEN_CTA_MAX} caracteres (mejor 25)`)
    out.storyCta = b.storyCta.trim()
  }
  if (typeof b.renderText === 'boolean') out.renderText = b.renderText
  return Object.keys(out).length ? out : null
}

/** Stored JSON back to options (never throws: a bad stored value is ignored). */
export function readPublishOptions(raw: unknown): PublishOptions {
  try {
    return sanitizePublishOptions(raw) ?? {}
  } catch {
    // Saved before a limit existed: the other options must not be lost, the long texts are cut
    try {
      const o = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}
      if (typeof o.storyText === 'string') o.storyText = o.storyText.slice(0, SCREEN_TEXT_MAX)
      if (typeof o.storyCta === 'string') o.storyCta = o.storyCta.slice(0, SCREEN_CTA_MAX)
      return sanitizePublishOptions(o) ?? {}
    } catch {
      return {}
    }
  }
}

/** Format a variant publishes as: the chosen one, else inferred from the media. */
export function resolveFormat(channel: 'FACEBOOK' | 'INSTAGRAM', format: string | null | undefined, media: Array<{ kind: 'image' | 'video' }>): IgFormat | FbFormat {
  if (channel === 'FACEBOOK') return (FB_FORMATS as readonly string[]).includes(format || '') ? (format as FbFormat) : 'post'
  if ((IG_FORMATS as readonly string[]).includes(format || '')) return format as IgFormat
  if (media.length > 1) return 'carousel'
  return media[0]?.kind === 'video' ? 'reel' : 'feed'
}

export const isStory = (format: string | null | undefined) => format === 'story'
export const isReel = (format: string | null | undefined) => format === 'reel' || format === 'trial_reel'
