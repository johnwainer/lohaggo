import { buildAttemptPlan, runWithFallback } from '@/lib/ai/retry'
import { classifyProviderError, REASON_LABEL, type Classification } from '@/lib/ai/providers/classify'
import { PROVIDER_LABEL, type ProviderId } from '@/lib/ai/providers/types'

export type ProviderPlan<T> = {
  provider: ProviderId
  primary: string
  fallback: string | null
  call: (model: string) => Promise<T>
}

export type FailoverDeps = {
  failoverEnabled: boolean
  /** Circuit breaker: skip it while down (and not expired) */
  isDown: (provider: ProviderId) => boolean
  onError: (provider: ProviderId, c: Classification, err: unknown) => Promise<void> | void
  onOk: (provider: ProviderId) => Promise<void> | void
  describe: (err: unknown) => string
  sleep?: (ms: number) => Promise<void>
}

/** Every provider failed with an error the next one could have fixed. The message names each one and why. */
export class AllProvidersFailedError extends Error {
  constructor(public failures: Array<{ provider: ProviderId; reason: string; error: unknown }>) {
    super(`Ningún proveedor de IA respondió: ${failures.map((f) => `${PROVIDER_LABEL[f.provider]}: ${f.reason}`).join(' · ')}`)
    this.name = 'AllProvidersFailedError'
  }
}

/**
 * The order to try. With failover off only the first provider is used. Providers marked down go to the
 * back instead of disappearing: when all of them are down, trying beats handing off without a call.
 */
export function orderProviders<T>(plans: ProviderPlan<T>[], deps: Pick<FailoverDeps, 'failoverEnabled' | 'isDown'>) {
  if (!plans.length) return []
  if (!deps.failoverEnabled) return [plans[0]]
  const up = plans.filter((p) => !deps.isDown(p.provider))
  return up.length ? up : plans
}

/**
 * Each provider with its own plan (primary model ×3 on overload, then its fallback model). An error
 * the next provider could fix moves on to it; any other error is thrown as is.
 */
export async function runProviders<T>(plans: ProviderPlan<T>[], deps: FailoverDeps): Promise<{ result: T; provider: ProviderId; model: string; failedOver: ProviderId[] }> {
  const order = orderProviders(plans, deps)
  const failures: AllProvidersFailedError['failures'] = []
  for (const plan of order) {
    try {
      const { result, model } = await runWithFallback(buildAttemptPlan(plan.primary, plan.fallback), plan.call, deps.sleep)
      await deps.onOk(plan.provider)
      return { result, provider: plan.provider, model, failedOver: failures.map((f) => f.provider) }
    } catch (err) {
      const c = classifyProviderError(plan.provider, err)
      await deps.onError(plan.provider, c, err)
      if (!c.failover) throw err
      failures.push({ provider: plan.provider, reason: c.reason ? REASON_LABEL[c.reason] : deps.describe(err), error: err })
    }
  }
  if (failures.length === 1) throw failures[0].error
  throw new AllProvidersFailedError(failures)
}
