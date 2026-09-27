import { describe, expect, it } from 'vitest'
import {
  eligibility, isOnlinePayment, isOverdue, POLICY_FULL, POLICY_SUMMARY, remedyAllowed, remedyOptions, slaDueAt, statusAfter,
  STRIKES_TO_PAUSE, STRIKE_WINDOW_DAYS, strikeConsequence, strikeSuggested, claimPriority,
} from '@/lib/guarantee/policy'

const H = 3600_000
const at = new Date('2026-09-27T15:00:00.000Z')
const base = { status: 'CONFIRMED', partnerId: 'p1', scheduledAt: at, completedAt: null as Date | null }
const later = (h: number) => new Date(at.getTime() + h * H)

describe('eligibility · NO_SHOW', () => {
  it('desde la hora programada y hasta 24 h después', () => {
    expect(eligibility(base, 'NO_SHOW', later(-0.5)).ok).toBe(false)
    expect(eligibility(base, 'NO_SHOW', later(0)).ok).toBe(true)
    expect(eligibility(base, 'NO_SHOW', later(23.9)).ok).toBe(true)
    const late = eligibility(base, 'NO_SHOW', later(24.1))
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.reason).toMatch(/plazo/)
  })
  it('no para reservas canceladas, completadas o sin socio', () => {
    expect(eligibility({ ...base, status: 'CANCELLED' }, 'NO_SHOW', later(1)).ok).toBe(false)
    expect(eligibility({ ...base, status: 'COMPLETED', completedAt: later(0.5) }, 'NO_SHOW', later(1)).ok).toBe(false)
    expect(eligibility({ ...base, partnerId: null }, 'NO_SHOW', later(1)).ok).toBe(false)
  })
})

describe('eligibility · BAD_WORK y DAMAGE', () => {
  const done = { ...base, status: 'COMPLETED', completedAt: later(2) }
  it('trabajo mal hecho: solo completada y hasta 72 h después de completada', () => {
    expect(eligibility(base, 'BAD_WORK', later(3)).ok).toBe(false)
    expect(eligibility(done, 'BAD_WORK', later(2 + 71)).ok).toBe(true)
    expect(eligibility(done, 'BAD_WORK', later(2 + 73)).ok).toBe(false)
  })
  it('daño: durante el servicio o hasta 72 h después; no antes de empezar', () => {
    expect(eligibility({ ...base, status: 'IN_PROGRESS' }, 'DAMAGE', later(1)).ok).toBe(true)
    expect(eligibility(done, 'DAMAGE', later(10)).ok).toBe(true)
    expect(eligibility(done, 'DAMAGE', later(100)).ok).toBe(false)
    expect(eligibility(base, 'DAMAGE', later(1)).ok).toBe(false)
  })
})

describe('remedios', () => {
  it('no llegó: otro socio, cancelar sin costo y, con pago en línea, reembolso total', () => {
    expect(remedyOptions('NO_SHOW', false).map((r) => r.remedy)).toEqual(['reassign', 'cancel_free', 'reject'])
    expect(remedyOptions('NO_SHOW', true).map((r) => r.remedy)).toEqual(['reassign', 'cancel_free', 'refund', 'reject'])
  })
  it('trabajo mal hecho: corregir, otro socio, y reembolso solo con pago en línea (si no, pedir devolución)', () => {
    expect(remedyOptions('BAD_WORK', false).map((r) => r.remedy)).toEqual(['redo', 'reassign', 'mediation', 'reject'])
    expect(remedyOptions('BAD_WORK', true).map((r) => r.remedy)).toEqual(['redo', 'reassign', 'refund', 'reject'])
    expect(remedyAllowed('BAD_WORK', 'refund', false)).toBe(false)
  })
  it('daño: solo mediación, nunca dinero', () => {
    expect(remedyOptions('DAMAGE', true).map((r) => r.remedy)).toEqual(['mediation', 'reject'])
    expect(remedyAllowed('DAMAGE', 'refund', true)).toBe(false)
  })
  it('estado tras el remedio', () => {
    expect(statusAfter('BAD_WORK', 'redo')).toBe('REDO_SCHEDULED')
    expect(statusAfter('NO_SHOW', 'reassign')).toBe('REASSIGNED')
    expect(statusAfter('NO_SHOW', 'refund')).toBe('RESOLVED')
    expect(statusAfter('BAD_WORK', 'refund')).toBe('REFUND_REVIEW')
    expect(statusAfter('DAMAGE', 'reject')).toBe('REJECTED')
  })
  it('prioridad: daño y no llegó alta; trabajo mal hecho media', () => {
    expect(claimPriority('DAMAGE')).toBe('HIGH')
    expect(claimPriority('NO_SHOW')).toBe('HIGH')
    expect(claimPriority('BAD_WORK')).toBe('MEDIUM')
  })
})

describe('faltas del socio', () => {
  it(`${STRIKES_TO_PAUSE} faltas en ${STRIKE_WINDOW_DAYS} días pausan; 3 abren la decisión de suspender`, () => {
    expect(strikeConsequence(1)).toBe('none')
    expect(strikeConsequence(2)).toBe('pause')
    expect(strikeConsequence(3)).toBe('review_suspension')
  })
  it('se sugiere falta para no llegó y trabajo mal hecho confirmados, no para daño ni rechazo', () => {
    expect(strikeSuggested('NO_SHOW', 'reassign')).toBe(true)
    expect(strikeSuggested('BAD_WORK', 'redo')).toBe(true)
    expect(strikeSuggested('DAMAGE', 'mediation')).toBe(false)
    expect(strikeSuggested('NO_SHOW', 'reject')).toBe(false)
  })
})

describe('plazos, pago en línea y textos', () => {
  it('SLA de 72 h y vencido solo si sigue activo', () => {
    const due = slaDueAt(at)
    expect(due.getTime() - at.getTime()).toBe(72 * H)
    expect(isOverdue({ status: 'OPEN', slaDueAt: due }, later(73))).toBe(true)
    expect(isOverdue({ status: 'RESOLVED', slaDueAt: due }, later(73))).toBe(false)
    expect(isOverdue({ status: 'OPEN', slaDueAt: due }, later(1))).toBe(false)
  })
  it('pago en línea = aprobado y por MercadoPago', () => {
    expect(isOnlinePayment({ status: 'APPROVED', mercadopagoId: 'mp1' })).toBe(true)
    expect(isOnlinePayment({ status: 'APPROVED', mercadopagoId: null, partnerConfirmedMethod: 'CASH' })).toBe(false)
    expect(isOnlinePayment({ status: 'PENDING', mercadopagoId: 'mp1' })).toBe(false)
    expect(isOnlinePayment(null)).toBe(false)
  })
  it('el resumen son 3 frases, no promete pagar daños, y la política completa dice lo que no cubre', () => {
    expect(POLICY_SUMMARY.split(/(?<=\.)\s/).length).toBe(3)
    expect(POLICY_SUMMARY).not.toMatch(/«|»/)
    expect(POLICY_FULL).toMatch(/no es un seguro/)
    expect(POLICY_FULL).toMatch(/por fuera de LoHaggo/)
    expect(POLICY_FULL).toMatch(/hola@lohaggo\.com/)
    expect(POLICY_FULL).toMatch(/valor del servicio/)
  })
})
