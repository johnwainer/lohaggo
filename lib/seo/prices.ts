/**
 * Rangos de precio típicos por servicio, calculados con los precios reales de las propuestas de los socios.
 * Con menos de MIN_PRICE_SAMPLE propuestas no se afirma un rango: se muestra solo el «desde» del catálogo. Puro.
 */

export const MIN_PRICE_SAMPLE = 5
/** Y de al menos tantos socios distintos: un solo socio con muchas propuestas no es «el precio típico». */
export const MIN_PRICE_PARTNERS = 3

export type PriceInfo =
  | { source: 'proposals'; sample: number; low: number; high: number; median: number }
  | { source: 'catalog'; from: number }

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** De $1.000 en $1.000 por debajo de $100.000 y de $5.000 en $5.000 por encima: cifras que una persona diría. */
export function roundPrice(n: number): number {
  const step = n >= 100_000 ? 5_000 : 1_000
  return Math.round(n / step) * step
}

/** Rango típico (percentil 20 a 80, para ignorar los extremos) y mediana. Null si no hay muestra suficiente. */
export function computePriceRange(prices: Array<number | null | undefined>, minSample = MIN_PRICE_SAMPLE) {
  const clean = prices.filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0).sort((a, b) => a - b)
  if (clean.length < minSample) return null
  const low = roundPrice(quantile(clean, 0.2))
  const high = roundPrice(quantile(clean, 0.8))
  return { sample: clean.length, low, high: Math.max(high, low), median: roundPrice(quantile(clean, 0.5)) }
}

/** El rango real si hay muestra; si no, el «desde» del catálogo. */
export function resolvePriceInfo(prices: Array<number | null | undefined>, catalogFrom: number, distinctPartners: number): PriceInfo {
  const r = distinctPartners >= MIN_PRICE_PARTNERS ? computePriceRange(prices) : null
  return r ? { source: 'proposals', ...r } : { source: 'catalog', from: Math.round(catalogFrom) }
}

/** Texto corto de un precio: «$60.000 a $120.000 COP» o «desde $50.000 COP». */
export function priceLabel(info: PriceInfo): string {
  const f = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
  return info.source === 'proposals' ? `${f(info.low)} a ${f(info.high)} COP` : `desde ${f(info.from)} COP`
}
