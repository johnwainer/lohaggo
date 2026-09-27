/**
 * The public site's wording for each trust statement, chosen from the claim switches. Pure, so server and
 * client components (and the help texts) read the same sentence. Every function returns the strongest
 * version that is true today; when a claim is off it falls back to the modest true one.
 */
import { CLAIMS, fmtCount } from '@/lib/public/claims'
import type { PublicTrust } from '@/lib/public/trust'

/** The quoted sentence of a claim, without the «» marks. */
export function claimSays(key: keyof typeof CLAIMS): string {
  const s = CLAIMS[key].says
  const m = s.match(/«([^»]+)»/)
  return (m ? m[1] : s).trim()
}

export type TrustLike = Pick<PublicTrust, 'claims' | 'stats' | 'commissionEnabled'>

/** How the partner gets paid. */
export function partnerPayout(t: TrustLike) {
  return t.claims.trust_online_payment_protection
    ? 'El cliente paga en línea y LoHaggo protege el pago hasta que confirma el servicio.'
    : 'Cobras directo al cliente al terminar, en efectivo o transferencia.'
}

/** How the client pays. */
export function clientPayment(t: TrustLike) {
  return t.claims.trust_online_payment_protection ? claimSays('trust_online_payment_protection') : 'Pagas al terminar el servicio.'
}

/** What LoHaggo charges, for partners. */
export function partnerCommission(t: TrustLike) {
  if (t.commissionEnabled) return 'LoHaggo cobra una comisión por servicio (ver términos).'
  return t.claims.promo_no_commission ? 'Sin comisión durante el lanzamiento: recibes el 100 %.' : 'Hoy no cobramos comisión.'
}

/** What LoHaggo charges, in the FAQ. */
export function commissionFaq(t: TrustLike) {
  if (t.commissionEnabled) return 'LoHaggo cobra una comisión fija por servicio, visible antes de aceptar. Registrarte y usar la plataforma es gratis.'
  return t.claims.promo_no_commission
    ? 'Sin comisión durante el lanzamiento: el cliente paga solo el precio del socio y el socio recibe el 100 %. Registrarte es gratis.'
    : 'Hoy no cobramos comisión. Registrarte y usar la plataforma es gratis.'
}

export function supportShort(t: TrustLike) {
  return t.claims.trust_support_247 ? 'Atención 24/7 por chat' : 'Atención por WhatsApp'
}

export function supportLong(t: TrustLike) {
  return t.claims.trust_support_247
    ? '24/7 por chat con asistente de IA; equipo humano en horario hábil.'
    : 'Escríbenos por WhatsApp o a hola@lohaggo.com; el equipo responde en horario hábil.'
}

export function verificationShort(t: TrustLike) {
  return t.claims.trust_background_check ? 'Identidad y antecedentes verificados' : 'Identidad verificada'
}

export function verificationLong(t: TrustLike) {
  return t.claims.trust_background_check ? 'Revisamos identidad y antecedentes de cada socio.' : 'Identidad verificada por nuestro equipo.'
}

/** Guarantee sentence, or null when the claim is off. */
export function guarantee(t: TrustLike): string | null {
  return t.claims.trust_guarantee ? claimSays('trust_guarantee') : null
}

/** «Profesionales en Medellín y Envigado», or null when no city is active. */
export function citiesLine(t: TrustLike): string | null {
  const c = t.stats.activeCities
  if (!c.length) return null
  const list = c.length === 1 ? c[0] : `${c.slice(0, -1).join(', ')} y ${c[c.length - 1]}`
  return `Profesionales en ${list}`
}

/** «Únete a los 34 socios verificados…» only with a real number above its minimum. */
export function partnersJoinLine(t: TrustLike) {
  return t.stats.verifiedPartners !== null
    ? `Únete a los ${fmtCount(t.stats.verifiedPartners)} socios verificados de LoHaggo.`
    : 'Únete a los socios verificados de LoHaggo.'
}
