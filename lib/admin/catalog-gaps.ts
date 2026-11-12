import { queryTokens } from '@/lib/services/searchIntent'

export type ZeroSearch = { q: string; n: number }
export type CatalogGap = { term: string; searches: number; variants: string[] }

/**
 * «Servicios que faltan en el catálogo»: searches that returned nothing (in the log) and still return nothing now
 * (`resultsNow` runs the current catalogue + synonyms: a synonym added since fixes it and drops it from the list).
 * Variants of the same words («fuga agua», «agua fuga») are grouped; junk (one letter, only digits) is ignored.
 */
export function catalogGaps(zero: ZeroSearch[], resultsNow: (q: string) => number, limit = 20): CatalogGap[] {
  const groups = new Map<string, CatalogGap>()
  for (const z of zero) {
    const tokens = queryTokens(z.q).filter((t) => t.length >= 3 && !/^\d+$/.test(t))
    if (!tokens.length) continue
    if (resultsNow(z.q) > 0) continue
    const key = [...tokens].sort().join(' ')
    const g = groups.get(key) ?? { term: tokens.join(' '), searches: 0, variants: [] }
    g.searches += z.n
    if (!g.variants.includes(z.q)) g.variants.push(z.q)
    groups.set(key, g)
  }
  return Array.from(groups.values()).sort((a, b) => b.searches - a.searches).slice(0, limit)
}
