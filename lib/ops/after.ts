import { after } from 'next/server'

/**
 * Work that must not delay the answer (conversions, pings): after the response inside a request, or right
 * away (not awaited) where there is no request scope (crons, scripts). Never throws.
 */
export function runAfterResponse(fn: () => Promise<unknown>) {
  const safe = () => fn().catch(() => undefined)
  try {
    after(safe)
  } catch {
    void safe()
  }
}
