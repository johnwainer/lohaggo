/**
 * Google Search Console, read-only, with the same service account GA4 already uses (Analytics → Conexiones).
 * The account only needs to be added as a user of the property in Search Console. No key, no setup if it is
 * not there: every failure comes back as a readable state, never throws into the cycle.
 */
import { accessToken, getGa4Settings } from '@/lib/analytics/ga4'
import type { GscRow } from '@/lib/seo/agent/types'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export type GscResult =
  | { ok: true; rows: GscRow[]; days: number; from: string; to: string }
  | { ok: false; reason: 'no_account' | 'no_access' | 'error'; message: string; serviceEmail?: string | null }

export type PageTotal = { path: string; clicks: number; impressions: number }
export type Inspection = { path: string; verdict: string; coverage: string; lastCrawl: string | null; googleCanonical: string | null }

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Search Console data lags about two days: the window ends there. */
export async function fetchSearchConsole(siteUrl: string, days = 28, now = new Date()): Promise<GscResult> {
  const { account } = await getGa4Settings()
  if (!account) return { ok: false, reason: 'no_account', message: 'Falta la cuenta de servicio de Google (Analítica → Conexiones). Es la misma que usa GA4.' }
  try {
    const token = await accessToken(account, SCOPE)
    const to = new Date(now.getTime() - 2 * 86_400_000)
    const from = new Date(to.getTime() - (days - 1) * 86_400_000)
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: isoDay(from), endDate: isoDay(to), dimensions: ['query', 'page'], rowLimit: 2000, dataState: 'final' }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 403 || res.status === 404) {
      return { ok: false, reason: 'no_access', serviceEmail: account.client_email, message: `Search Console no deja leer «${siteUrl}»: agrega ${account.client_email} como usuario de la propiedad (Configuración → Usuarios y permisos) o revisa que el sitio esté escrito igual que allá (sc-domain:lohaggo.com o https://www.lohaggo.com/).` }
    }
    if (!res.ok) return { ok: false, reason: 'error', message: `Search Console: ${data?.error?.message || res.status}` }
    const rows: GscRow[] = ((data.rows ?? []) as Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>)
      .filter((r) => r.keys?.length >= 2)
      .map((r) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
    return { ok: true, rows, days, from: isoDay(from), to: isoDay(to) }
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message.slice(0, 300) : 'Search Console no respondió' }
  }
}

const pathOf = (url: string) => {
  try { return new URL(url).pathname.replace(/\/$/, '') || '/' } catch { return url }
}

/**
 * Totals per page, without the query dimension. The query+page report leaves out anonymized queries, so a page
 * that Google shows only for rare searches looks like «zero impressions» there. Totals come from here.
 */
export async function fetchPageTotals(siteUrl: string, days = 28, now = new Date()): Promise<PageTotal[] | null> {
  const { account } = await getGa4Settings()
  if (!account) return null
  try {
    const token = await accessToken(account, SCOPE)
    const to = new Date(now.getTime() - 2 * 86_400_000)
    const from = new Date(to.getTime() - (days - 1) * 86_400_000)
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: isoDay(from), endDate: isoDay(to), dimensions: ['page'], rowLimit: 1000, dataState: 'final' }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return ((data.rows ?? []) as Array<{ keys: string[]; clicks: number; impressions: number }>).filter((r) => r.keys?.length).map((r) => ({ path: pathOf(r.keys[0]), clicks: r.clicks, impressions: r.impressions }))
  } catch {
    return null
  }
}

/**
 * Asks Google whether each URL is in its index (URL Inspection API, read only: it can inspect but not request
 * indexing). Four at a time; a URL that cannot be read is left out, never guessed.
 */
export async function inspectUrls(siteUrl: string, urls: string[], deadline = Date.now() + 60_000): Promise<Inspection[]> {
  const { account } = await getGa4Settings()
  if (!account || !urls.length) return []
  let token: string
  try { token = await accessToken(account, SCOPE) } catch { return [] }
  const out: Inspection[] = []
  let i = 0
  const worker = async () => {
    while (i < urls.length && Date.now() < deadline) {
      const url = urls[i++]
      try {
        const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: 'es' }),
        })
        if (!res.ok) continue
        const data = await res.json().catch(() => null)
        const r = data?.inspectionResult?.indexStatusResult
        if (!r) continue
        out.push({ path: pathOf(url), verdict: String(r.verdict ?? 'VERDICT_UNSPECIFIED'), coverage: String(r.coverageState ?? ''), lastCrawl: r.lastCrawlTime ?? null, googleCanonical: r.googleCanonical ?? null })
      } catch { /* skip this URL */ }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return out
}
