/**
 * Only internal paths ('/x...') are accepted as a post-login/registration destination. Anything that a browser
 * could read as another origin (//host, /\host, schemes, control characters) falls back.
 */
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || typeof raw !== 'string') return fallback
  const url = raw.trim()
  if (!url.startsWith('/')) return fallback
  if (url.startsWith('//') || url.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f\\]/.test(url)) return fallback
  try {
    const parsed = new URL(url, 'https://internal.invalid')
    if (parsed.origin !== 'https://internal.invalid') return fallback
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return fallback
  }
}

/** '/login?redirect=…' or '/register?redirect=…' with the destination encoded (it may carry its own query). */
export function withRedirect(base: string, destination: string | null | undefined): string {
  const safe = safeInternalPath(destination, '')
  if (!safe) return base
  return `${base}${base.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(safe)}`
}
