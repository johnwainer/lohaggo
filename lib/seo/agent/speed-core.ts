/**
 * Core Web Vitals read from a PageSpeed Insights v5 response. Pure: the fetch lives in speed.ts.
 * Thresholds are Google's: LCP good <= 2500 ms / poor > 4000, CLS good <= 0.1 / poor > 0.25, INP good <= 200 / poor > 500.
 * Field data (real visitors, CrUX) wins over lab data (Lighthouse) metric by metric when it exists.
 */

export type SpeedField = { lcpMs: number | null; cls: number | null; inpMs: number | null; category: 'FAST' | 'AVERAGE' | 'SLOW' | null }

export type SpeedResult = {
  path: string
  url: string
  strategy: 'mobile'
  score: number | null
  lcpMs: number | null
  cls: number | null
  tbtMs: number | null
  fcpMs: number | null
  field: SpeedField | null
  error: string | null
  /** The 3 Lighthouse opportunities with the biggest estimated saving (titles as Lighthouse reports them) */
  opportunities?: SpeedOpportunity[]
}

export type SpeedOpportunity = { id: string; title: string; savingsMs: number }

export type SpeedCandidate = {
  path: string
  severity: 'critical' | 'warning'
  title: string
  detail: string
  dedupeKey: string
  score: number
  impact: 'high' | 'medium'
  evidence: Record<string, unknown>
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export const LIMITS = {
  lcpMs: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  inpMs: { good: 200, poor: 500 },
  score: { poor: 50, warn: 75 },
} as const

export function parsePsi(json: unknown, path: string, url = ''): SpeedResult {
  const j = (json && typeof json === 'object' ? json : {}) as Json
  const base: SpeedResult = { path, url: url || (typeof j.id === 'string' ? j.id : ''), strategy: 'mobile', score: null, lcpMs: null, cls: null, tbtMs: null, fcpMs: null, field: null, error: null }
  if (j.error) {
    return { ...base, error: String(j.error.message ?? 'Error de PageSpeed').slice(0, 160) }
  }
  const lh = j.lighthouseResult as Json | undefined
  if (!lh) return { ...base, error: 'Respuesta sin datos de Lighthouse' }
  if (lh.runtimeError?.message) return { ...base, error: String(lh.runtimeError.message).slice(0, 160) }

  const audits = (lh.audits ?? {}) as Json
  const rawScore = num(lh.categories?.performance?.score)
  const metric = (id: string) => num(audits[id]?.numericValue)

  const opportunities: SpeedOpportunity[] = Object.entries(audits)
    .map(([id, a]) => ({ id, title: String((a as Json)?.title ?? id), savingsMs: num((a as Json)?.details?.overallSavingsMs) ?? 0, type: (a as Json)?.details?.type }))
    .filter((o) => o.type === 'opportunity' && o.savingsMs > 0)
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 3)
    .map(({ id, title, savingsMs }) => ({ id, title, savingsMs: Math.round(savingsMs) }))

  const m = (j.loadingExperience?.metrics ?? null) as Json | null
  let field: SpeedField | null = null
  if (m) {
    const lcp = num(m.LARGEST_CONTENTFUL_PAINT_MS?.percentile)
    const clsRaw = num(m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile)
    const inp = num(m.INTERACTION_TO_NEXT_PAINT?.percentile)
    const cat = j.loadingExperience?.overall_category
    const category = cat === 'FAST' || cat === 'AVERAGE' || cat === 'SLOW' ? cat : null
    if (lcp != null || clsRaw != null || inp != null) field = { lcpMs: lcp, cls: clsRaw != null ? clsRaw / 100 : null, inpMs: inp, category }
  }

  return {
    ...base,
    score: rawScore != null ? Math.round(rawScore * 100) : null,
    lcpMs: metric('largest-contentful-paint'),
    cls: metric('cumulative-layout-shift'),
    tbtMs: metric('total-blocking-time'),
    fcpMs: metric('first-contentful-paint'),
    field,
    opportunities,
  }
}

type Rating = 'good' | 'ni' | 'poor'
const rate = (v: number, l: { good: number; poor: number }): Rating => (v <= l.good ? 'good' : v > l.poor ? 'poor' : 'ni')
const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',')
const clsTxt = (v: number) => v.toFixed(2).replace('.', ',')

type Problem = { metric: 'lcp' | 'cls' | 'inp' | 'score'; rating: Rating; text: string; fix: string }

/**
 * One candidate per page that has a real speed problem. Pages with an error or no numbers produce none.
 * With field data the verdict comes from the real-visitor metrics (falling back to lab per metric);
 * the overall Lighthouse score only judges a page that has no field data.
 */
export function speedCandidates(results: SpeedResult[]): SpeedCandidate[] {
  const out: SpeedCandidate[] = []
  for (const r of results) {
    if (r.error) continue
    const hasField = !!r.field
    const lcp = r.field?.lcpMs ?? r.lcpMs
    const cls = r.field?.cls ?? r.cls
    const inp = r.field?.inpMs ?? null
    const source = (fieldVal: number | null | undefined) => (hasField && fieldVal != null ? 'visitantes reales' : 'prueba de laboratorio')
    const problems: Problem[] = []

    if (lcp != null) {
      const rating = rate(lcp, LIMITS.lcpMs)
      if (rating !== 'good') problems.push({ metric: 'lcp', rating, text: `tarda ${sec(lcp)} s en mostrar lo principal (Google pide 2,5 s o menos; ${source(r.field?.lcpMs)})`, fix: 'revisar la imagen o el bloque principal de arriba: comprimirla, darle tamaño exacto y cargarla primero' })
    }
    if (cls != null) {
      const rating = rate(cls, LIMITS.cls)
      if (rating !== 'good') problems.push({ metric: 'cls', rating, text: `el contenido se mueve al cargar (CLS ${clsTxt(cls)}, Google pide 0,1 o menos; ${source(r.field?.cls)})`, fix: 'reservar el espacio de imágenes, banners y fuentes para que nada salte' })
    }
    if (inp != null) {
      const rating = rate(inp, LIMITS.inpMs)
      if (rating !== 'good') problems.push({ metric: 'inp', rating, text: `responde lento al tocar (${Math.round(inp)} ms, Google pide 200 ms o menos; visitantes reales)`, fix: 'revisar scripts de terceros y JavaScript que bloquea el hilo principal' })
    }
    if (!hasField && r.score != null && r.score < LIMITS.score.warn) {
      problems.push({ metric: 'score', rating: r.score < LIMITS.score.poor ? 'poor' : 'ni', text: `puntaje de velocidad en celular ${r.score}/100`, fix: 'revisar lo que Lighthouse marca como mayor ahorro' })
    }
    if (!problems.length) continue

    const critical = problems.some((p) => p.rating === 'poor')
    const severity = critical ? 'critical' : 'warning'
    const main = problems.find((p) => p.metric === 'lcp' && p.rating === (critical ? 'poor' : 'ni')) ?? problems.find((p) => p.rating === (critical ? 'poor' : 'ni')) ?? problems[0]
    const title = `${r.path} carga lento en el celular: ${main.text.replace(/ \(.*\)$/, '')}`

    const ops = (r.opportunities ?? []).filter((o) => o.savingsMs > 0)
    const opsTxt = ops.length ? ` Lighthouse sugiere revisar: ${ops.map((o) => `${o.title} (ahorro estimado ${sec(o.savingsMs)} s)`).join('; ')}.` : ''
    const rest = problems.filter((p) => p !== main).map((p) => p.text)
    const detail =
      `Una página lenta en el celular pierde visitantes antes de ver el contenido y Google la mide para posicionar (Core Web Vitals). En ${r.path}: ${main.text}.` +
      (rest.length ? ` También: ${rest.join('; ')}.` : '') +
      ` Siguiente paso: ${main.fix}.${opsTxt}`

    out.push({
      path: r.path,
      severity,
      title,
      detail,
      dedupeKey: `speed:${r.path}`,
      score: critical ? 80 : 55,
      impact: critical ? 'high' : 'medium',
      evidence: { path: r.path, strategy: r.strategy, score: r.score, lcpMs: r.lcpMs, cls: r.cls, tbtMs: r.tbtMs, fcpMs: r.fcpMs, field: r.field, opportunities: ops },
    })
  }
  return out
}

export function speedSummary(results: SpeedResult[]): { measured: number; slow: number; avgScore: number | null; worstPath: string | null } {
  const ok = results.filter((r) => !r.error && r.score != null)
  const measured = ok.length
  const avgScore = measured ? Math.round(ok.reduce((s, r) => s + (r.score as number), 0) / measured) : null
  const worst = ok.reduce<SpeedResult | null>((w, r) => (!w || (r.score as number) < (w.score as number) ? r : w), null)
  return { measured, slow: speedCandidates(results).length, avgScore, worstPath: worst?.path ?? null }
}
