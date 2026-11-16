/**
 * The keywords that bring clients: «plomero en Medellín», «cerrajero Medellín». For each service with partners and
 * each open city, the words people really type (the trade person, not only the service name), the angles of the
 * supporting articles that push the service page up, and a tracker over Search Console data. Pure.
 */
import type { GscRow } from '@/lib/seo/agent/types'

/** Slug of the service → how people name who does it. Services missing here use their own name. */
export const TRADE_TERMS: Record<string, { person: string; emergency?: boolean }> = {
  plomeria: { person: 'plomero', emergency: true },
  electricidad: { person: 'electricista', emergency: true },
  cerrajeria: { person: 'cerrajero', emergency: true },
  pintura: { person: 'pintor' },
  carpinteria: { person: 'carpintero' },
  jardineria: { person: 'jardinero' },
  fumigacion: { person: 'fumigador' },
  herreria: { person: 'herrero' },
  soldadura: { person: 'soldador' },
  masajes: { person: 'masajista' },
  'manicure-pedicure': { person: 'manicurista' },
  peluqueria: { person: 'peluquero a domicilio' },
  barberia: { person: 'barbero a domicilio' },
  veterinaria: { person: 'veterinario a domicilio' },
  'paseo-perros': { person: 'paseador de perros' },
  fotografia: { person: 'fotógrafo' },
  enfermeria: { person: 'enfermera a domicilio' },
  fisioterapia: { person: 'fisioterapeuta a domicilio' },
  psicologia: { person: 'psicólogo' },
  'entrenador-personal': { person: 'entrenador personal' },
  'mecanica-domicilio': { person: 'mecánico a domicilio' },
  'reparacion-aires': { person: 'técnico de aires acondicionados' },
  'reparacion-neveras': { person: 'técnico de neveras' },
  'reparacion-lavadoras': { person: 'técnico de lavadoras' },
  'reparacion-electrodomesticos': { person: 'técnico de electrodomésticos' },
  'reparacion-computadoras': { person: 'técnico de computadores' },
  'reparacion-calentadores': { person: 'técnico de calentadores', emergency: true },
  'instalacion-gas': { person: 'instalador de gas', emergency: true },
  'instalacion-tv': { person: 'instalador de TV' },
  'instalacion-camaras': { person: 'instalador de cámaras de seguridad' },
  'limpieza-hogar': { person: 'servicio de limpieza' },
  mudanzas: { person: 'mudanzas' },
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Plomero» for the title of /servicios/plomeria; null when people search the service name itself. */
export function tradeTitle(slug: string): string | null {
  const t = TRADE_TERMS[slug]
  return t ? cap(t.person) : null
}

/** The term people type for a service: the trade person when known, else the service name in lowercase. */
export function searchTerm(slug: string, serviceName: string): string {
  return TRADE_TERMS[slug]?.person ?? serviceName.toLowerCase()
}

export type Angle = { id: string; label: string; keyword: (term: string, city: string) => string; covers: RegExp; weight: number; onlyEmergency?: boolean }

/** Supporting articles: each attacks one long-tail search and links to the service page. Best first. */
export const ANGLES: Angle[] = [
  { id: 'precio', label: 'Precio', keyword: (t, c) => `cuánto cuesta un ${t} en ${c}`, covers: /cu[aá]nto|precio|tarifa|cobra|costo|valor/i, weight: 1 },
  { id: 'guia', label: 'Cómo contratar', keyword: (t, c) => `${t} en ${c}`, covers: /contratar|gu[ií]a|elegir|encontrar|c[oó]mo/i, weight: 0.95 },
  { id: 'urgente', label: 'Urgencia', keyword: (t, c) => `${t} urgente en ${c}`, covers: /urgente|emergencia|24 ?horas|ya\b|hoy/i, weight: 0.9, onlyEmergency: true },
  { id: 'cerca', label: 'Cerca de ti', keyword: (t, c) => `${t} cerca de mí en ${c}`, covers: /cerca|barrio|zona|comuna|sector/i, weight: 0.8 },
  { id: 'senales', label: 'Señales y problemas', keyword: (t) => `cuándo llamar a un ${t}`, covers: /cu[aá]ndo|se[ñn]ales|s[ií]ntomas|problemas?/i, weight: 0.7 },
  { id: 'errores', label: 'Errores y consejos', keyword: (t) => `errores al contratar un ${t}`, covers: /errores|consejos|trucos|evitar/i, weight: 0.6 },
]

export function anglesFor(slug: string) {
  const emergency = Boolean(TRADE_TERMS[slug]?.emergency)
  return ANGLES.filter((a) => !a.onlyEmergency || emergency)
}

/** Keywords of one service in one city that the tracker follows (the money keywords). */
export function trackedKeywords(slug: string, serviceName: string, city: string) {
  const term = searchTerm(slug, serviceName)
  const out = [`${term} en ${city}`, `${term} a domicilio en ${city}`, `${term} cerca de mí`]
  if (TRADE_TERMS[slug]?.emergency) out.push(`${term} urgente en ${city}`)
  return out
}

/** Whether a Search Console query is about this service (its term or its name) in this city or «near me». */
export function queryMatches(query: string, slug: string, serviceName: string, city: string): boolean {
  const q = norm(query)
  const terms = [searchTerm(slug, serviceName), serviceName].map(norm)
  const about = terms.some((t) => q.includes(t) || (t.endsWith('s') ? false : q.includes(`${t}s`)))
  if (!about) return false
  return q.includes(norm(city)) || /cerca|domicilio/.test(q)
}

export type KeywordRow = { service: string; slug: string; city: string; keyword: string; impressions: number; clicks: number; position: number | null; page: string | null; onServicePage: boolean }

/**
 * Where each service+city stands in Google: impressions, clicks, average position (weighted by impressions) and
 * the page that shows up. Services with no data come out with position null (not in Google for those words).
 */
export function trackKeywords(
  services: Array<{ slug: string; name: string }>,
  cities: Array<{ name: string }>,
  rows: GscRow[],
): KeywordRow[] {
  const out: KeywordRow[] = []
  for (const s of services) {
    for (const c of cities) {
      const hits = rows.filter((r) => queryMatches(r.query, s.slug, s.name, c.name))
      const impressions = hits.reduce((a, r) => a + r.impressions, 0)
      const clicks = hits.reduce((a, r) => a + r.clicks, 0)
      const position = impressions ? hits.reduce((a, r) => a + r.position * r.impressions, 0) / impressions : null
      const byPage = new Map<string, number>()
      for (const r of hits) {
        let p = r.page
        try { p = new URL(r.page).pathname.replace(/\/$/, '') || '/' } catch { /* keep */ }
        byPage.set(p, (byPage.get(p) ?? 0) + r.impressions)
      }
      const page = Array.from(byPage.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      out.push({ service: s.name, slug: s.slug, city: c.name, keyword: trackedKeywords(s.slug, s.name, c.name)[0], impressions, clicks, position: position == null ? null : Math.round(position * 10) / 10, page, onServicePage: page === `/servicios/${s.slug}` })
    }
  }
  return out
}

/** The weekly focus for marketing, from the tracker: what to push and with which exact words. No model. */
export function focusLines(rows: KeywordRow[], max = 5): string[] {
  const worst = [...rows]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.impressions - b.impressions)
    .reverse()
    .slice(0, max)
  return worst.map((r) => `«${r.keyword}»: ${r.position == null ? 'todavía no aparece en Google' : `posición ${r.position.toFixed(0)} con ${r.impressions} impresiones${r.onServicePage ? '' : ' (y no sale la página del servicio)'}`}. Usa esas palabras exactas en títulos, primera línea y hashtags, y enlaza a /servicios/${r.slug}.`)
}
