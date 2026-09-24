export type AttemptPlan = Array<{ model: string; delayMs: number }>

/** Primary model up to 3 times (2 retries with growing wait), then the fallback model once. */
export function buildAttemptPlan(primary: string, fallback: string | null, baseDelayMs = 800): AttemptPlan {
  const plan: AttemptPlan = [
    { model: primary, delayMs: 0 },
    { model: primary, delayMs: baseDelayMs },
    { model: primary, delayMs: baseDelayMs * 2.5 },
  ]
  if (fallback && fallback !== primary) plan.push({ model: fallback, delayMs: 0 })
  return plan
}

export function isOverloaded(err: unknown) {
  const status = (err as { status?: number })?.status
  return status === 529 || status === 503
}

/**
 * Runs `call` following the plan. Only overload errors move to the next attempt; any other error
 * (400, 401, 404…) is thrown straight away because retrying or switching model would not fix it.
 */
export async function runWithFallback<T>(
  plan: AttemptPlan,
  call: (model: string, attempt: number) => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ result: T; model: string; attempts: number }> {
  let lastError: unknown
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    if (step.delayMs) await sleep(step.delayMs)
    try {
      return { result: await call(step.model, i), model: step.model, attempts: i + 1 }
    } catch (err) {
      lastError = err
      if (!isOverloaded(err)) throw err
    }
  }
  throw lastError
}
