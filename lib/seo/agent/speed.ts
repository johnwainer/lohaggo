/**
 * Measures page speed with the free PageSpeed Insights v5 API. Server only; never throws.
 * Each page takes 15-40 s in Google's lab, so this runs once a week, not on the daily cycle:
 * 7 pages at concurrency 2 is about 2 minutes. Without PAGESPEED_API_KEY the quota is low:
 * a 429 or any failure just becomes `error` on that page.
 */
import { SITE } from '@/lib/seo/agent/audit-core'
import { parsePsi, type SpeedResult } from '@/lib/seo/agent/speed-core'

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/** The pages that matter most (max 7) */
export function pickSpeedPaths(): string[] {
  return ['/', '/servicios', '/servicios/plomeria', '/servicios/electricidad', '/servicios/cerrajeria', '/ciudad/medellin', '/blog'].slice(0, 7)
}

async function measureOne(path: string): Promise<SpeedResult> {
  const url = `${SITE}${path === '/' ? '' : path}`
  const empty = (error: string): SpeedResult => ({ path, url, strategy: 'mobile', score: null, lcpMs: null, cls: null, tbtMs: null, fcpMs: null, field: null, error })
  try {
    const qs = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' })
    const key = process.env.PAGESPEED_API_KEY
    if (key) qs.set('key', key)
    const res = await fetch(`${PSI}?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
    if (res.status === 429) return empty('Cuota de PageSpeed agotada (429)')
    const json = await res.json().catch(() => null)
    if (!res.ok) return empty(`PageSpeed respondió ${res.status}${json?.error?.message ? `: ${String(json.error.message).slice(0, 100)}` : ''}`)
    return parsePsi(json, path, url)
  } catch (err) {
    return empty(`No se pudo medir: ${err instanceof Error ? err.message.slice(0, 80) : 'error'}`)
  }
}

/** Measures in order with limited concurrency; `deadline` (epoch ms) stops starting new pages and returns what it got. */
export async function measureSpeed(paths: string[], opts: { deadline?: number; concurrency?: number } = {}): Promise<SpeedResult[]> {
  const deadline = opts.deadline ?? Date.now() + 150_000
  const concurrency = Math.max(1, opts.concurrency ?? 2)
  const out: SpeedResult[] = []
  let i = 0
  const worker = async () => {
    while (i < paths.length && Date.now() < deadline) {
      out.push(await measureOne(paths[i++]))
    }
  }
  try {
    await Promise.all(Array.from({ length: concurrency }, worker))
  } catch {
    /* measureOne never throws */
  }
  return out
}
