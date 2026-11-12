import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn<(a: any) => Promise<any>>(),
  bookingFindMany: vi.fn<(a: any) => Promise<any>>(),
  userFindUnique: vi.fn<(a: any) => Promise<any>>(),
  convFindUnique: vi.fn<(a: any) => Promise<any>>(),
  convUpdate: vi.fn(async (_a: any) => ({})),
  eventCreate: vi.fn(async (_a: any) => ({})),
  msgCreate: vi.fn(async (_a: any) => ({})),
  msgFindFirst: vi.fn<(a: any) => Promise<any>>(),
  dispatchFindMany: vi.fn<(a: any) => Promise<any>>(),
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
    conversationMessage: { create: m.msgCreate, findFirst: m.msgFindFirst },
    notificationDispatchLog: { findMany: m.dispatchFindMany },
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
  m.msgFindFirst.mockResolvedValue(null)
  m.dispatchFindMany.mockResolvedValue([])
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

const lastOut = (over: Record<string, unknown> = {}) => ({ sentAt: new Date(), body: 'prompt', sentById: null, ...over })
const humanAfter = () => lastOut({ sentAt: new Date(Date.now() + 60_000), sentById: 'admin1', body: 'Hola, te ayudo' })
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)
const markAt = (name: string, h: number, entityId = 'bk1') => ({ name, entityType: 'Booking', entityId, at: hoursAgo(h).toISOString() })

describe('texto', () => {
  const fields = { lastTemplate: tpl('lh_cliente_servicio_terminado_pago') }
  beforeEach(() => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: 'admin1', customFields: fields })
    m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(fields.lastTemplate.at) }))
    m.bookingFindMany.mockResolvedValue([{ id: 'bk1', status: 'COMPLETED', payment: null }])
  })
  it('«en efectivo» tras B14 aunque el chat esté asignado a una persona = reporte', async () => {
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'en efectivo' })).toBe(true)
    expect(m.report).toHaveBeenCalledWith(expect.anything(), 'bk1', { method: 'CASH' }, expect.anything())
  })
  it('si una persona o el agente escribió después de B14 no se aplica el texto', async () => {
    m.msgFindFirst.mockResolvedValue(humanAfter())
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
    expect(m.report).not.toHaveBeenCalled()
  })
  it('B14 de hace más de 48 h no cuenta', async () => {
    const old = markAt('lh_cliente_pago_pendiente', 50)
    m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { lastTemplate: old } })
    m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(old.at) }))
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
  })
  it('una plantilla de pago anterior (no la última) ya no sirve: aunque esté en recentTemplates', async () => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { lastTemplate: markAt('lh_otra', 1), recentTemplates: [markAt('lh_cliente_pago_pendiente', 2)] } })
    m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: hoursAgo(1) }))
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
  })
  it('sin plantilla de pago reciente no actúa', async () => {
    m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: {} })
    expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'efectivo' })).toBe(false)
  })
  describe('socio', () => {
    const c39 = tpl('lh_socio_te_pagaron')
    beforeEach(() => {
      m.userFindUnique.mockResolvedValue(partner)
      m.convFindUnique.mockResolvedValue({ id: 'c1', assignedToId: null, customFields: { lastTemplate: c39 } })
      m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(c39.at) }))
      m.bookingFindUnique.mockResolvedValue(reported('CASH'))
    })
    it('«sí, recibido» a C39 como último mensaje confirma', async () => {
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'sí, recibido' })).toBe(true)
      expect(m.followup).toHaveBeenCalledWith(expect.anything(), 'bk1', 'partner_paid', expect.anything(), { method: 'CASH' })
    })
    it('escribe «efectivo» a C39 y queda confirmado con ese medio', async () => {
      await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'efectivo' })
      expect(m.followup).toHaveBeenCalledWith(expect.anything(), 'bk1', 'partner_paid', expect.anything(), { method: 'CASH' })
    })
    it('un «sí» genérico después de otro mensaje nuestro no confirma el pago', async () => {
      m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(Date.now() + 120_000), body: '¿Confirmas la cita de mañana?' }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'sí' })).toBe(false)
      expect(m.followup).not.toHaveBeenCalled()
    })
    it('un aviso de pago de hace más de 24 h no cuenta', async () => {
      const old = markAt('lh_socio_te_pagaron', 25)
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { lastTemplate: old } })
      m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(old.at) }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'sí' })).toBe(false)
      expect(m.followup).not.toHaveBeenCalled()
    })
    it('un aviso de otra reserva no actúa sobre esta (el booking es el del aviso)', async () => {
      const other = markAt('lh_socio_te_pagaron', 1, 'bk-other')
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { lastTemplate: other } })
      m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(other.at) }))
      m.bookingFindMany.mockResolvedValue([])
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'WHATSAPP', body: 'sí' })).toBe(false)
      expect(m.bookingFindMany.mock.calls[0][0].where.id).toEqual({ in: ['bk-other'] })
    })
  })
  describe('calificación escrita', () => {
    const ask = () => ({ paymentChat: { bookingId: 'bk1', step: 'rate', at: new Date().toISOString() } })
    it('solo si lo último que enviamos es el pedido de calificación', async () => {
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: ask() })
      m.msgFindFirst.mockResolvedValue(lastOut({ body: 'Listo. ¿Cómo te fue? Califica del 1 al 5 (5 es excelente).' }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '5' })).toBe(true)
      expect(m.review).toHaveBeenCalledWith(expect.anything(), { bookingId: 'bk1', rating: 5 }, expect.anything())
    })
    it('un dígito sin pedido previo no califica', async () => {
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '5' })).toBe(false)
      expect(m.review).not.toHaveBeenCalled()
    })
    it('si después del pedido llegó otro mensaje nuestro o de una persona, el dígito no califica y el paso se borra', async () => {
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: ask() })
      m.msgFindFirst.mockResolvedValue(lastOut({ body: 'Te llamo en 5 minutos', sentById: 'admin1' }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '5' })).toBe(false)
      expect(m.review).not.toHaveBeenCalled()
      expect(m.convUpdate).toHaveBeenCalled()
      expect(m.convUpdate.mock.calls[0][0].data.customFields).not.toHaveProperty('paymentChat')
    })
    it('otro mensaje cualquiera borra el paso de calificación', async () => {
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: ask() })
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: 'gracias, ¿puedo cambiar la dirección?' })).toBe(false)
      expect(m.convUpdate.mock.calls[0][0].data.customFields).not.toHaveProperty('paymentChat')
    })
    it('la plantilla de calificar como último mensaje también vale', async () => {
      const t = tpl('lh_cliente_recordatorio_calificar_v2')
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { lastTemplate: t } })
      m.msgFindFirst.mockResolvedValue(lastOut({ sentAt: new Date(t.at) }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'WHATSAPP', body: '4 estrellas' })).toBe(true)
      expect(m.review).toHaveBeenCalledWith(expect.anything(), { bookingId: 'bk1', rating: 4 }, expect.anything())
    })
  })
  describe('SMS', () => {
    const sent = (at = new Date()) => [{ createdAt: at, notification: { data: JSON.stringify({ bookingId: 'bk1' }) } }]
    beforeEach(() => {
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: {} })
      m.dispatchFindMany.mockResolvedValue(sent())
    })
    it('el reporte del cliente sí aplica con un SMS realmente enviado', async () => {
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'SMS', body: 'efectivo' })).toBe(true)
      expect(m.dispatchFindMany.mock.calls[0][0].where).toMatchObject({ channel: 'SMS', userId: 'u1' })
      expect(m.report).toHaveBeenCalled()
    })
    it('sin SMS enviado (solo una notificación) no actúa', async () => {
      m.dispatchFindMany.mockResolvedValue([])
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'SMS', body: 'efectivo' })).toBe(false)
    })
    it('si después del SMS se escribió algo en el chat, no actúa', async () => {
      m.dispatchFindMany.mockResolvedValue(sent(hoursAgo(3)))
      m.msgFindFirst.mockResolvedValue(humanAfter())
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'SMS', body: 'efectivo' })).toBe(false)
    })
    it('el socio por SMS no confirma ni por «sí» ni por método', async () => {
      m.userFindUnique.mockResolvedValue(partner)
      m.bookingFindUnique.mockResolvedValue(reported('CASH'))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'SMS', body: 'sí' })).toBe(false)
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'pu1', channel: 'SMS', body: 'efectivo' })).toBe(false)
      expect(m.followup).not.toHaveBeenCalled()
    })
    it('la calificación por SMS no se acepta', async () => {
      m.convFindUnique.mockResolvedValue({ id: 'c1', customFields: { paymentChat: { bookingId: 'bk1', step: 'rate', at: new Date().toISOString() } } })
      m.msgFindFirst.mockResolvedValue(lastOut({ body: '¿Cómo te fue? Califica del 1 al 5 (5 es excelente).' }))
      expect(await handlePaymentText({ conversationId: 'c1', userId: 'u1', channel: 'SMS', body: '5' })).toBe(false)
      expect(m.review).not.toHaveBeenCalled()
    })
  })
})
