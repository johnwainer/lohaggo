/**
 * Short-lived signed proof that a person confirmed a WhatsApp code for one exact number. /unete hands it to
 * /api/register when the partner leaves the email empty: the account is then born with the placeholder email
 * and a confirmed phone, so the proof is checked on the server and consumed once (the code row it names).
 */
import { createHmac, timingSafeEqual } from 'crypto'

export const PHONE_PROOF_TTL_MS = 15 * 60_000

const mac = (phone: string, codeId: string, exp: number, secret: string) =>
  createHmac('sha256', secret).update(`register-phone-proof:${phone}:${codeId}:${exp}`).digest('base64url')

export function signPhoneProof(p: { phone: string; codeId: string; exp: number }, secret: string) {
  return `${p.codeId}.${p.exp}.${mac(p.phone, p.codeId, p.exp, secret)}`
}

export type ProofCheck = { ok: true; codeId: string } | { ok: false }

export function checkPhoneProof(token: string | null | undefined, phone: string, secret: string, now = Date.now()): ProofCheck {
  const parts = (token ?? '').split('.')
  if (parts.length !== 3) return { ok: false }
  const [codeId, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!codeId || !Number.isFinite(exp) || exp <= now) return { ok: false }
  const a = Buffer.from(sig)
  const b = Buffer.from(mac(phone, codeId, exp, secret))
  return a.length === b.length && timingSafeEqual(a, b) ? { ok: true, codeId } : { ok: false }
}
