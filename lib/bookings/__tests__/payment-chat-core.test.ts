import { describe, expect, it } from 'vitest'
import {
  CLIENT_PAY_PROMPTS, PARTNER_PAY_PROMPTS, isPartnerPaidYes, isUnpaidCompleted, onlyCandidate, paymentButtonIntent, paymentMethodFromText,
  paymentReplyStale, promptedBookingIds, ratingFromText,
} from '@/lib/bookings/payment-chat-core'

describe('botón → acción', () => {
  it('pay_cash / pay_transfer en B14 y B15 reportan el pago del cliente', () => {
    expect(paymentButtonIntent('pay_cash', 'lh_cliente_servicio_terminado_pago')).toEqual({ kind: 'client_report', method: 'CASH' })
    expect(paymentButtonIntent('pay_transfer', 'lh_cliente_pago_pendiente')).toEqual({ kind: 'client_report', method: 'DIRECT_TRANSFER' })
    expect(paymentButtonIntent('pay_not_yet', 'lh_cliente_pago_pendiente')).toEqual({ kind: 'client_not_yet' })
  })
  it('payment_confirm / payment_reject solo en C20 y C21', () => {
    expect(paymentButtonIntent('payment_confirm', 'lh_socio_pago_reportado_v2')).toEqual({ kind: 'partner_confirm' })
    expect(paymentButtonIntent('payment_reject', 'lh_socio_pago_por_confirmar_v2')).toEqual({ kind: 'partner_reject' })
    expect(paymentButtonIntent('payment_confirm', 'lh_socio_te_pagaron')).toBeNull()
  })
  it('rate_5 / rate_4 en B16 y B18', () => {
    expect(paymentButtonIntent('rate_5', 'lh_cliente_pago_confirmado_v2')).toEqual({ kind: 'rate', stars: 5 })
    expect(paymentButtonIntent('rate_4', 'lh_cliente_recordatorio_calificar_v2')).toEqual({ kind: 'rate', stars: 4 })
  })
  it('el mismo id en otra plantilla o plantilla desconocida va al agente', () => {
    expect(paymentButtonIntent('pay_cash', 'lh_socio_pago_reportado_v2')).toBeNull()
    expect(paymentButtonIntent('rate_5', null)).toBeNull()
    expect(paymentButtonIntent('guarantee_claim', 'lh_cliente_servicio_terminado_pago')).toBeNull()
  })
})

describe('texto → medio de pago', () => {
  it.each([
    ['Efectivo', 'CASH'], ['en efectivo', 'CASH'], ['Le pagué en efectivo', 'CASH'], ['ya le pague en efectivo!', 'CASH'],
    ['Transferencia', 'DIRECT_TRANSFER'], ['por transferencia', 'DIRECT_TRANSFER'], ['le pagué por transferencia', 'DIRECT_TRANSFER'], ['le transferí por Nequi', 'DIRECT_TRANSFER'],
  ])('«%s»', (t, m) => expect(paymentMethodFromText(t)).toBe(m))
  it.each([
    '', 'hola', 'no le he pagado en efectivo', 'todavía no, pago por transferencia mañana', '¿puedo pagar en efectivo?', 'efectivo o transferencia',
    'le pagué en efectivo pero el señor no quiso recibirlo y me dijo que volviera mañana',
  ])('«%s» no es un reporte', (t) => expect(paymentMethodFromText(t)).toBeNull())
})

describe('socio y calificación en texto', () => {
  it.each(['Sí', 'si', 'recibido', 'Sí, lo recibí', 'ya me pagaron', 'Si ya me pagó', 'listo'])('«%s» es un sí del socio', (t) => expect(isPartnerPaidYes(t)).toBe(true))
  it.each(['no', 'aún no me paga', 'sí pero falta la mitad', 'hola', ''])('«%s» no lo es', (t) => expect(isPartnerPaidYes(t)).toBe(false))
  it('calificación', () => {
    expect(ratingFromText('5')).toBe(5)
    expect(ratingFromText('4 estrellas')).toBe(4)
    expect(ratingFromText('6')).toBeNull()
    expect(ratingFromText('quiero 5 pesos')).toBeNull()
  })
})

describe('reserva candidata', () => {
  const now = Date.parse('2026-11-12T15:00:00Z')
  const mark = (name: string, id: string, hoursAgo: number) => ({ name, entityType: 'Booking', entityId: id, at: new Date(now - hoursAgo * 3600_000).toISOString() })
  it('toma las plantillas de pago de las últimas 48 h, sin repetir', () => {
    const f = { lastTemplate: mark('lh_cliente_pago_pendiente', 'b1', 2), recentTemplates: [mark('lh_cliente_pago_pendiente', 'b1', 2), mark('lh_cliente_servicio_terminado_pago', 'b2', 60), mark('lh_cliente_servicio_terminado_pago', 'b3', 30), mark('lh_cliente_recordatorio_calificar_v2', 'b4', 1)] }
    expect(promptedBookingIds(f, CLIENT_PAY_PROMPTS, now).sort()).toEqual(['b1', 'b3'])
    expect(promptedBookingIds(null, CLIENT_PAY_PROMPTS, now)).toEqual([])
  })
  it('el socio usa sus plantillas', () => {
    const f = { lastTemplate: mark('lh_socio_te_pagaron', 'b9', 5) }
    expect(promptedBookingIds(f, PARTNER_PAY_PROMPTS, now)).toEqual(['b9'])
    expect(promptedBookingIds(f, CLIENT_PAY_PROMPTS, now)).toEqual([])
  })
  it('solo una candidata: con varias no adivina', () => {
    expect(onlyCandidate([{ id: 'a' }])?.id).toBe('a')
    expect(onlyCandidate([{ id: 'a' }, { id: 'b' }])).toBeNull()
    expect(onlyCandidate([])).toBeNull()
  })
  it('completada y sin pagar', () => {
    expect(isUnpaidCompleted({ status: 'COMPLETED', payment: null })).toBe(true)
    expect(isUnpaidCompleted({ status: 'COMPLETED', payment: { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED' } })).toBe(true)
    expect(isUnpaidCompleted({ status: 'COMPLETED', payment: { status: 'APPROVED', confirmationStatus: 'CONFIRMED' } })).toBe(false)
    expect(isUnpaidCompleted({ status: 'CONFIRMED', payment: null })).toBe(false)
  })
})

describe('respuesta de pago sin registrar tras 2 h', () => {
  const base = { lastButtonId: 'pay_cash', lastButtonAt: '2026-11-11T20:00:00Z', now: Date.parse('2026-11-11T23:00:00Z'), completedAt: Date.parse('2026-11-11T19:00:00Z'), confirmationStatus: 'NONE' }
  it('se marca pasadas 2 h', () => expect(paymentReplyStale(base)).toBe(true))
  it('antes de 2 h no', () => expect(paymentReplyStale({ ...base, now: Date.parse('2026-11-11T21:30:00Z') })).toBe(false))
  it('si ya hay reporte se cierra sola', () => expect(paymentReplyStale({ ...base, confirmationStatus: 'CLIENT_REPORTED' })).toBe(false))
  it('un botón anterior al servicio o que no es de pago no cuenta', () => {
    expect(paymentReplyStale({ ...base, completedAt: Date.parse('2026-11-11T21:00:00Z') })).toBe(false)
    expect(paymentReplyStale({ ...base, lastButtonId: 'rate_5' })).toBe(false)
  })
})
