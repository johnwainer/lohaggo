/**
 * What each channel accepts, checked while the person writes and again right before publishing.
 * Pure: no DB, no API. Limits from Meta's Graph API docs (Pages feed, Instagram Content Publishing)
 * and common SEO practice for the web article.
 */
import { isReel, resolveFormat, type PublishOptions } from '@/lib/marketing/publish-options'

export type MarketingChannel = 'WEB' | 'FACEBOOK' | 'INSTAGRAM'

export type MediaInfo = {
  kind: 'image' | 'video'
  mime?: string | null
  bytes?: number | null
  width?: number | null
  height?: number | null
  durationSec?: number | null
}

export type VariantInput = {
  body: string
  format?: string | null
  options?: PublishOptions | null
  linkUrl?: string | null
  media: MediaInfo[]
  // Web only
  title?: string | null
  slug?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  coverUrl?: string | null
}

export type Issue = { code: string; message: string; field?: string }
export type Validation = {
  ok: boolean
  errors: Issue[]
  warnings: Issue[]
  stats: { chars: number; hashtags: number; mentions: number; words: number }
}

const MB = 1024 * 1024

export const LIMITS = {
  INSTAGRAM: {
    caption: 2200,
    hashtags: 30,
    mentions: 20,
    carouselMin: 2,
    carouselMax: 10,
    imageBytes: 8 * MB,
    imageMinRatio: 4 / 5,
    imageMaxRatio: 1.91,
    imageMaxWidth: 1440,
    videoBytes: 300 * MB,
    reelMinSec: 3,
    reelMaxSec: 15 * 60,
    storyVideoBytes: 100 * MB,
    storyVideoMaxSec: 60,
  },
  FACEBOOK: {
    text: 63206,
    recommendedHashtags: 3,
    imageBytes: 10 * MB,
    imagesMax: 10,
    videoBytes: 1024 * MB,
    videoMaxSec: 240 * 60,
    reelMinSec: 3,
    reelMaxSec: 90,
    reelMinWidth: 540,
    reelMinHeight: 960,
    storyVideoMaxSec: 60,
  },
  WEB: {
    seoTitleMax: 60,
    seoDescriptionMin: 50,
    seoDescriptionMax: 160,
    minWords: 300,
  },
} as const

const HASHTAG_RE = /(^|[^\w&])#[A-Za-z0-9_\u00C0-\u024F]+/g
const MENTION_RE = /(^|[^\w])@[A-Za-z0-9._]+/g
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function countHashtags(text: string) {
  return (text.match(HASHTAG_RE) || []).length
}
export function countMentions(text: string) {
  return (text.match(MENTION_RE) || []).length
}
/** Characters as the networks count them (grapheme-ish: surrogate pairs count once). */
export function countChars(text: string) {
  return Array.from(text).length
}
export function countWords(text: string) {
  const plain = text.replace(/[#*_>`\[\]()!-]/g, ' ').trim()
  return plain ? plain.split(/\s+/).length : 0
}

const IG_IMAGE_MIMES = ['image/jpeg', 'image/jpg']
const FB_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']
const VIDEO_MIMES = ['video/mp4', 'video/quicktime']

const pct = (b: number) => `${Math.round(b / MB)} MB`

export function validateVariant(channel: MarketingChannel, v: VariantInput): Validation {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const err = (code: string, message: string, field?: string) => errors.push({ code, message, field })
  const warn = (code: string, message: string, field?: string) => warnings.push({ code, message, field })
  const body = v.body || ''
  const stats = { chars: countChars(body), hashtags: countHashtags(body), mentions: countMentions(body), words: countWords(body) }
  const images = v.media.filter((m) => m.kind === 'image')
  const videos = v.media.filter((m) => m.kind === 'video')

  if (channel === 'INSTAGRAM') {
    const L = LIMITS.INSTAGRAM
    const format = resolveFormat('INSTAGRAM', v.format, v.media)
    const story = format === 'story'
    if (stats.chars > L.caption) err('caption_length', `El texto tiene ${stats.chars} caracteres; Instagram permite ${L.caption}.`, 'body')
    if (stats.hashtags > L.hashtags) err('hashtags', `Tiene ${stats.hashtags} hashtags; Instagram permite ${L.hashtags}.`, 'body')
    if (stats.mentions > L.mentions) err('mentions', `Tiene ${stats.mentions} menciones; Instagram permite ${L.mentions}.`, 'body')
    if (!v.media.length) err('media_required', 'Instagram necesita al menos una imagen o un video.', 'media')
    if (format === 'carousel') {
      if (v.media.length < L.carouselMin) err('carousel_min', `Un carrusel necesita al menos ${L.carouselMin} elementos.`, 'media')
      if (v.media.length > L.carouselMax) err('carousel_max', `Un carrusel admite como máximo ${L.carouselMax} elementos.`, 'media')
    } else if (v.media.length > 1) {
      err('single_media', 'Este formato admite un solo archivo; usa «Carrusel» para varios.', 'media')
    }
    if (isReel(format) && !videos.length) err('reel_video', 'Un reel necesita un video.', 'media')
    if (format === 'feed' && videos.length) err('feed_image', 'Una foto del feed necesita una imagen; para video usa «Reel».', 'media')
    for (const m of images) {
      if (m.mime && !IG_IMAGE_MIMES.includes(m.mime)) warn('image_format', 'Instagram solo acepta JPEG: la imagen se convertirá automáticamente.', 'media')
      if (m.bytes && m.bytes > L.imageBytes) warn('image_size', `La imagen pesa ${pct(m.bytes)} (máx. ${pct(L.imageBytes)}): se comprimirá automáticamente.`, 'media')
      if (m.width && m.height && !story) {
        const r = m.width / m.height
        if (r < L.imageMinRatio - 0.01 || r > L.imageMaxRatio + 0.01) {
          warn('image_ratio', `La proporción ${m.width}×${m.height} está fuera de lo que admite Instagram (4:5 a 1.91:1): se ajustará con bordes.`, 'media')
        }
      }
    }
    for (const m of videos) {
      if (m.mime && !VIDEO_MIMES.includes(m.mime)) warn('video_format', 'El video se convertirá a MP4 (H.264).', 'media')
      const maxBytes = story ? L.storyVideoBytes : L.videoBytes
      if (m.bytes && m.bytes > maxBytes) err('video_size', `El video pesa ${pct(m.bytes)}; Instagram admite hasta ${pct(maxBytes)}${story ? ' en historias' : ''}.`, 'media')
      if (m.durationSec != null) {
        if (m.durationSec < L.reelMinSec) err('video_short', `El video dura ${m.durationSec.toFixed(1)} s; el mínimo es ${L.reelMinSec} s.`, 'media')
        if (story && m.durationSec > L.storyVideoMaxSec) err('video_long', `El video dura ${Math.round(m.durationSec)} s; una historia admite hasta ${L.storyVideoMaxSec} s.`, 'media')
        else if (m.durationSec > L.reelMaxSec) err('video_long', `El video dura ${Math.round(m.durationSec / 60)} min; el máximo es 15 min.`, 'media')
      }
    }
    if (story || isReel(format)) verticalWarning(v.media, warn)
    if (story) {
      if (body.trim()) warn('story_caption', 'Las historias no muestran texto: lo que quieras decir debe ir escrito en la imagen o el video.', 'body')
      if (!v.options?.storyText) warn('story_text', 'Anota el texto que lleva la historia (revisión editorial y resultados).', 'options')
      if (v.linkUrl) warn('story_link', 'Por API las historias no llevan enlaces ni stickers: pon el llamado a la acción en la imagen («Escríbenos por DM»).', 'linkUrl')
    } else {
      if (v.linkUrl) warn('ig_links', 'Los enlaces en el texto de Instagram no son clicables: ponlo en la bio o usa una historia.', 'linkUrl')
      if (!body.trim()) warn('empty_caption', 'Publicar sin texto reduce el alcance.', 'body')
    }
    if (format === 'trial_reel' && v.options?.collaborators?.length) warn('trial_collab', 'Los reels de prueba solo los ven quienes no siguen la cuenta; los colaboradores pueden no aplicarse.', 'options')
  }

  if (channel === 'FACEBOOK') {
    const L = LIMITS.FACEBOOK
    const format = resolveFormat('FACEBOOK', v.format, v.media)
    if (stats.chars > L.text) err('text_length', `El texto supera los ${L.text} caracteres que permite Facebook.`, 'body')
    if (format === 'reel') {
      if (videos.length !== 1 || images.length) err('reel_video', 'Un reel de Facebook necesita exactamente un video.', 'media')
      for (const m of videos) {
        if (m.durationSec != null && (m.durationSec < L.reelMinSec || m.durationSec > L.reelMaxSec)) err('reel_duration', `El video dura ${Math.round(m.durationSec)} s; un reel de Facebook debe durar entre ${L.reelMinSec} y ${L.reelMaxSec} s.`, 'media')
        if (m.width && m.height && Math.min(m.width, m.height) < L.reelMinWidth) err('reel_resolution', `El video es de ${m.width}×${m.height}; Facebook pide mínimo ${L.reelMinWidth}×${L.reelMinHeight}.`, 'media')
        if (m.bytes && m.bytes > L.videoBytes) err('video_size', `El video pesa ${pct(m.bytes)}; el máximo es ${pct(L.videoBytes)}.`, 'media')
      }
      verticalWarning(v.media, warn)
      if (v.linkUrl) warn('reel_link', 'Los reels no muestran la tarjeta del enlace: ponlo en el texto o en el perfil.', 'linkUrl')
    } else if (format === 'story') {
      if (v.media.length !== 1) err('story_media', 'Una historia de Facebook lleva exactamente una foto o un video.', 'media')
      for (const m of images) {
        if (m.mime && !FB_IMAGE_MIMES.includes(m.mime)) err('image_format', `Formato de imagen no admitido por Facebook (${m.mime}).`, 'media')
        if (m.bytes && m.bytes > L.imageBytes) warn('image_size', `La imagen pesa ${pct(m.bytes)} (máx. ${pct(L.imageBytes)}): se comprimirá automáticamente.`, 'media')
      }
      for (const m of videos) {
        if (m.durationSec != null && (m.durationSec < L.reelMinSec || m.durationSec > L.storyVideoMaxSec)) err('story_duration', `El video dura ${Math.round(m.durationSec)} s; una historia de Facebook debe durar entre ${L.reelMinSec} y ${L.storyVideoMaxSec} s.`, 'media')
      }
      verticalWarning(v.media, warn)
      if (body.trim()) warn('story_caption', 'Las historias no muestran texto: lo que quieras decir debe ir escrito en la imagen o el video.', 'body')
      if (!v.options?.storyText) warn('story_text', 'Anota el texto que lleva la historia (revisión editorial y resultados).', 'options')
      if (v.linkUrl) warn('story_link', 'Por API las historias no llevan enlaces: pon el llamado a la acción en la imagen.', 'linkUrl')
    } else {
      if (!body.trim() && !v.media.length && !v.linkUrl) err('empty', 'La publicación no tiene texto, enlace ni media.', 'body')
      if (videos.length && images.length) err('mixed_media', 'Facebook no permite mezclar imágenes y video en la misma publicación.', 'media')
      if (videos.length > 1) err('one_video', 'Facebook admite un solo video por publicación.', 'media')
      if (images.length > L.imagesMax) err('images_max', `Facebook admite como máximo ${L.imagesMax} imágenes por publicación.`, 'media')
      for (const m of images) {
        if (m.mime && !FB_IMAGE_MIMES.includes(m.mime)) err('image_format', `Formato de imagen no admitido por Facebook (${m.mime}).`, 'media')
        if (m.bytes && m.bytes > L.imageBytes) warn('image_size', `La imagen pesa ${pct(m.bytes)} (máx. ${pct(L.imageBytes)}): se comprimirá automáticamente.`, 'media')
      }
      for (const m of videos) {
        if (m.bytes && m.bytes > L.videoBytes) err('video_size', `El video pesa ${pct(m.bytes)}; el máximo para publicar por enlace es ${pct(L.videoBytes)}.`, 'media')
        if (m.durationSec != null && m.durationSec > L.videoMaxSec) err('video_long', 'Facebook admite videos de hasta 4 horas.', 'media')
      }
      if (v.linkUrl && v.media.length) warn('link_and_media', 'Con imagen o video, el enlace va dentro del texto y no se muestra la tarjeta de vista previa.', 'linkUrl')
    }
    if (stats.hashtags > L.recommendedHashtags) warn('hashtags', `En Facebook más de ${L.recommendedHashtags} hashtags suele restar alcance.`, 'body')
  }

  if (channel === 'WEB') {
    const L = LIMITS.WEB
    const title = (v.title || '').trim()
    if (!title) err('title', 'El artículo necesita un título.', 'title')
    if (!v.slug?.trim()) err('slug', 'Falta la URL (slug).', 'slug')
    else if (!SLUG_RE.test(v.slug)) err('slug_format', 'La URL solo puede tener minúsculas, números y guiones (ej. como-limpiar-un-sofa).', 'slug')
    if (!body.trim()) err('body', 'El artículo no tiene contenido.', 'body')
    else if (stats.words < L.minWords) warn('thin_content', `El artículo tiene ${stats.words} palabras; Google suele valorar mejor los de ${L.minWords} o más.`, 'body')
    const seoTitle = (v.seoTitle || title).trim()
    if (countChars(seoTitle) > L.seoTitleMax) warn('seo_title', `El título SEO tiene ${countChars(seoTitle)} caracteres; Google corta a partir de ~${L.seoTitleMax}.`, 'seoTitle')
    const desc = (v.seoDescription || '').trim()
    if (!desc) warn('seo_description', 'Sin meta descripción Google elegirá un fragmento del texto.', 'seoDescription')
    else if (countChars(desc) < L.seoDescriptionMin || countChars(desc) > L.seoDescriptionMax) {
      warn('seo_description_length', `La meta descripción tiene ${countChars(desc)} caracteres; lo ideal es entre ${L.seoDescriptionMin} y ${L.seoDescriptionMax}.`, 'seoDescription')
    }
    if (!v.coverUrl && !images.length) warn('og_image', 'Sin imagen de portada el enlace se verá sin imagen al compartirlo (Open Graph).', 'coverUrl')
    if (!/^#{2,3}\s/m.test(body) && stats.words >= L.minWords) warn('headings', 'Usa subtítulos (## ) para estructurar el artículo: ayuda a la lectura y al SEO.', 'body')
  }

  return { ok: errors.length === 0, errors, warnings, stats }
}

/** Instagram format inferred from the media when the person did not pick one. */
export function instagramFormat(format: string | null | undefined, media: MediaInfo[]) {
  return resolveFormat('INSTAGRAM', format, media) as 'feed' | 'carousel' | 'reel' | 'trial_reel' | 'story'
}

/** Reels and stories fill a 9:16 screen: anything else gets bars (images are padded to 9:16 automatically). */
function verticalWarning(media: MediaInfo[], warn: (code: string, message: string, field?: string) => void) {
  // Photos are fitted to 9:16 on delivery; a video keeps its shape and is cropped to fill
  const m = media.find((x) => x.kind === 'video' && x.width && x.height)
  if (!m) return
  const r = m.width! / m.height!
  if (Math.abs(r - 9 / 16) > 0.06) warn('vertical', `El video es de ${m.width}×${m.height}, no vertical 9:16: se recortará para llenar la pantalla y puede perder los bordes.`, 'media')
}
