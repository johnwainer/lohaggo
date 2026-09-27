import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { POLICY_SUMMARY } from '@/lib/guarantee/policy'
import { CLAIMS, defaultClaimState, showStat, unbackedClaims, type ClaimState, type TrustFacts } from '@/lib/public/claims'
import { firstNameInitial, parseLaunchBenefits } from '@/lib/public/trust'
import { citiesLine, claimSays, partnerCommission, partnerPayout, partnersJoinLine } from '@/lib/public/copy'

const facts = (over: Partial<TrustFacts> = {}): TrustFacts => ({
  verifiedPartners: 0,
  completedServices: 0,
  clients: 0,
  reviews: 0,
  avgRating: null,
  activeCities: [],
  servicesWithPartners: 0,
  commissionEnabled: false,
  onlinePaymentEnabled: false,
  autopilotAgentOnWhatsapp: true,
  backgroundCheckRequired: false,
  guaranteeOverdue: 0,
  guaranteePolicyPublished: true,
  ...over,
})
const state = (over: Partial<ClaimState> = {}): ClaimState => ({ ...defaultClaimState(), ...over })
const keys = (s: ClaimState, f: TrustFacts) => unbackedClaims(s, f).map((c) => c.key)

describe('unbackedClaims', () => {
  it('los valores por defecto están respaldados con un agente de IA en WhatsApp', () => {
    expect(keys(state(), facts())).toEqual([])
  })

  it('24/7 sin agente de IA en piloto en WhatsApp', () => {
    expect(keys(state({ trust_support_247: true }), facts({ autopilotAgentOnWhatsapp: false }))).toEqual(['trust_support_247'])
    expect(keys(state({ trust_support_247: false }), facts({ autopilotAgentOnWhatsapp: false }))).toEqual([])
  })

  it('antecedentes sin que sean obligatorios', () => {
    expect(keys(state({ trust_background_check: true }), facts())).toEqual(['trust_background_check'])
    expect(keys(state({ trust_background_check: true }), facts({ backgroundCheckRequired: true }))).toEqual([])
  })

  it('pago protegido sin pago en línea', () => {
    expect(keys(state({ trust_online_payment_protection: true }), facts())).toEqual(['trust_online_payment_protection'])
    expect(keys(state({ trust_online_payment_protection: true }), facts({ onlinePaymentEnabled: true }))).toEqual([])
  })

  it('sin comisión con las comisiones encendidas', () => {
    expect(keys(state({ promo_no_commission: true }), facts({ commissionEnabled: true }))).toEqual(['promo_no_commission'])
    expect(keys(state({ promo_no_commission: true }), facts({ commissionEnabled: false }))).toEqual([])
  })

  it('garantía: sin respaldo si hay reclamos vencidos o la política no está publicada', () => {
    expect(keys(state({ trust_guarantee: true }), facts())).toEqual([])
    const overdue = unbackedClaims(state({ trust_guarantee: true }), facts({ guaranteeOverdue: 2 }))
    expect(overdue.map((c) => c.key)).toEqual(['trust_guarantee'])
    expect(overdue[0].why).toMatch(/2 reclamos de garantía vencidos/)
    expect(keys(state({ trust_guarantee: true }), facts({ guaranteePolicyPublished: false }))).toEqual(['trust_guarantee'])
    expect(keys(state({ trust_guarantee: false }), facts({ guaranteeOverdue: 5 }))).toEqual([])
  })

  it('reporta varias a la vez, con su motivo', () => {
    const out = unbackedClaims(
      state({ trust_support_247: true, trust_background_check: true, trust_online_payment_protection: true, promo_no_commission: true }),
      facts({ autopilotAgentOnWhatsapp: false, commissionEnabled: true }),
    )
    expect(out.map((c) => c.key)).toEqual(['trust_support_247', 'trust_background_check', 'trust_online_payment_protection', 'promo_no_commission'])
    expect(out.every((c) => c.why.length > 0)).toBe(true)
  })

  it('las cifras, testimonios, garantía al día y beneficios no aparecen', () => {
    const all = state({ trust_real_stats: true, trust_real_testimonials: true, trust_guarantee: true, promo_launch_benefits: true })
    expect(keys(all, facts())).toEqual([])
  })
})

describe('showStat', () => {
  it('muestra la cifra desde el mínimo y null por debajo', () => {
    expect(showStat(19, 20)).toBeNull()
    expect(showStat(20, 20)).toBe(20)
    expect(showStat(1234, 20)).toBe(1234)
    expect(showStat(0, 0)).toBe(0)
  })
})

describe('firstNameInitial', () => {
  it('nombre e inicial del segundo', () => {
    expect(firstNameInitial('maría josé pérez')).toBe('María J.')
    expect(firstNameInitial('  ANA   gómez ')).toBe('Ana G.')
  })
  it('solo nombre', () => {
    expect(firstNameInitial('carlos')).toBe('Carlos')
  })
  it('vacío', () => {
    expect(firstNameInitial('')).toBe('Cliente')
    expect(firstNameInitial('   ')).toBe('Cliente')
    expect(firstNameInitial(null)).toBe('Cliente')
    expect(firstNameInitial(undefined)).toBe('Cliente')
  })
})

describe('parseLaunchBenefits', () => {
  it('lee JSON con lista, JSON con texto o líneas', () => {
    expect(parseLaunchBenefits('{"benefits":["Cupón de bienvenida"," ", 3]}')).toEqual(['Cupón de bienvenida'])
    expect(parseLaunchBenefits('{"text":"Uno\\nDos"}')).toEqual(['Uno', 'Dos'])
    expect(parseLaunchBenefits('Uno\n\nDos')).toEqual(['Uno', 'Dos'])
    expect(parseLaunchBenefits(null)).toEqual([])
    expect(parseLaunchBenefits('{"otro":1}')).toEqual([])
  })
})

describe('textos públicos', () => {
  const base = { claims: defaultClaimState(), stats: { verifiedPartners: null, completedServices: null, clients: null, rating: null, activeCities: [] as string[] }, commissionEnabled: false }

  it('comisión según configuración y promoción', () => {
    expect(partnerCommission(base)).toBe('Hoy no cobramos comisión.')
    expect(partnerCommission({ ...base, claims: { ...base.claims, promo_no_commission: true } })).toContain('100 %')
    expect(partnerCommission({ ...base, commissionEnabled: true })).toContain('comisión por servicio')
  })

  it('pago directo salvo pago protegido', () => {
    expect(partnerPayout(base)).toContain('directo al cliente')
    expect(partnerPayout({ ...base, claims: { ...base.claims, trust_online_payment_protection: true } })).toContain('protege')
  })

  it('sin número de socios por debajo del mínimo', () => {
    expect(partnersJoinLine(base)).toBe('Únete a los socios verificados de LoHaggo.')
    expect(partnersJoinLine({ ...base, stats: { ...base.stats, verifiedPartners: 1234 } })).toContain('1.234')
  })

  it('ciudades activas y frase de la garantía', () => {
    expect(citiesLine(base)).toBeNull()
    expect(citiesLine({ ...base, stats: { ...base.stats, activeCities: ['Medellín', 'Envigado', 'Bello'] } })).toBe('Profesionales en Medellín, Envigado y Bello')
    expect(claimSays('trust_guarantee')).not.toContain('«')
    expect(claimSays('trust_guarantee')).toBe(POLICY_SUMMARY)
    expect(CLAIMS.trust_guarantee.says).toContain('/garantia')
  })
})
