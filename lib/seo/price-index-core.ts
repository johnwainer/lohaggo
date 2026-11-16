/**
 * Índice de precios del hogar: la mediana de lo que los socios proponen por servicio en los últimos 90 días y cuánto
 * cambió frente a los 90 anteriores. Solo se afirma lo que tiene muestra: sin ella no hay cifra ni variación. Puro.
 */
import { computePriceRange, MIN_PRICE_PARTNERS, MIN_PRICE_SAMPLE } from '@/lib/seo/prices'

export const WINDOW_DAYS = 90
/** Debajo de este cambio absoluto se dice «estable»: una diferencia de 1 % es ruido, no una tendencia. */
export const STABLE_BAND_PCT = 3
/** Un cambio mayor a esto casi seguro es un cambio de mezcla de trabajos, no de precio: se muestra pero no entra al índice. */
export const OUTLIER_PCT = 60

export type IndexProposal = { price: number; partnerId: string; serviceId: string; createdAt: Date }
export type IndexService = { id: string; name: string; slug: string; category: string }

export type IndexRow = {
  slug: string
  name: string
  category: string
  sample: number
  low: number
  high: number
  median: number
  previousMedian: number | null
  changePct: number | null
  trend: 'up' | 'down' | 'stable' | null
}

export type PriceIndex = {
  rows: IndexRow[]
  /** Variación mediana de los servicios comparables; null si hay menos de 3. */
  overallChangePct: number | null
  comparable: number
  up: number
  down: number
  stable: number
  sample: number
  from: string
  to: string
}

const DAY = 24 * 3600 * 1000

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function trendOf(changePct: number | null): IndexRow['trend'] {
  if (changePct === null) return null
  if (Math.abs(changePct) < STABLE_BAND_PCT) return 'stable'
  return changePct > 0 ? 'up' : 'down'
}

export function buildPriceIndex(proposals: IndexProposal[], services: IndexService[], now = new Date()): PriceIndex {
  const end = now.getTime()
  const start = end - WINDOW_DAYS * DAY
  const prevStart = start - WINDOW_DAYS * DAY
  const rows: IndexRow[] = []
  let sample = 0

  for (const svc of services) {
    const mine = proposals.filter((p) => p.serviceId === svc.id && p.price > 0)
    const current = mine.filter((p) => p.createdAt.getTime() > start && p.createdAt.getTime() <= end)
    if (new Set(current.map((p) => p.partnerId)).size < MIN_PRICE_PARTNERS) continue
    const range = computePriceRange(current.map((p) => p.price))
    if (!range) continue
    const previous = mine.filter((p) => p.createdAt.getTime() > prevStart && p.createdAt.getTime() <= start)
    const prevOk = previous.length >= MIN_PRICE_SAMPLE && new Set(previous.map((p) => p.partnerId)).size >= MIN_PRICE_PARTNERS
    const previousMedian = prevOk ? median(previous.map((p) => p.price)) : null
    const changePct = previousMedian ? Math.round(((median(current.map((p) => p.price)) - previousMedian) / previousMedian) * 1000) / 10 : null
    sample += range.sample
    rows.push({ slug: svc.slug, name: svc.name, category: svc.category, sample: range.sample, low: range.low, high: range.high, median: range.median, previousMedian: previousMedian === null ? null : Math.round(previousMedian), changePct, trend: trendOf(changePct) })
  }

  rows.sort((a, b) => b.sample - a.sample || a.name.localeCompare(b.name, 'es'))
  const comparable = rows.filter((r) => r.changePct !== null && Math.abs(r.changePct) <= OUTLIER_PCT)
  return {
    rows,
    overallChangePct: comparable.length >= 3 ? Math.round(median(comparable.map((r) => r.changePct as number)) * 10) / 10 : null,
    comparable: comparable.length,
    up: comparable.filter((r) => r.trend === 'up').length,
    down: comparable.filter((r) => r.trend === 'down').length,
    stable: comparable.filter((r) => r.trend === 'stable').length,
    sample,
    from: new Date(start).toISOString().slice(0, 10),
    to: new Date(end).toISOString().slice(0, 10),
  }
}

export function indexCsv(idx: PriceIndex): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = ['servicio,categoria,muestra,precio_bajo_cop,precio_mediano_cop,precio_alto_cop,variacion_90_dias_pct']
  for (const r of idx.rows) lines.push([esc(r.name), esc(r.category), r.sample, r.low, r.median, r.high, r.changePct ?? ''].join(','))
  return lines.join('\n') + '\n'
}

export function changeLabel(pct: number | null): string {
  if (pct === null) return 'sin comparación'
  if (Math.abs(pct) < STABLE_BAND_PCT) return 'estable'
  return `${pct > 0 ? 'subió' : 'bajó'} ${Math.abs(pct).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`
}
