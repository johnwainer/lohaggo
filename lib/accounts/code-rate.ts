/**
 * How often a verification code may be sent to the same place (a phone, or one chat): one per minute and
 * at most three in fifteen minutes. Pure: the callers pass when the previous codes went out.
 */

export const CODE_RESEND_GAP_MS = 60_000
export const CODE_WINDOW_MS = 15 * 60_000
export const CODE_MAX_PER_WINDOW = 3

export type CodeResendDecision = { ok: true } | { ok: false; reason: 'too_soon' | 'too_many'; retryAfterSec: number; error: string }

/** The words for a paced resend, shared by the per-row decision below and the counters of startLink. */
export function paceError(reason: 'too_soon' | 'too_many', retryAfterSec: number) {
  return reason === 'too_many'
    ? `Ya enviamos ${CODE_MAX_PER_WINDOW} códigos en los últimos 15 minutos. Usa el último que te llegó o intenta de nuevo en ${Math.ceil(retryAfterSec / 60)} min.`
    : `Ya te enviamos un código hace un momento: puede tardar unos segundos en llegar. Si no te llega, pide otro en ${retryAfterSec} s.`
}

export function codeResendDecision(sentAt: Array<Date | string | number>, now: Date = new Date()): CodeResendDecision {
  const t = now.getTime()
  const recent = sentAt.map((d) => new Date(d).getTime()).filter((x) => Number.isFinite(x) && x <= t && t - x < CODE_WINDOW_MS).sort((a, b) => b - a)
  if (recent.length >= CODE_MAX_PER_WINDOW) {
    const oldest = recent[CODE_MAX_PER_WINDOW - 1]
    const retryAfterSec = Math.max(1, Math.ceil((oldest + CODE_WINDOW_MS - t) / 1000))
    return { ok: false, reason: 'too_many', retryAfterSec, error: paceError('too_many', retryAfterSec) }
  }
  if (recent.length && t - recent[0] < CODE_RESEND_GAP_MS) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + CODE_RESEND_GAP_MS - t) / 1000))
    return { ok: false, reason: 'too_soon', retryAfterSec, error: paceError('too_soon', retryAfterSec) }
  }
  return { ok: true }
}
