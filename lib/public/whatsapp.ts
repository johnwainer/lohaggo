/**
 * WhatsApp is the main channel: every public link opens a chat with a prefilled message that ends in a
 * `(ref: …)` tag, so the team (and the AI agent) knows where the visitor came from.
 */

export function waHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

export function withRef(message: string, ref: string) {
  return `${message} (ref: ${ref})`
}

export const HOME_WA_MESSAGE = withRef('Hola, necesito un servicio en Medellín', 'web-home')

export function serviceWaMessage(serviceName: string, slug: string) {
  return withRef(`Hola, quiero pedir ${serviceName}`, `web-${slug}`)
}

export function blogWaMessage(slug: string, serviceName?: string | null) {
  return withRef(serviceName ? `Hola, leí su artículo y quiero pedir ${serviceName}` : 'Hola, leí su artículo y necesito un servicio', `blog-${slug}`)
}

export function searchWaMessage(term: string) {
  return withRef(`Hola, necesito ayuda con: ${term.trim()}`, 'web-search')
}

/** Routes where the floating button would duplicate a page CTA, cover a form, or where it doesn't belong. */
const HIDDEN_PREFIXES = [
  '/admin', '/partner', '/dashboard', '/login', '/register', '/registro-socios', '/unete',
  '/olvide-mi-contrasena', '/restablecer-contrasena', '/auth', '/profile', '/notifications', '/my-ratings',
  '/servicios/',
]

function matches(pathname: string, prefix: string) {
  if (prefix.endsWith('/')) return pathname.startsWith(prefix)
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Message and ref for the floating button on a route; null hides it there. */
export function floatingWaContext(pathname: string): { message: string; ref: string } | null {
  const path = (pathname || '/').split('?')[0]
  if (HIDDEN_PREFIXES.some((p) => matches(path, p))) return null
  if (path === '/') return { message: HOME_WA_MESSAGE, ref: 'web-home' }
  const blog = path.match(/^\/blog\/([^/]+)/)
  if (blog) return { message: blogWaMessage(blog[1]), ref: `blog-${blog[1]}` }
  const city = path.match(/^\/ciudad\/([^/]+)/)
  if (city) return { message: withRef('Hola, necesito un servicio', `web-ciudad-${city[1]}`), ref: `web-ciudad-${city[1]}` }
  const segment = path.split('/').filter(Boolean)[0] ?? 'home'
  const ref = `web-${segment}`
  return { message: withRef('Hola, necesito un servicio en Medellín', ref), ref }
}
