/**
 * What the public site is allowed to claim. Every trust or promotional statement a visitor, client or
 * partner reads is one of these switches (a FeatureFlag row, created with its default the first time it is
 * read). Numbers never come from here: they come from the database (lib/public/trust.ts) and are shown
 * only above a minimum. Haggo can propose turning a claim on or off; the superadmin approves. Pure.
 */

import { POLICY_SUMMARY, POLICY_URL } from '@/lib/guarantee/policy'

export type ClaimKey =
  | 'trust_real_stats'
  | 'trust_real_testimonials'
  | 'trust_support_247'
  | 'trust_guarantee'
  | 'trust_background_check'
  | 'trust_online_payment_protection'
  | 'promo_no_commission'
  | 'promo_launch_benefits'

export type ClaimDef = {
  key: ClaimKey
  name: string
  /** What the site says when it is on */
  says: string
  /** What must be true in the platform for it to be honest */
  requires: string
  /** Initial state: on only for what is true today */
  defaultOn: boolean
  kind: 'trust' | 'promo'
}

export const CLAIMS: Record<ClaimKey, ClaimDef> = {
  trust_real_stats: {
    key: 'trust_real_stats',
    name: 'Cifras reales de la plataforma',
    says: 'Muestra cuántos socios verificados hay, servicios completados y la calificación promedio, calculados en vivo. Cada cifra solo aparece si supera su mínimo.',
    requires: 'Nada: las cifras salen de la base de datos.',
    defaultOn: true,
    kind: 'trust',
  },
  trust_real_testimonials: {
    key: 'trust_real_testimonials',
    name: 'Testimonios reales',
    says: 'Muestra reseñas reales de clientes (4★ o más, con comentario). Si hay menos de 3, la sección no aparece.',
    requires: 'Reseñas reales en la plataforma.',
    defaultOn: true,
    kind: 'trust',
  },
  trust_support_247: {
    key: 'trust_support_247',
    name: 'Atención 24/7 por chat',
    says: '«Te atendemos 24/7 por WhatsApp e Instagram (asistente con IA); el equipo humano responde en horario hábil».',
    requires: 'Un agente de IA activo en piloto en WhatsApp.',
    defaultOn: true,
    kind: 'trust',
  },
  trust_guarantee: {
    key: 'trust_guarantee',
    name: 'Garantía de servicio',
    says: `«${POLICY_SUMMARY}» Política completa en ${POLICY_URL}.`,
    requires: `La política de ${POLICY_URL} publicada y la cola de garantía atendida (sin reclamos vencidos).`,
    defaultOn: false,
    kind: 'trust',
  },
  trust_background_check: {
    key: 'trust_background_check',
    name: 'Antecedentes verificados',
    says: '«Revisamos identidad y antecedentes de cada socio».',
    requires: 'Que el documento de antecedentes sea obligatorio para verificar a un socio.',
    defaultOn: false,
    kind: 'trust',
  },
  trust_online_payment_protection: {
    key: 'trust_online_payment_protection',
    name: 'Pago protegido en línea',
    says: '«Tu pago queda protegido por LoHaggo hasta que confirmas el servicio».',
    requires: 'Pago en línea (MercadoPago) activo y dinero retenido hasta la confirmación.',
    defaultOn: false,
    kind: 'trust',
  },
  promo_no_commission: {
    key: 'promo_no_commission',
    name: 'Sin comisión de lanzamiento',
    says: '«Sin comisión durante el lanzamiento: el cliente paga solo el precio del socio y el socio recibe el 100 %».',
    requires: 'Comisiones apagadas en Configuración de pagos (commissionEnabled = false).',
    defaultOn: false,
    kind: 'promo',
  },
  promo_launch_benefits: {
    key: 'promo_launch_benefits',
    name: 'Beneficios de preregistro en ciudades nuevas',
    says: '«Déjanos tu correo y te avisamos cuando lleguemos a tu ciudad» con los beneficios configurados (texto en metadata).',
    requires: 'Que el formulario guarde el correo y que los beneficios existan de verdad (cupón, prioridad).',
    defaultOn: false,
    kind: 'promo',
  },
}

export const CLAIM_KEYS = Object.keys(CLAIMS) as ClaimKey[]
export const isClaimKey = (k: string): k is ClaimKey => k in CLAIMS

export type ClaimState = Record<ClaimKey, boolean>

export function defaultClaimState(): ClaimState {
  return Object.fromEntries(CLAIM_KEYS.map((k) => [k, CLAIMS[k].defaultOn])) as ClaimState
}

/** Minimums below which a real number is not shown (a small honest number reads worse than none). */
export const STAT_MINIMUMS = {
  verifiedPartners: 20,
  completedServices: 25,
  reviewsForRating: 5,
  testimonials: 3,
  clients: 50,
}

export type TrustFacts = {
  verifiedPartners: number
  completedServices: number
  clients: number
  reviews: number
  avgRating: number | null
  activeCities: string[]
  servicesWithPartners: number
  commissionEnabled: boolean
  onlinePaymentEnabled: boolean
  autopilotAgentOnWhatsapp: boolean
  backgroundCheckRequired: boolean
  /** Guarantee claims still open past their SLA (lib/guarantee) */
  guaranteeOverdue: number
  /** The policy page /garantia exists (lib/guarantee/policy.ts) */
  guaranteePolicyPublished: boolean
}

/**
 * Claims that are on without what makes them true. Pure: Haggo's rule and the admin screen use it, and a
 * test pins it. Stats and testimonials are self-limiting (they hide themselves), so they never appear here.
 */
export function unbackedClaims(state: ClaimState, f: TrustFacts): Array<{ key: ClaimKey; why: string }> {
  const out: Array<{ key: ClaimKey; why: string }> = []
  if (state.trust_support_247 && !f.autopilotAgentOnWhatsapp) out.push({ key: 'trust_support_247', why: 'No hay un agente de IA en piloto en WhatsApp' })
  if (state.trust_background_check && !f.backgroundCheckRequired) out.push({ key: 'trust_background_check', why: 'Los antecedentes no son obligatorios para verificar a un socio' })
  if (state.trust_online_payment_protection && !f.onlinePaymentEnabled) out.push({ key: 'trust_online_payment_protection', why: 'El pago en línea (MercadoPago) está apagado' })
  if (state.trust_guarantee && !f.guaranteePolicyPublished) out.push({ key: 'trust_guarantee', why: 'La política de garantía no está publicada' })
  else if (state.trust_guarantee && f.guaranteeOverdue > 0) out.push({ key: 'trust_guarantee', why: `${f.guaranteeOverdue} reclamo${f.guaranteeOverdue === 1 ? '' : 's'} de garantía vencido${f.guaranteeOverdue === 1 ? '' : 's'} sin resolver` })
  if (state.promo_no_commission && f.commissionEnabled) out.push({ key: 'promo_no_commission', why: 'Las comisiones están encendidas: la promoción sería falsa' })
  return out
}

/** A stat is shown only above its minimum. */
export function showStat(value: number, min: number) {
  return value >= min ? value : null
}

/** «1.234» style for the site. */
export const fmtCount = (n: number) => new Intl.NumberFormat('es-CO').format(n)
