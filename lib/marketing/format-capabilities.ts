/**
 * What each Meta account can publish and measure, per format, from the scopes its token was granted.
 * Pure: shown in Admin → Canales and read by Haggo. `ready` = the publisher already supports it.
 */
import type { MetaChannel } from '@/lib/messaging/meta-graph'

export type FormatKey = 'feed' | 'carousel' | 'reel' | 'trial_reel' | 'story' | 'post'

type FormatSpec = { key: FormatKey; label: string; note: string; ready: boolean }

export const META_FORMATS: Record<MetaChannel, FormatSpec[]> = {
  INSTAGRAM: [
    { key: 'feed', label: 'Foto', note: 'JPEG, 4:5 a 1.91:1', ready: true },
    { key: 'carousel', label: 'Carrusel', note: '2 a 10 fotos o videos', ready: true },
    { key: 'reel', label: 'Reel', note: '3 s a 15 min, 9:16', ready: true },
    { key: 'trial_reel', label: 'Reel de prueba', note: 'Solo lo ven quienes no siguen la cuenta', ready: true },
    { key: 'story', label: 'Historia', note: 'Foto o video hasta 60 s; sin texto ni enlaces', ready: true },
  ],
  MESSENGER: [
    { key: 'post', label: 'Publicación', note: 'Texto, enlace, fotos o video', ready: true },
    { key: 'reel', label: 'Reel', note: '3 a 90 s, 9:16; 30 al día', ready: true },
    { key: 'story', label: 'Historia', note: 'Foto o video hasta 60 s', ready: true },
  ],
}

/** Scopes Meta requires to publish (Facebook Login for Business) and to read statistics, per channel. */
export const FORMAT_SCOPES: Record<MetaChannel, { publish: string[]; measure: string[] }> = {
  INSTAGRAM: { publish: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'], measure: ['instagram_manage_insights'] },
  MESSENGER: { publish: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'], measure: ['read_insights'] },
}

export type FormatCapability = {
  key: FormatKey
  label: string
  note: string
  ready: boolean
  /** null = the token's scopes could not be read */
  canPublish: boolean | null
  canMeasure: boolean | null
  missing: string[]
}

export function formatCapabilities(channel: MetaChannel, granted: string[] | null | undefined): FormatCapability[] {
  const scopes = FORMAT_SCOPES[channel]
  const lacks = (need: string[]) => (granted ? need.filter((s) => !granted.includes(s)) : [])
  const missPublish = lacks(scopes.publish)
  const missMeasure = lacks(scopes.measure)
  return META_FORMATS[channel].map((f) => ({
    ...f,
    canPublish: granted ? missPublish.length === 0 : null,
    canMeasure: granted ? missMeasure.length === 0 : null,
    missing: Array.from(new Set([...missPublish, ...missMeasure])),
  }))
}

/** One line for Haggo and the channel card. */
export function formatSummary(channel: MetaChannel, caps: FormatCapability[]) {
  const name = channel === 'INSTAGRAM' ? 'Instagram' : 'Facebook'
  if (caps.every((c) => c.canPublish === null)) return `${name}: no se pudieron leer los permisos del token`
  const publish = caps.filter((c) => c.canPublish).map((c) => `${c.label}${c.ready ? '' : ' (falta código)'}`)
  const missing = Array.from(new Set(caps.flatMap((c) => c.missing)))
  const measure = caps.some((c) => c.canMeasure) ? 'con estadísticas' : 'sin permiso de estadísticas'
  return `${name}: publica ${publish.join(', ') || 'nada'}; ${measure}${missing.length ? `; faltan ${missing.join(', ')}` : ''}`
}
