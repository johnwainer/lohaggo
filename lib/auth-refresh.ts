import type { JWT } from 'next-auth/jwt'

/** A demoted or deactivated user keeps access at most this long (the JWT itself lives for SESSION_MAX_AGE). */
export const TOKEN_RECHECK_MS = 5 * 60_000

export type LiveUser = { role: string; isActive: boolean; partnerId?: string | null }
export type LiveUserLoader = (userId: string) => Promise<LiveUser | null>

const cache = new Map<string, { at: number; user: LiveUser | null }>()

/** Test hook. */
export function clearLiveUserCache() {
  cache.clear()
}

/**
 * Confirms role and isActive against the DB at most every 5 minutes: by the timestamp in the token and by a
 * per-instance cache (a server component cannot rewrite the cookie, so the token alone would re-check each call).
 * A deleted or deactivated user gets `invalid`: the session callback then returns no user.
 */
export async function refreshTokenFromDb(token: JWT, load: LiveUserLoader, now = Date.now()): Promise<JWT> {
  const id = token.sub
  if (!id) return token
  if (token.checkedAt && now - token.checkedAt < TOKEN_RECHECK_MS && !token.invalid) return token
  let entry = cache.get(id)
  if (!entry || now - entry.at >= TOKEN_RECHECK_MS) {
    try {
      entry = { at: now, user: await load(id) }
    } catch {
      // DB unreachable: keep what the token says rather than logging everyone out
      return token
    }
    cache.set(id, entry)
    if (cache.size > 5000) for (const [k, v] of Array.from(cache.entries())) if (now - v.at >= TOKEN_RECHECK_MS) cache.delete(k)
  }
  const live = entry.user
  if (!live || !live.isActive) return { ...token, invalid: true, isActive: false, checkedAt: now }
  return { ...token, invalid: false, role: live.role, isActive: true, partnerId: live.partnerId ?? undefined, checkedAt: now }
}
