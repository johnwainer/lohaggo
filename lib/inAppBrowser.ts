/**
 * Detection for in-app browsers (webviews embedded inside other apps).
 * ~1/3 of traffic arrives from the Facebook/Instagram in-app browser, where
 * file pickers, geolocation, OAuth popups and some JS APIs behave erratically.
 */

const IN_APP_UA_MARKERS = [
  'FBAN', 'FBAV', 'FB_IAB', 'FBIOS', // Facebook
  'Instagram',
  'Messenger',
  'Line/',
  'Twitter',
  'TikTok', 'musical_ly', 'BytedanceWebview',
  'GSA/', // Google Search App
  'Snapchat',
  'WhatsApp',
  'Pinterest',
]

export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!ua) return false
  return IN_APP_UA_MARKERS.some((marker) => ua.includes(marker))
}

export function isMetaInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!ua) return false
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram/.test(ua)
}

export function isAndroid(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /Android/i.test(ua)
}

/**
 * Best-effort attempt to escape the in-app webview into the system browser.
 * On Android we can use an `intent:` URL; on iOS there is no programmatic
 * escape, so callers should fall back to copy-link + instructions.
 */
export function buildExternalIntentUrl(url: string): string | null {
  if (typeof window === 'undefined') return null
  if (!isAndroid()) return null
  try {
    const u = new URL(url)
    const host = u.host + u.pathname + u.search + u.hash
    return `intent://${host}#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;end`
  } catch {
    return null
  }
}
