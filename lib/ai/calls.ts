import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { DEFAULT_PRICING, computeCost, periodOf, resolvePricing, type Pricing, type UsageTokens } from '@/lib/ai/pricing'

const logger = createLogger('ai-calls')

export type AiCallKind = 'agent_reply' | 'tools_round' | 'summary' | 'reengagement' | 'flow_step' | 'playground' | 'embedding' | 'model_test' | 'copilot_suggestion'

export const AUX_KINDS: AiCallKind[] = ['summary', 'reengagement']

let pricingCache: { at: number; table: Record<string, Pricing> } | null = null

export async function getPricingTable(force = false): Promise<Record<string, Pricing>> {
  if (!force && pricingCache && Date.now() - pricingCache.at < 60_000) return pricingCache.table
  const table: Record<string, Pricing> = { ...DEFAULT_PRICING }
  try {
    const rows = await prisma.aiPricing.findMany()
    for (const r of rows) {
      table[`${r.provider}:${r.model}`] = {
        inputPerMTok: r.inputPerMTok,
        outputPerMTok: r.outputPerMTok,
        cacheReadPerMTok: r.cacheReadPerMTok,
        cacheWritePerMTok: r.cacheWritePerMTok,
      }
    }
  } catch (err) {
    logger.warn('Pricing table unavailable, using defaults', { err: err instanceof Error ? err.message : err })
  }
  pricingCache = { at: Date.now(), table }
  return table
}

export function invalidatePricing() {
  pricingCache = null
}

export type LogCallInput = {
  provider: 'anthropic' | 'voyage'
  model: string
  requestedModel?: string | null
  kind: AiCallKind
  workspaceId?: string | null
  agentId?: string | null
  conversationId?: string | null
  usage: UsageTokens
  latencyMs?: number
}

/** One row per model/embedding call. `model` must be the one that answered (it is what gets billed). */
export async function logAiCall(input: LogCallInput) {
  const table = await getPricingTable()
  const costUsd = computeCost(input.usage, resolvePricing(table, input.provider, input.model))
  try {
    await prisma.aiCall.create({
      data: {
        period: periodOf(new Date()),
        provider: input.provider,
        model: input.model,
        requestedModel: input.requestedModel ?? null,
        kind: input.kind,
        workspaceId: input.workspaceId ?? null,
        agentId: input.agentId ?? null,
        conversationId: input.conversationId ?? null,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
        cacheWriteTokens: input.usage.cacheWriteTokens,
        costUsd,
        latencyMs: input.latencyMs ?? null,
      },
    })
  } catch (err) {
    logger.error('Could not log AI call', { err: err instanceof Error ? err.message : err })
  }
  return costUsd
}
