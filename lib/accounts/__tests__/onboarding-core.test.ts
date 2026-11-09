import { describe, expect, it } from 'vitest'
import { formatNationalPhone, nationalPhoneDigits, normalizePhone, parseColombianMobile, storedPhoneVariants } from '@/lib/phone'
import { CODE_MAX_PER_WINDOW, codeResendDecision, paceError } from '@/lib/accounts/code-rate'
import { linkConfirmsPhone, whatsappLinkDecision } from '@/lib/accounts/whatsapp-trust'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'
import { welcomeCopy, welcomeScanRange, welcomeStepDue, type WelcomeInput } from '@/lib/accounts/welcome-core'

describe('celulares colombianos', () => {
  it('acepta los formatos habituales', () => {
    for (const raw of ['300 123 4567', '3001234567', '300-123-4567', '(300) 123-4567', '+57 300 123 4567', '+573001234567', '57 300 123 4567', '573001234567', '0057 300 123 4567', '+57 (300) 123-45-67', 'whatsapp:+573001234567', ' 300.123.4567 ']) {
      expect(parseColombianMobile(raw), raw).toEqual({ ok: true, e164: '+573001234567', national: '3001234567' })
    }
  })

  it('rechaza fijos con un mensaje claro', () => {
    for (const raw of ['604 444 1234', '6014441234', '+57 601 444 1234', '4441234', '2 3456789']) {
      const r = parseColombianMobile(raw)
      expect(r.ok, raw).toBe(false)
      if (!r.ok) {
        expect(r.reason, raw).toBe('landline')
        expect(r.error).toMatch(/fijo/)
      }
    }
  })

  it('vacío, incompleto o de otro país', () => {
    expect(parseColombianMobile('')).toMatchObject({ ok: false, reason: 'empty' })
    expect(parseColombianMobile('300 123 456')).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseColombianMobile('300 123 45678')).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseColombianMobile('+1 305 555 1234')).toMatchObject({ ok: false, reason: 'foreign' })
    expect(parseColombianMobile('abc')).toMatchObject({ ok: false, reason: 'empty' })
  })

  it('el autocompletado con +57 no se come los últimos dígitos', () => {
    expect(formatNationalPhone('+57 300 123 4567')).toBe('300 123 4567')
    expect(formatNationalPhone('573001234567')).toBe('300 123 4567')
    expect(formatNationalPhone('3001234')).toBe('300 123 4')
    expect(nationalPhoneDigits('0057 3001234567')).toBe('3001234567')
    // typing «57…» by hand ends in the same number
    expect(formatNationalPhone('57300123456')).toBe('300 123 456')
    expect(formatNationalPhone(`${formatNationalPhone('57300123456')}7`)).toBe('300 123 4567')
  })

  it('normalizePhone mantiene lo de antes y arregla lo colombiano', () => {
    expect(normalizePhone('300-123-4567')).toBe('+573001234567')
    expect(normalizePhone('57 300 123 4567')).toBe('+573001234567')
    expect(normalizePhone('+1 (305) 555-1234')).toBe('+13055551234')
    expect(normalizePhone('0034 612 345 678')).toBe('+34612345678')
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })

  it('variantes guardadas de un número', () => {
    expect(storedPhoneVariants('+573001234567').sort()).toEqual(['+573001234567', '3001234567', '573001234567'].sort())
  })
})

describe('reenvío de códigos', () => {
  const now = new Date('2026-11-09T15:00:00Z')
  const ago = (s: number) => new Date(now.getTime() - s * 1000)

  it('el primero sale', () => expect(codeResendDecision([], now)).toEqual({ ok: true }))

  it('uno por minuto', () => {
    const r = codeResendDecision([ago(20)], now)
    expect(r).toMatchObject({ ok: false, reason: 'too_soon', retryAfterSec: 40 })
    expect(codeResendDecision([ago(61)], now)).toEqual({ ok: true })
  })

  it('máximo 3 en 15 minutos', () => {
    const r = codeResendDecision([ago(70), ago(200), ago(400)], now)
    expect(r).toMatchObject({ ok: false, reason: 'too_many' })
    if (!r.ok) {
      expect(r.retryAfterSec).toBe(15 * 60 - 400)
      expect(r.error).toMatch(/3 códigos en los últimos 15 minutos/)
    }
    expect(codeResendDecision([ago(70), ago(200), ago(901)], now)).toEqual({ ok: true })
    expect(CODE_MAX_PER_WINDOW).toBe(3)
    expect(paceError('too_soon', 40)).toMatch(/pide otro en 40 s/)
  })
})

describe('WhatsApp prueba el número', () => {
  const a = (o: Partial<{ id: string; role: string; isActive: boolean }> = {}) => ({ id: 'u1', role: 'CLIENT', isActive: true, ...o })
  it('una sola cuenta activa de cliente o socio', () => {
    expect(whatsappLinkDecision([a()])).toEqual({ link: true, userId: 'u1' })
    expect(whatsappLinkDecision([a({ role: 'PARTNER' })])).toEqual({ link: true, userId: 'u1' })
    expect(whatsappLinkDecision([a(), a()])).toEqual({ link: true, userId: 'u1' })
  })
  it('nunca admin, varias cuentas ni inactiva', () => {
    expect(whatsappLinkDecision([])).toEqual({ link: false, reason: 'none' })
    expect(whatsappLinkDecision([a(), a({ id: 'u2' })])).toEqual({ link: false, reason: 'ambiguous' })
    expect(whatsappLinkDecision([a({ role: 'ADMIN' })])).toEqual({ link: false, reason: 'admin' })
    expect(whatsappLinkDecision([a({ isActive: false })])).toEqual({ link: false, reason: 'inactive' })
  })
  it('el teléfono queda confirmado solo si la cuenta nació de un chat o de un teléfono', () => {
    expect(linkConfirmsPhone({ acquisition: { source: 'inbox' }, email: 'ana@x.co' }, isPlaceholderEmail)).toBe(true)
    expect(linkConfirmsPhone({ acquisition: null, email: 'wa-573001234567@clientes.lohaggo.com' }, isPlaceholderEmail)).toBe(true)
    // A web sign-up could carry a mistyped number: linking the chat must not open sign-in by code for it
    expect(linkConfirmsPhone({ acquisition: { source: 'google' }, email: 'ana@x.co' }, isPlaceholderEmail)).toBe(false)
    expect(linkConfirmsPhone({ email: 'ana@x.co' }, isPlaceholderEmail)).toBe(false)
  })
})

describe('bienvenida a clientes sin solicitudes', () => {
  const signup = new Date('2026-11-01T14:00:00Z')
  const at = (h: number) => new Date(signup.getTime() + h * 3600_000)
  const base = (o: Partial<WelcomeInput> = {}): WelcomeInput => ({ createdAt: signup, now: at(25), sent: [], hasActivity: false, excludedFromMarketing: false, isActive: true, role: 'CLIENT', ...o })

  it('24 h después, luego un recordatorio a los 3 días', () => {
    expect(welcomeStepDue(base({ now: at(23) }))).toBeNull()
    expect(welcomeStepDue(base())).toBe(1)
    expect(welcomeStepDue(base({ now: at(50), sent: [{ step: 1, at: at(25) }] }))).toBeNull()
    expect(welcomeStepDue(base({ now: at(73), sent: [{ step: 1, at: at(25) }] }))).toBe(2)
    expect(welcomeStepDue(base({ now: at(100), sent: [{ step: 1, at: at(25) }, { step: 2, at: at(73) }] }))).toBeNull()
  })

  it('sin duplicar ni amontonar', () => {
    // Step 1 went late (at 60 h): the reminder waits until 36 h after it
    expect(welcomeStepDue(base({ now: at(73), sent: [{ step: 1, at: at(60) }] }))).toBeNull()
    expect(welcomeStepDue(base({ now: at(97), sent: [{ step: 1, at: at(60) }] }))).toBe(2)
    // A sign-up found after 3 days gets only the reminder
    expect(welcomeStepDue(base({ now: at(80) }))).toBe(2)
    // Two weeks later nothing
    expect(welcomeStepDue(base({ now: at(15 * 24) }))).toBeNull()
  })

  it('nada a quien ya pidió, a quien no quiere marketing, inactivos ni socios', () => {
    expect(welcomeStepDue(base({ hasActivity: true }))).toBeNull()
    expect(welcomeStepDue(base({ excludedFromMarketing: true }))).toBeNull()
    expect(welcomeStepDue(base({ isActive: false }))).toBeNull()
    expect(welcomeStepDue(base({ role: 'PARTNER' }))).toBeNull()
  })

  it('rango de búsqueda y textos', () => {
    const now = at(100)
    const r = welcomeScanRange(now)
    expect(r.lte.getTime()).toBe(now.getTime() - 24 * 3600_000)
    expect(r.gte.getTime()).toBe(now.getTime() - 14 * 24 * 3600_000)
    const c = welcomeCopy(1, 'Ana', [{ name: 'Plomería', slug: 'plomeria' }, { name: 'Electricidad', slug: 'electricidad' }])
    expect(c.title).toBe('¿Qué necesitas arreglar?')
    expect(c.message).toMatch(/Lo más pedido: Plomería, Electricidad\./)
    expect(welcomeCopy(2, 'Ana', []).message).not.toMatch(/Lo más pedido/)
  })
})
