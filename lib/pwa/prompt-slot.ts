/**
 * One floating prompt at a time. The three layers that used to stack at the bottom of the screen
 * (the server-chosen adoption prompt, the push-permission ask and the install banner) each «want» the
 * slot; the one with the highest priority holds it until it stops wanting it, then the next one appears.
 * Pure reducer here; the React store is in hooks/usePromptSlot.ts.
 */

export type PromptId = 'adoption' | 'push' | 'install'

/** Highest priority first. */
export const PROMPT_PRIORITY: readonly PromptId[] = ['adoption', 'push', 'install']

export type SlotState = { holder: PromptId | null; wanting: PromptId[] }

export const EMPTY_SLOT: SlotState = { holder: null, wanting: [] }

const best = (ids: PromptId[]): PromptId | null =>
  [...ids].sort((a, b) => PROMPT_PRIORITY.indexOf(a) - PROMPT_PRIORITY.indexOf(b))[0] ?? null

export function reduceSlot(state: SlotState, action: { type: 'want' | 'unwant'; id: PromptId }): SlotState {
  if (action.type === 'want') {
    if (state.wanting.includes(action.id)) return state
    const wanting = [...state.wanting, action.id]
    // Whoever already shows keeps the slot: a higher priority prompt waits its turn instead of replacing it
    return { wanting, holder: state.holder ?? best(wanting) }
  }
  if (!state.wanting.includes(action.id)) return state
  const wanting = state.wanting.filter((id) => id !== action.id)
  return { wanting, holder: state.holder === action.id ? best(wanting) : state.holder }
}

/**
 * Paths where no floating prompt may appear: the sign-up flows and any page whose own sticky call to
 * action is mounted (the request bar on /servicios/*, flagged on <body> by StickyRequestBar).
 */
export function promptBlocked(pathname: string | null | undefined, stickyCtaMounted: boolean): boolean {
  const path = pathname ?? ''
  if (['/unete', '/login', '/register', '/registro-socios', '/download/android', '/download/ios'].some((p) => path.startsWith(p))) return true
  if (path.startsWith('/servicios/') && stickyCtaMounted) return true
  return false
}
