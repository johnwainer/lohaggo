import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn<(a: any) => Promise<any>>(),
  bookingFindMany: vi.fn<(a: any) => Promise<any>>(),
  userFindUnique: vi.fn<(a: any) => Promise<any>>(),
  convFindUnique: vi.fn<(a: any) => Promise<any>>(),
  convUpdate: vi.fn(async (_a: any) => ({})),
  eventCreate: vi.fn(async (_a: any) => ({})),
  msgCreate: vi.fn(async (_a: any) => ({})),
  send: vi.fn<(a: any) => Promise<any>>(),
  report: vi.fn<(...a: any[]) => Promise<any>>(),
  reject: vi.fn<(...a: any[]) => Promise<any>>(),
  review: vi.fn<(...a: any[]) => Promise<any>>(),
  followup: vi.fn<(...a: any[]) => Promise<any>>(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: m.bookingFindUnique, findMany: m.bookingFindMany },
    user: { findUnique: m.userFindUnique },
    conversation: { findUnique: m.convFindUnique, update: m.convUpdate },
    conversationEvent: { create: m.eventCreate },
    conversationMessage: { create: m.msgCreate },
    notification: { findMany: vi.fn(async () => []) },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) }))
vi.mock('@/lib/inbox/send', () => ({ sendToConversation: m.send }))
vi.mock('@/lib/payments/ops', () => ({ reportClientPayment: m.report, rejectPartnerPayment: m.reject }))
vi.mock('@/lib/reviews/ops', () => ({ leaveReview: m.review }))
vi.mock('@/lib/bookings/followups', () => ({ applyFollowup: m.followup }))
vi.mock('@/lib/bookings/followup-buttons', () => ({ FOLLOWUP_SENDER: { type: 'AI', agentId: 'booking-followup', agentName: 'Seguimiento automático' } }))

import { handlePaymentButton, handlePaymentText } from '@/lib/bookings/payment-chat'

const tpl = (name: string) => ({ name, entityType: 'Booking', entityId: 'bk1', at: new Date().toISOString() })
const btn = (id: string, name: string) => ({ id, text: id, at: new Date().toISOString(), template: tpl(name) })
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'bk1', userId: 'u1', partnerId: 'p1', status: 'COMPLETED', user: { name: 'Ana Gómez' }, partner: { userId: 'pu1', user: { name: 'Samuel Ruiz' } },
  payment: null, review: null, ...over,
})
const client = { id: 'u1', role: 'CLIENT', email: 'a@x.co', isActive: true, partnerProfile: null }
const partner = { id: 'pu1', role: 'PARTNER', email: 'p@x.co', isActive: true, partnerProfile: { id: 'p1' } }
const reported = (method: string) => booking({ payment: { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED', clientReportedMethod: method } })

beforeEach(() => {
  vi.clearAllMocks()
  m.bookingFindUnique.mockResolvedValue(booking())
  m.userFindUnique.mockResolvedValue(client)
  m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: {} })
  m.report.mockResolvedValue({ confirmationStatus: 'CLIENT_REPORTED' })
  m.followup.mockResolvedValue({ message: 'Gracias, dejamos el pago registrado.' })
  m.send.mockResolvedValue({ ok: true })
})

describe('botón «Efectivo» del cliente (B14)', () => {
  it('registra el reporte, responde y no depende de nadie asignado', async () => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: 'admin1', customFields: {} })
    const ok = await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('pay_cash', 'lh_cliente_servicio_terminado_pago') })
    expect(ok).toBe(true)
    expect(m.report).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', role: 'CLIENT' }), 'bk1', { method: 'CASH' }, expect.objectContaining({ via: 'chat' }))
    expect(m.send.mock.calls[0][0].message).toMatch(/registramos que le pagaste a Samuel en efectivo[\s\S]*confirme[\s\S]*1 al 5/)
    expect(m.msgCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isInternal: true }) }))
    expect(m.eventCreate).toHaveBeenCalled()
  })
  it('otro usuario no puede reportar un pago ajeno', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ userId: 'someone-else' }))
    const ok = await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('pay_cash', 'lh_cliente_servicio_terminado_pago') })
    expect(ok).toBe(false)
    expect(m.report).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
  it('un socio con ese botón no hace nada', async () => {
    m.userFindUnique.mockResolvedValue(partner)
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'pu1', button: btn('pay_cash', 'lh_cliente_servicio_terminado_pago') })).toBe(false)
    expect(m.report).not.toHaveBeenCalled()
  })
  it('es idempotente: el mismo reporte no vuelve a avisar al socio', async () => {
    m.bookingFindUnique.mockResolvedValue(reported('CASH'))
    await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('pay_cash', 'lh_cliente_servicio_terminado_pago') })
    expect(m.report).not.toHaveBeenCalled()
    expect(m.send.mock.calls[0][0].message).toMatch(/Ya habíamos registrado/)
  })
  it('«Aún no pago» no cambia nada', async () => {
    await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('pay_not_yet', 'lh_cliente_pago_pendiente') })
    expect(m.report).not.toHaveBeenCalled()
    expect(m.send.mock.calls[0][0].message).toMatch(/efectivo[\s\S]*transferencia/)
  })
  it('si la reserva no está completada responde el motivo de las reglas', async () => {
    const { OpsError } = await import('@/lib/ops/origin')
    m.report.mockRejectedValue(new OpsError('La reserva debe estar completada para reportar el pago'))
    await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('pay_cash', 'lh_cliente_servicio_terminado_pago') })
    expect(m.send.mock.calls[0][0].message).toMatch(/completada/)
  })
})

describe('socio: recibido / no recibido', () => {
  beforeEach(() => { m.userFindUnique.mockResolvedValue(partner) })
  it('payment_confirm usa el medio que reportó el cliente', async () => {
    m.bookingFindUnique.mockResolvedValue(reported('DIRECT_TRANSFER'))
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'pu1', button: btn('payment_confirm', 'lh_socio_pago_reportado_v2') })).toBe(true)
    expect(m.followup).toHaveBeenCalledWith(expect.objectContaining({ role: 'PARTNER', partnerId: 'p1' }), 'bk1', 'partner_paid', expect.anything(), { method: 'DIRECT_TRANSFER' })
  })
  it('sin reporte del cliente pregunta el medio y no cambia nada', async () => {
    await handlePaymentButton({ conversationId: 'c1', userId: 'pu1', button: btn('payment_confirm', 'lh_socio_pago_por_confirmar_v2') })
    expect(m.followup).not.toHaveBeenCalled()
    expect(m.send.mock.calls[0][0].message).toMatch(/efectivo[\s\S]*transferencia/)
  })
  it('payment_reject rechaza con motivo', async () => {
    await handlePaymentButton({ conversationId: 'c1', userId: 'pu1', button: btn('payment_reject', 'lh_socio_pago_reportado_v2') })
    expect(m.reject).toHaveBeenCalledWith(expect.objectContaining({ role: 'PARTNER' }), 'bk1', expect.stringMatching(/no recibió/), expect.anything())
  })
  it('otro socio no puede confirmar', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ partnerId: 'other', payment: { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED', clientReportedMethod: 'CASH' } }))
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'pu1', button: btn('payment_confirm', 'lh_socio_pago_reportado_v2') })).toBe(false)
    expect(m.followup).not.toHaveBeenCalled()
  })
  it('un cliente con payment_confirm no hace nada', async () => {
    m.userFindUnique.mockResolvedValue(client)
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('payment_confirm', 'lh_socio_pago_reportado_v2') })).toBe(false)
  })
})

describe('calificación', () => {
  it('rate_5 deja la reseña del cliente sin comentario', async () => {
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('rate_5', 'lh_cliente_pago_confirmado_v2') })).toBe(true)
    expect(m.review).toHaveBeenCalledWith(expect.objectContaining({ role: 'CLIENT' }), { bookingId: 'bk1', rating: 5 }, expect.anything())
    expect(m.send.mock.calls[0][0].message).toMatch(/comentario/)
  })
  it('otro cliente no puede calificar', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ userId: 'other' }))
    expect(await handlePaymentButton({ conversationId: 'c1', userId: 'u1', button: btn('rate_5', 'lh_cliente_pago_confirmado_v2') })).toBe(false)
    expect(m.review).not.toHaveBeenCalled()
  })
})

describe('texto', () => {
  const fields = { lastTemplate: tpl('lh_cliente_servicio_terminado_pago') }
  beforeEach(() => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: 'admin1', customFields: fields })
    m.bookingFindMany.mockResolvedValue([{ id: 'bk1', status: 'COMPLETED', payment: null }])
  })
  it('«en efectivo» tras B14 con una sola reserva = reporte', async () => {
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'en efectivo' })).toBe(true)
    expect(m.report).toHaveBeenCalledWith(expect.anything(), 'bk1', { method: 'CASH' }, expect.anything())
  })
  it('con varias reservas candidatas no adivina', async () => {
    m.bookingFindMany.mockResolvedValue([{ id: 'bk1', status: 'COMPLETED', payment: null }, { id: 'bk2', status: 'COMPLETED', payment: null }])
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
    expect(m.report).not.toHaveBeenCalled()
  })
  it('sin plantilla de pago reciente no actúa', async () => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: {} })
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
  })
  it('el socio responde «sí, recibido» a C39', async () => {
    m.userFindUnique.mockResolvedValue(partner)
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: { lastTemplate: tpl('lh_socio_te_pagaron') } })
    m.bookingFindUnique.mockResolvedValue(reported('CASH'))
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'sí, recibido' })).toBe(true)
    expect(m.followup).toHaveBeenCalledWith(expect.anything(), 'bk1', 'partner_paid', expect.anything(), { method: 'CASH' })
  })
  it('el socio escribe «efectivo» a C39 y queda confirmado con ese medio', async () => {
    m.userFindUnique.mockResolvedValue(partner)
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: { lastTemplate: tpl('lh_socio_te_pagaron') } })
    await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'efectivo' })
    expect(m.followup).toHaveBeenCalledWith(expect.anything(), 'bk1', 'partner_paid', expect.anything(), { method: 'CASH' })
  })
  it('un dígito solo califica justo después de que lo pedimos', async () => {
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '5' })).toBe(false)
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: { paymentChat: { bookingId: 'bk1', step: 'rate', at: new Date().toISOString() } } })
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '5' })).toBe(true)
    expect(m.review).toHaveBeenCalledWith(expect.anything(), { bookingId: 'bk1', rating: 5 }, expect.anything())
  })
})
