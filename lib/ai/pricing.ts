export type Pricing = {
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number
  cacheWritePerMTok: number
}

export type UsageTokens = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Seed values (USD per million tokens). The editable source of truth is the AiPricing table. */
export const DEFAULT_PRICING: Record<string, Pricing> = {
  'anthropic:claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
  'anthropic:claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  'anthropic:claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
  'voyage:voyage-3': { inputPerMTok: 0.06, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
  'voyage:voyage-3-large': { inputPerMTok: 0.18, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
  'voyage:voyage-3-lite': { inputPerMTok: 0.02, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
  'voyage:voyage-multilingual-2': { inputPerMTok: 0.12, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
  'voyage:voyage-code-3': { inputPerMTok: 0.18, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 },
}

/**
 * Resolves the price row for a model. Exact match first, then the longest table key that prefixes
 * the model id (so a dated or suffixed id reported by the API still finds its family price).
 */
export function resolvePricing(table: Record<string, Pricing>, provider: string, model: string): Pricing | null {
  const exact = table[`${provider}:${model}`]
  if (exact) return exact
  const candidates = Object.keys(table)
    .filter((k) => k.startsWith(`${provider}:`) && model.startsWith(k.slice(provider.length + 1)))
    .sort((a, b) => b.length - a.length)
  return candidates.length ? table[candidates[0]] : null
}

export function computeCost(usage: UsageTokens, price: Pricing | null): number {
  if (!price) return 0
  const cost =
    (usage.inputTokens * price.inputPerMTok +
      usage.outputTokens * price.outputPerMTok +
      usage.cacheReadTokens * price.cacheReadPerMTok +
      usage.cacheWriteTokens * price.cacheWritePerMTok) /
    1_000_000
  return Math.round(cost * 1e6) / 1e6
}

export function periodOf(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
