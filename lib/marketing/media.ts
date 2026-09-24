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

export function deliveryUrl(channel: MarketingChannel, url: string, media: MediaInfo) {
  if (!isCloudinaryUrl(url)) return url
  if (media.kind === 'video') {
    // Networks want H.264 + AAC in an MP4 container
    return channel === 'WEB' ? url : withTransform(url, 'vc_h264,ac_aac,q_auto', 'mp4')
  }
  if (channel === 'INSTAGRAM') {
    const L = LIMITS.INSTAGRAM
    const ratio = media.width && media.height ? media.width / media.height : null
    // Out-of-range aspect ratios are padded (never cropped: the person's image stays whole)
    const pad = ratio && ratio < L.imageMinRatio ? ',c_pad,ar_4:5,b_white' : ratio && ratio > L.imageMaxRatio ? ',c_pad,ar_191:100,b_white' : ''
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

/** Poster frame of a video, for previews in the admin and the calendar. */
export function videoPosterUrl(url: string) {
  const m = url.match(CLOUDINARY_UPLOAD)
  if (!m || m[2] !== 'video') return null
  return withTransform(url, 'so_1,w_600,c_limit', 'jpg')
}
