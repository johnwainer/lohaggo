/**
 * Sign in or create an account with the phone: a 6-digit code goes by WhatsApp (A1, AUTHENTICATION template;
 * SMS if WhatsApp fails) and, once confirmed, opens the account on that number or creates a client account.
 * Limits are shared across instances (RateLimitHit); the code is stored hashed, lives 10 minutes and allows
 * 5 tries. Asking for a code answers the same whether the number has an account or not.
 */
import { signupConsent } from '@/lib/privacy/consent'
import bcrypt from 'bcryptjs'
import { randomBytes, randomInt, randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { normalizePhone, parseColombianMobile, storedPhoneVariants } from '@/lib/phone'
import { CODE_WINDOW_MS, codeResendDecision } from '@/lib/accounts/code-rate'
import { toE164 } from '@/lib/inbox/contacts'
import { overLimit } from '@/lib/rate-limit-store'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { sendAccessLink } from '@/lib/accounts/access-link'
import {
  PHONE_CODE_MAX_ATTEMPTS, PHONE_CODE_TTL_MS, hashPhoneCode, isPlaceholderEmail, phoneLoginDecision, placeholderEmail, sameHash,
} from '@/lib/accounts/phone-login-core'
import { PHONE_PROOF_TTL_MS, checkPhoneProof, signPhoneProof } from '@/lib/accounts/phone-proof'
import type { SessionUser } from '@/lib/session-cookie'

const logger = createLogger('phone-login')
function secret() {
  const s = env.SECURITY_INTERNAL_TOKEN || env.NEXTAUTH_SECRET
  if (!s) throw new Error('Missing secret for phone codes')
  return s
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const phoneE164 = (raw: string | null | undefined) => toE164(normalizePhone(raw ?? ''))

const maskPhone = (e164: string) => `${e164.slice(0, 3)} ••• ${e164.slice(-4)}`

export type CodeRequestResult = { ok: true; sentTo: string } | { ok: false; status: 400 | 429 | 503; error: string }

export async function requestPhoneCode(p: { phone: string; ip: string }): Promise<CodeRequestResult> {
  const mobile = parseColombianMobile(p.phone)
  if (!mobile.ok) return { ok: false, status: 400, error: mobile.error }
  const phone = mobile.e164
  // One code per minute and three per 15 minutes for the same number (the DB sees every instance)
  const recent = await prisma.phoneLoginCode.findMany({ where: { phone, createdAt: { gte: new Date(Date.now() - CODE_WINDOW_MS) } }, select: { createdAt: true } })
  const pace = codeResendDecision(recent.map((r) => r.createdAt))
  if (!pace.ok) return { ok: false, status: 429, error: pace.error }
  const limits = await Promise.all([
    overLimit(`phonecode:ip:${p.ip}`, 3600_000, 10),
    overLimit(`phonecode:p:${phone}`, 15 * 60_000, 3),
    overLimit(`phonecode:day:${phone}`, 24 * 3600_000, 8),
  ])
  const blocked = limits.find((l) => l.blocked)
  if (blocked) return { ok: false, status: 429, error: `Pediste varios códigos seguidos. Intenta de nuevo en ${Math.ceil(blocked.retryAfterSec / 60)} min.` }

  const id = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  // A new code replaces the previous ones
  await prisma.phoneLoginCode.updateMany({ where: { phone, usedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } })
  await prisma.phoneLoginCode.create({ data: { id, phone, codeHash: hashPhoneCode(code, id, secret()), expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MS), ipHash: hashPhoneCode(p.ip, 'ip', secret()).slice(0, 24) } })

  const { waLoginCode } = await import('@/lib/messaging/wa-events')
  const wa = await waLoginCode({ phone, code, codeId: id })
  let sent = Boolean(wa?.ok)
  if (!sent) {
    const runtime = await getMessagingProviderRuntimeConfig()
    const sms = await sendMessageViaProvider({ channel: 'SMS', to: phone, body: `Tu código de LoHaggo es ${code}. Vence en 10 minutos. No lo compartas con nadie.` }, runtime).catch(() => ({ ok: false }))
    sent = sms.ok
  }
  if (!sent) {
    await prisma.phoneLoginCode.delete({ where: { id } }).catch(() => null)
    logger.warn('Phone code not sent', { phone: maskPhone(phone) })
    return { ok: false, status: 503, error: 'No pudimos enviarte el código ahora. Intenta en unos minutos.' }
  }
  return { ok: true, sentTo: maskPhone(phone) }
}

export type VerifyResult =
  | { ok: true; user: SessionUser; created: boolean }
  | { ok: false; status: number; code: 'invalid' | 'expired' | 'need_name' | 'email_taken' | 'email_link' | 'refused' | 'limit'; error: string; remaining?: number }

const sessionSelect = { id: true, name: true, email: true, image: true, phone: true, role: true, isActive: true, partnerProfile: { select: { id: true } } } as const

type CodeCheck =
  | { ok: true; row: { id: string } }
  | { ok: false; status: number; code: 'invalid' | 'expired' | 'limit'; error: string; remaining?: number }

/** The newest unused code of the number matches: rate limit, expiry and the 5 tries are all here. */
async function checkPhoneCode(phone: string, code: string, ip: string): Promise<CodeCheck> {
  const limit = await overLimit(`phoneverify:ip:${ip}`, 3600_000, 30)
  if (limit.blocked) return { ok: false, status: 429, code: 'limit', error: 'Demasiados intentos. Espera un rato.' }

  const row = await prisma.phoneLoginCode.findFirst({ where: { phone, usedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!row || row.expiresAt < new Date()) return { ok: false, status: 400, code: 'expired', error: 'El código venció. Pide uno nuevo.' }
  if (row.attempts >= PHONE_CODE_MAX_ATTEMPTS) return { ok: false, status: 400, code: 'expired', error: 'Demasiados intentos con este código. Pide uno nuevo.' }
  if (!sameHash(row.codeHash, hashPhoneCode(code, row.id, secret()))) {
    // Counted atomically: parallel guesses can't all pass the attempts check before any increment lands
    const counted = await prisma.phoneLoginCode.updateMany({ where: { id: row.id, attempts: { lt: PHONE_CODE_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } })
    if (counted.count !== 1) return { ok: false, status: 400, code: 'expired', error: 'Demasiados intentos con este código. Pide uno nuevo.' }
    const next = await prisma.phoneLoginCode.findUnique({ where: { id: row.id }, select: { attempts: true } })
    const remaining = Math.max(0, PHONE_CODE_MAX_ATTEMPTS - (next?.attempts ?? PHONE_CODE_MAX_ATTEMPTS))
    return { ok: false, status: 400, code: 'invalid', remaining, error: remaining ? `Código incorrecto. Te quedan ${remaining} intentos.` : 'Código incorrecto. Pide uno nuevo.' }
  }
  return { ok: true, row }
}

export type ProofResult =
  | { ok: true; proof: string }
  | { ok: false; status: number; code: 'invalid' | 'expired' | 'limit' | 'has_account'; error: string; remaining?: number }

export const HAS_ACCOUNT_ERROR = 'Ya tienes cuenta: entra con tu celular.'

/**
 * Confirms a code for the /unete signup without email: nothing is created or signed in. A number that already
 * has an account (any role) gets no proof. The code stays unused (valid up to the proof's lifetime) until
 * /api/register spends it.
 */
export async function provePhoneCode(p: { phone: string; code: string; ip: string }): Promise<ProofResult> {
  const phone = phoneE164(p.phone)
  const code = (p.code || '').replace(/\D/g, '')
  if (!phone || code.length !== 6) return { ok: false, status: 400, code: 'invalid', error: 'El código son 6 números' }
  const checked = await checkPhoneCode(phone, code, p.ip)
  if (!checked.ok) return checked
  const taken = await prisma.user.count({ where: { phone: { in: storedPhoneVariants(phone) } } })
  if (taken > 0) {
    await prisma.phoneLoginCode.updateMany({ where: { id: checked.row.id, usedAt: null }, data: { usedAt: new Date() } })
    return { ok: false, status: 409, code: 'has_account', error: HAS_ACCOUNT_ERROR }
  }
  const exp = Date.now() + PHONE_PROOF_TTL_MS
  await prisma.phoneLoginCode.update({ where: { id: checked.row.id }, data: { expiresAt: new Date(exp) } })
  return { ok: true, proof: signPhoneProof({ phone, codeId: checked.row.id, exp }, secret()) }
}

/** Validates the proof for exactly this number and spends it (atomic: a second use finds the code used). */
/** Signature and expiry only (nothing is spent): lets the register route refuse a missing proof before any account lookup. */
export function phoneProofValid(token: string | null | undefined, rawPhone: string): boolean {
  const phone = phoneE164(rawPhone)
  return Boolean(phone) && checkPhoneProof(token, phone!, secret()).ok
}

export async function consumePhoneProof(token: string | null | undefined, rawPhone: string): Promise<boolean> {
  const phone = phoneE164(rawPhone)
  if (!phone) return false
  const check = checkPhoneProof(token, phone, secret())
  if (!check.ok) return false
  const spent = await prisma.phoneLoginCode.updateMany({ where: { id: check.codeId, phone, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })
  return spent.count === 1
}

export async function verifyPhoneCode(p: { phone: string; code: string; name?: string | null; email?: string | null; ip: string; acquisition?: Prisma.InputJsonValue | null }): Promise<VerifyResult> {
  const phone = phoneE164(p.phone)
  const code = (p.code || '').replace(/\D/g, '')
  if (!phone || code.length !== 6) return { ok: false, status: 400, code: 'invalid', error: 'El código son 6 números' }
  const checked = await checkPhoneCode(phone, code, p.ip)
  if (!checked.ok) return checked
  const row = checked.row

  // The code is right: from here on the person holds this phone
  // Accounts stored before phones were normalized (without +57) count too
  const accounts = await prisma.user.findMany({ where: { phone: { in: storedPhoneVariants(phone) } }, select: { id: true, role: true, isActive: true, email: true, phoneVerifiedAt: true }, take: 3 })
  const decision = phoneLoginDecision(accounts)
  const name = p.name?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? ''
  const email = p.email?.trim().toLowerCase() ?? ''
  if (decision.action === 'create') {
    if (name.length < 2) return { ok: false, status: 400, code: 'need_name', error: 'Escribe tu nombre para crear tu cuenta' }
    if (email && (!EMAIL_RE.test(email) || isPlaceholderEmail(email))) return { ok: false, status: 400, code: 'invalid', error: 'Ese correo no es válido (puedes dejarlo vacío)' }
    if (email && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
      return { ok: false, status: 400, code: 'email_taken', error: 'Ese correo ya tiene una cuenta. Entra con él o deja el correo vacío.' }
    }
  }

  const claimed = await prisma.phoneLoginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return { ok: false, status: 400, code: 'expired', error: 'Este código ya se usó. Pide uno nuevo.' }

  if (decision.action === 'refuse') {
    const error = decision.reason === 'inactive' ? 'Esta cuenta está inactiva. Escríbenos por WhatsApp.' : 'Con este número se entra con correo y contraseña.'
    return { ok: false, status: 403, code: 'refused', error }
  }
  if (decision.action === 'email_link') {
    const sent = await sendAccessLink(decision.userId)
    return { ok: false, status: 409, code: 'email_link', error: sent.ok ? 'Ya tienes cuenta con este número. Por seguridad te enviamos un enlace de acceso a tu correo.' : 'Ya tienes cuenta con este número: entra con tu correo y contraseña.' }
  }

  if (decision.action === 'login') {
    const user = await prisma.user.update({ where: { id: decision.userId }, data: { phoneVerifiedAt: new Date() }, select: sessionSelect })
    return { ok: true, user, created: false }
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email || placeholderEmail(phone),
      password: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
      phone,
      phoneVerifiedAt: new Date(),
      role: 'CLIENT',
      // The login form says «Al continuar aceptas los términos y la política de privacidad»
      ...signupConsent({}),
      ...(p.acquisition ? { acquisition: p.acquisition } : {}),
    },
    select: sessionSelect,
  })
  logger.info('Account created with phone code', { userId: user.id })
  return { ok: true, user, created: true }
}
