/**
 * Do the AIs with web search recommend or cite LoHaggo when someone asks for a service in Medellín?
 * Pure: the question to the model lives in ai-visibility.ts; here we build the questions, read the answer
 * (text, search results, citations) and turn the gaps into growth opportunities.
 */
import { norm } from '@/lib/seo/agent/keywords-core'

export type AiProbeResult = {
  query: string
  answered: boolean
  mentioned: boolean
  cited: boolean
  ourUrls: string[]
  competitors: Array<{ host: string; count: number }>
  position: number | null
  excerpt: string
  error: string | null
}

export type AiVisibilityData = {
  checkedAt: string | null
  summary: { asked: number; mentioned: number; cited: number; topCompetitors: Array<{ host: string; count: number }> }
  results: Array<{ query: string; mentioned: boolean; cited: boolean; position: number | null; competitors: Array<{ host: string; count: number }>; excerpt: string; error: string | null }>
}

export type ProbeCandidate = {
  title: string
  detail: string
  keyword: string
  dedupeKey: string
  score: number
  impact: 'high' | 'medium'
  evidence: Record<string, unknown>
}

const OUR_HOST = 'lohaggo.com'
const MAX_COMPETITORS = 8

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const slugOf = (s: string) => norm(s).replace(/ /g, '-').slice(0, 60)

export function hostOf(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

const isOurHost = (h: string) => h === OUR_HOST || h.endsWith(`.${OUR_HOST}`)

/** Natural questions of a real customer from «service + city» keywords: varied forms, no duplicates, spread across services. */
export function buildProbeQueries(items: Array<{ keyword: string; service: string; city: string }>, max = 6): string[] {
  const byService = new Map<string, Array<{ keyword: string; service: string; city: string }>>()
  for (const it of items) {
    if (!it.keyword?.trim() || !it.service?.trim() || !it.city?.trim()) continue
    const list = byService.get(norm(it.service)) ?? []
    list.push(it)
    byService.set(norm(it.service), list)
  }
  const forms = [
    (term: string, _s: string, city: string) => `Necesito ${term} en ${city}, ¿a quién me recomiendas? Dame opciones con enlaces`,
    (_t: string, service: string, city: string) => `¿Cuánto cuesta ${service} en ${city}?`,
    (term: string, _s: string, city: string) => `${term} urgente en ${city}`,
  ]
  const lowerStart = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
  const out: string[] = []
  const seen = new Set<string>()
  const queues = Array.from(byService.values())
  let round = 0
  while (out.length < max && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (out.length >= max) break
      const it = q.shift()
      if (!it) continue
      const term = lowerStart(it.keyword.replace(new RegExp(`\\s+en\\s+${it.city}\\s*$`, 'i'), '').trim()) || lowerStart(it.service)
      const text = forms[(round + out.length) % forms.length](term, lowerStart(it.service), it.city)
      const key = norm(text)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(text)
    }
    round++
  }
  return out
}

/** Reads a Messages API response that used the web search tool. Tolerates unknown blocks and missing fields. */
export function parseProbe(response: unknown, query: string): AiProbeResult {
  const base: AiProbeResult = { query, answered: false, mentioned: false, cited: false, ourUrls: [], competitors: [], position: null, excerpt: '', error: null }
  const r = (response && typeof response === 'object' ? response : {}) as Json
  const blocks: unknown[] = Array.isArray(r.content) ? r.content : []
  const texts: string[] = []
  const sources: Array<{ url: string; title: string }> = [] // in order of appearance
  let searchError: string | null = null

  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue
    const b = raw as Json
    if (b.type === 'text' && typeof b.text === 'string') {
      texts.push(b.text)
      if (Array.isArray(b.citations)) {
        for (const c of b.citations) {
          if (c && typeof c === 'object' && typeof c.url === 'string') sources.push({ url: c.url, title: typeof c.title === 'string' ? c.title : '' })
        }
      }
    } else if (b.type === 'web_search_tool_result') {
      if (Array.isArray(b.content)) {
        for (const c of b.content) {
          if (c && typeof c === 'object' && typeof c.url === 'string') sources.push({ url: c.url, title: typeof c.title === 'string' ? c.title : '' })
        }
      } else if (b.content && typeof b.content === 'object' && typeof (b.content as Json).error_code === 'string') {
        searchError = String((b.content as Json).error_code)
      }
    }
  }

  const text = texts.join('').trim()
  const hosts: string[] = []
  const ours = new Set<string>()
  const counts = new Map<string, number>()
  let position: number | null = null
  for (const s of sources) {
    const h = hostOf(s.url)
    if (!h) continue
    if (!hosts.includes(h)) hosts.push(h)
    if (isOurHost(h)) {
      ours.add(s.url)
      if (position === null) position = hosts.length
    } else {
      counts.set(h, (counts.get(h) ?? 0) + 1)
    }
  }
  const competitors = Array.from(counts.entries())
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
    .slice(0, MAX_COMPETITORS)

  const plain = text.replace(/[*_#`>|]+/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
  return {
    ...base,
    answered: text.length > 0,
    mentioned: /lo\s?haggo/i.test(text),
    cited: ours.size > 0,
    ourUrls: Array.from(ours),
    competitors,
    position,
    excerpt: plain.slice(0, 240),
    error: text.length > 0 ? null : searchError ? `La búsqueda web falló (${searchError})` : null,
  }
}

export function summarizeProbes(rs: AiProbeResult[]): AiVisibilityData['summary'] {
  const counts = new Map<string, number>()
  for (const r of rs) for (const c of r.competitors) counts.set(c.host, (counts.get(c.host) ?? 0) + c.count)
  return {
    asked: rs.filter((r) => r.answered).length,
    mentioned: rs.filter((r) => r.mentioned).length,
    cited: rs.filter((r) => r.cited).length,
    topCompetitors: Array.from(counts.entries()).map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count || a.host.localeCompare(b.host)).slice(0, MAX_COMPETITORS),
  }
}

/** Growth opportunities for the questions where an AI answered and LoHaggo is neither cited nor named. */
export function probeCandidates(rs: AiProbeResult[]): ProbeCandidate[] {
  const out: ProbeCandidate[] = []
  for (const r of rs) {
    if (!r.answered || r.error || r.cited || r.mentioned) continue
    const who = r.competitors.slice(0, 3).map((c) => c.host)
    const list = who.length === 0 ? 'otras fuentes' : who.length === 1 ? who[0] : `${who.slice(0, -1).join(', ')} y ${who[who.length - 1]}`
    const emergency = /urgente|emergencia|24/i.test(r.query)
    out.push({
      title: `Las IA no nos recomiendan: «${r.query.slice(0, 80)}»`,
      detail: `Al preguntar «${r.query}» una IA con búsqueda recomienda a ${list} y no a LoHaggo. Reforzar: respuesta corta al inicio de /servicios/…, datos estructurados, reseñas, y artículos que respondan esa pregunta.`,
      keyword: r.query,
      dedupeKey: `aiprobe:${slugOf(r.query)}`,
      score: Math.min(80, 50 + who.length * 5 + (emergency ? 5 : 0)),
      impact: who.length >= 2 ? 'high' : 'medium',
      evidence: { query: r.query, competitors: r.competitors, excerpt: r.excerpt },
    })
  }
  return out
}
