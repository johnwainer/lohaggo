/**
 * Enlaces internos automáticos en los artículos del blog: la primera vez que el texto nombra un servicio (o «plomero»),
 * una zona o el precio de referencia, lo enlaza a la página que convierte. Se aplica al mostrar el artículo, así que
 * sirve también a los ya publicados y no toca lo que se guardó. Puro.
 *
 * Nunca enlaza dentro de títulos, código, enlaces o imágenes que ya existen; un destino se enlaza una sola vez y, si el
 * autor ya lo enlazó, no se repite. Tope de enlaces por artículo para que sigan siendo útiles y no un mar azul.
 */
import { TRADE_TERMS } from '@/lib/seo/agent/keywords-core'

export const MAX_AUTO_LINKS = 5

export type LinkRule = { url: string; phrases: string[]; priority: number }
export type LinkService = { slug: string; name: string }
export type LinkZone = { key: string; name: string }

export type LinkContext = {
  services: LinkService[]
  /** El servicio del que trata el artículo, si se sabe: sus enlaces van primero */
  ownServiceSlug?: string | null
  priceSlugs: string[]
  /** Zonas con página de «servicio + zona» para el servicio del artículo */
  zones: LinkZone[]
  zonePath: (serviceSlug: string, zoneKey: string) => string
}

const PRICE_PHRASES = ['precio de referencia', 'precios de referencia', 'rango de precios', 'rango típico']

/** Mismo largo que el original: quita tildes y pasa a minúsculas letra por letra, para poder usar los índices del texto real. */
export function fold(s: string): string {
  return s.split('').map((c) => (c.normalize('NFD')[0] ?? c).toLowerCase()).join('')
}

export function buildRules(ctx: LinkContext): LinkRule[] {
  const rules: LinkRule[] = []
  const own = ctx.ownServiceSlug ?? null
  const ownSvc = ctx.services.find((s) => s.slug === own)
  for (const s of ctx.services) {
    const isOwn = s.slug === own
    const phrases = [s.name]
    const person = TRADE_TERMS[s.slug]?.person
    if (person) phrases.push(person)
    rules.push({ url: `/servicios/${s.slug}`, phrases, priority: isOwn ? 1 : 4 })
  }
  if (own && ctx.priceSlugs.includes(own)) rules.push({ url: `/precios/${own}`, phrases: PRICE_PHRASES, priority: 2 })
  else rules.push({ url: '/precios', phrases: PRICE_PHRASES, priority: 5 })
  rules.push({ url: '/precios/indice', phrases: ['índice de precios'], priority: 5 })
  if (ownSvc) for (const z of ctx.zones) rules.push({ url: ctx.zonePath(ownSvc.slug, z.key), phrases: [z.name], priority: 3 })
  return rules
}

type Span = [number, number]

/** Partes de una línea donde no se enlaza: enlaces e imágenes markdown, URLs sueltas, código, HTML. */
function protectedSpans(line: string): Span[] {
  const spans: Span[] = []
  for (const re of [/!?\[[^\]]*\]\([^)]*\)/g, /https?:\/\/\S+/g, /`[^`]*`/g, /<[^>]+>/g]) {
    for (const m of Array.from(line.matchAll(re))) spans.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
  }
  return spans
}

const isLetter = (c: string | undefined) => !!c && /[a-z0-9ñ]/i.test(c)
const PLURAL = /^(?:es|s)/

/** Primera aparición de la frase como palabra completa (con plural), fuera de las partes protegidas. */
function findPhrase(line: string, folded: string, phrase: string, spans: Span[]): Span | null {
  const needle = fold(phrase)
  if (needle.length < 4) return null
  let from = 0
  for (;;) {
    const at = folded.indexOf(needle, from)
    if (at === -1) return null
    from = at + 1
    const before = folded[at - 1]
    let end = at + needle.length
    if (isLetter(before)) continue
    const rest = folded.slice(end)
    const plural = rest.match(PLURAL)?.[0]
    if (plural && !isLetter(rest[plural.length])) end += plural.length
    else if (isLetter(folded[end])) continue
    if (spans.some(([a, b]) => at < b && end > a)) continue
    return [at, end]
  }
}

export function autoLinkMarkdown(body: string, rules: LinkRule[], opts: { max?: number } = {}): string {
  const max = opts.max ?? MAX_AUTO_LINKS
  const already = new Set<string>()
  for (const m of Array.from(body.matchAll(/\]\((\/[^)\s]*)\)/g))) already.add(m[1].replace(/[?#].*$/, '').replace(/\/$/, ''))
  const pending = rules
    .filter((r) => !already.has(r.url))
    .sort((a, b) => a.priority - b.priority)

  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const done = new Set<string>()
  let used = 0
  let fence = false

  for (const rule of pending) {
    if (used >= max) break
    for (let i = 0; i < lines.length && !done.has(rule.url); i++) {
      const line = lines[i]
      if (/^```/.test(line.trim())) { fence = !fence; continue }
      if (fence || /^\s*#{1,6}\s/.test(line) || !line.trim()) continue
      const folded = fold(line)
      const spans = protectedSpans(line)
      for (const phrase of rule.phrases) {
        const hit = findPhrase(line, folded, phrase, spans)
        if (!hit) continue
        lines[i] = `${line.slice(0, hit[0])}[${line.slice(hit[0], hit[1])}](${rule.url})${line.slice(hit[1])}`
        done.add(rule.url)
        used++
        break
      }
    }
    fence = false
  }
  return lines.join('\n')
}
