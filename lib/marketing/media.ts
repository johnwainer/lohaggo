/**
 * Media delivery per network. Files live in Cloudinary; each network gets a URL with the
 * transformation that makes it acceptable (Instagram: JPEG, ≤1440 px, aspect 4:5–1.91:1; video: MP4
 * H.264/AAC). The original file is never modified. Pure.
 */
import { LIMITS, type MarketingChannel, type MediaInfo } from '@/lib/marketing/channel-rules'

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/)(.+)$/

export function isCloudinaryUrl(url: string) {
  return CLOUDINARY_UPLOAD.test(url)
}

function withTransform(url: string, transform: string, ext?: string) {
  const m = url.match(CLOUDINARY_UPLOAD)
  if (!m) return url
  let rest = m[3]
  if (ext) rest = rest.replace(/\.[a-z0-9]+$/i, '') + `.${ext}`
  return `${m[1]}${transform}/${rest}`
}

export function deliveryUrl(channel: MarketingChannel, url: string, media: MediaInfo, format?: string | null, options?: ScreenTextOptions | null) {
  if (!isCloudinaryUrl(url)) return url
  const vertical = channel !== 'WEB' && (format === 'story' || format === 'reel' || format === 'trial_reel')
  const overlay = vertical ? screenOverlay(options) : ''
  if (media.kind === 'video' && isStillVideo(url)) {
    // A photo turned into a short vertical video (slow zoom), with the text on screen
    return withTransform(url, `e_zoompan:du_${STILL_VIDEO_SEC};from_(g_auto;zoom_1.0);to_(g_auto;zoom_1.2)/c_fill,w_1080,h_1920${overlay}/f_mp4`, 'mp4')
  }
  if (media.kind === 'video') {
    if (channel === 'WEB') return url
    // Networks want H.264 + AAC in an MP4 container; reels and stories fill 9:16 and are kept short
    if (!vertical) return withTransform(url, 'vc_h264,ac_aac,q_auto', 'mp4')
    const max = format === 'story' ? 15 : 30
    const trim = media.durationSec && media.durationSec > max ? `,eo_${max}` : ''
    return withTransform(url, `c_fill,g_center,w_1080,h_1920${trim}${overlay}/vc_h264,ac_aac,q_auto`, 'mp4')
  }
  if (vertical) {
    // Text on screen: the photo fills the screen; otherwise the whole image fits and the rest takes its own color
    return overlay
      ? withTransform(url, `c_fill,g_auto,w_1080,h_1920${overlay}/f_jpg,q_90`, 'jpg')
      : withTransform(url, 'c_pad,w_1080,h_1920,b_auto,f_jpg,q_90', 'jpg')
  }
  if (channel === 'INSTAGRAM') {
    const L = LIMITS.INSTAGRAM
    const ratio = media.width && media.height ? media.width / media.height : null
    // Out-of-range aspect ratios are padded (never cropped: the person's image stays whole)
    // AI images come 2:3: cropped to 4:5 around the subject (no white bars); other images are padded whole
    const pad = ratio && ratio < L.imageMinRatio ? (media.source === 'ai' ? ',c_fill,g_auto,ar_4:5' : ',c_pad,ar_4:5,b_white') : ratio && ratio > L.imageMaxRatio ? ',c_pad,ar_191:100,b_white' : ''
    return withTransform(url, `c_limit,w_${L.imageMaxWidth}${pad},f_jpg,q_90`, 'jpg')
  }
  if (channel === 'FACEBOOK') return withTransform(url, 'c_limit,w_2048,q_auto:good')
  // Web: sized for the article column and for Open Graph
  return withTransform(url, 'c_limit,w_1600,f_auto,q_auto')
}

/** 1200×630 crop for Open Graph / Twitter cards. */
export function ogImageUrl(url: string | null | undefined) {
  if (!url) return null
  return isCloudinaryUrl(url) ? withTransform(url, 'c_fill,g_auto,w_1200,h_630,f_jpg,q_85', 'jpg') : url
}

// ─── Text on screen (stories and reels) ──────────────────────────────────────

export type ScreenTextOptions = { storyText?: string; storyCta?: string; renderText?: boolean }

/** Seconds of the video made from a photo (Meta asks reels of at least 3 s). */
export const STILL_VIDEO_SEC = 8

/** A «video» whose file is a photo: Cloudinary animates it on delivery. */
export const isStillVideo = (url: string) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)

const BRAND_BLUE = '1d4ed8'
const BRAND_ORANGE = 'ea580c'

const EMOJI_RE = new RegExp(String.raw`\p{Extended_Pictographic}|\uFE0F|\u200D`, 'gu')

/** Cloudinary text layers: commas, slashes and percent signs go double-escaped; emojis are not drawn. */
export function cloudinaryText(text: string) {
  const clean = text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
  return encodeURIComponent(clean).replace(/%25/g, '%2525').replace(/%2C/gi, '%252C').replace(/%2F/gi, '%252F')
}

/** The headline in a blue box and the call to action in an orange one, near the bottom (above the reply bar). */
export function screenOverlay(o: ScreenTextOptions | null | undefined) {
  if (!o?.renderText) return ''
  const head = o.storyText ? cloudinaryText(o.storyText.slice(0, 90)) : ''
  const cta = o.storyCta ? cloudinaryText(o.storyCta.slice(0, 40)) : ''
  let out = ''
  if (head) out += `/l_text:Montserrat_72_bold_center:${head},co_white,b_rgb:${BRAND_BLUE},bo_36px_solid_rgb:${BRAND_BLUE},w_880,c_fit/fl_layer_apply,g_south,y_${cta ? 560 : 420}`
  if (cta) out += `/l_text:Montserrat_52_bold_center:${cta},co_white,b_rgb:${BRAND_ORANGE},bo_28px_solid_rgb:${BRAND_ORANGE},w_880,c_fit/fl_layer_apply,g_south,y_360`
  return out
}

/** Poster frame of a video, for previews in the admin and the calendar. */
export function videoPosterUrl(url: string) {
  if (isStillVideo(url)) return withTransform(url, 'c_fill,g_auto,w_400,h_711', 'jpg')
  const m = url.match(CLOUDINARY_UPLOAD)
  if (!m || m[2] !== 'video') return null
  return withTransform(url, 'so_1,w_600,c_limit', 'jpg')
}
