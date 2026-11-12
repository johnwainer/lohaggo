import { timingSafeEqual } from 'crypto'

/** Constant-time comparison of a given secret with the expected one; false when either is missing. */
export function sameSecret(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
