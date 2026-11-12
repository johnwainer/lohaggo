/**
 * One shared time budget for a cron invocation. Every step receives it and checks it between sends, so a run
 * that is running out of time stops cleanly and the unfinished work continues on the next run (all the steps
 * are resumable: sends are deduplicated and the queries only pick what is still pending).
 */
export type Deadline = { readonly at: number; expired(): boolean; remaining(): number }

export const CRON_BUDGET_MS = 240_000

export function createDeadline(budgetMs = CRON_BUDGET_MS, now: () => number = Date.now): Deadline {
  const at = now() + budgetMs
  return { at, expired: () => now() >= at, remaining: () => Math.max(0, at - now()) }
}

export const isExpired = (d?: Deadline | null) => Boolean(d?.expired())
