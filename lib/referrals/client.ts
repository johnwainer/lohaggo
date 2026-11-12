import { REFERRAL_STORAGE_KEY, normalizeReferralCode } from '@/lib/referrals/core'

const TTL_MS = 30 * 24 * 3600_000

/**
 * Browser side: the ?ref= of this visit (kept 30 days in case the person registers later) or the stored one.
 * Returns undefined when there is none. Never throws (storage can be blocked).
 */
export function captureReferral(param: string | null | undefined): string | undefined {
  const fresh = normalizeReferralCode(param ?? undefined)
  try {
    if (fresh) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: fresh, at: Date.now() }))
      return fresh
    }
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY)
    if (!raw) return undefined
    const saved = JSON.parse(raw) as { code?: string; at?: number }
    if (!saved.code || !saved.at || Date.now() - saved.at > TTL_MS) return undefined
    return normalizeReferralCode(saved.code) ?? undefined
  } catch {
    return fresh ?? undefined
  }
}
