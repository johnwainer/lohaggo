import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  eventCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'e', ...a.data })),
  paymentUpsert: vi.fn<(a: any) => Promise<any>>(),
  paymentUpdate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'pay1', ...a.data })),
  paymentFindUnique: vi.fn(),
  configFindFirst: vi.fn(),
  payoutFindUnique: vi.fn(),
  payoutCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'po1', ...a.data })),
  bankFindFirst: vi.fn(),
  userFindMany: vi.fn(async () => [{ id: 'adm1' }]),
  createNotification: vi.fn(async (_a: any) => ({})),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: m.bookingFindUnique },
    bookingEvent: { create: m.eventCreate },
    payment: { upsert: m.paymentUpsert, update: m.paymentUpdate, findUnique: m.paymentFindUnique },
    platformConfig: { findFirst: m.configFindFirst },
    payout: { findUnique: m.payoutFindUnique, create: m.payoutCreate },
    partnerBankAccount: { findFirst: m.bankFindFirst },
    user: { findMany: m.userFindMany },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: m.createNotification, notifyBookingStatusChange: vi.fn() }))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: vi.fn() }))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: vi.fn() }))
vi.mock('@/lib/mercadopago', () => ({ getMercadoPagoClient: vi.fn(async () => { throw new Error('no creds') }) }))
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' } }))

import { confirmPartnerPayment, ensurePayoutForPayment, mercadoPagoLinkFor, paymentSummaryForChat, rejectPartnerPayment, reportClientPayment, undoClientReport } from '@/lib/payments/ops'
import { APP_ORIGIN, chatOrigin, type Actor } from '@/lib/ops/origin'

const client: Actor = { userId: 'u1', role: 'CLIENT', email: 'c@x.co' }
const partner: Actor = { userId: 'pu1', role: 'PARTNER', partnerId: 'p1', email: 'p@x.co' }
const chat = chatOrigin({ channel: 'WHATSAPP', conversationId: 'conv1', agentId: 'ag1' })

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'bk1', userId: 'u1', partnerId: 'p1', status: 'COMPLETED', totalPrice: 130000, partnerCommissionRate: null,
  payment: null, partner: { user: { id: 'partner-user', name: 'Darwin' } }, user: { id: 'u1', name: 'Ana' }, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.configFindFirst.mockResolvedValue({ cashEnabled: true, transferEnabled: true, partnerCommissionRate: 10, mercadoPagoEnabled: false })
  m.paymentUpsert.mockImplementation(async (a: { create: Record<string, unknown> }) => ({ id: 'pay1', ...a.create }))
  m.payoutFindUnique.mockResolvedValue(null)
  m.bankFindFirst.mockResolvedValue({ id: 'bank1' })
})

describe('reportClientPayment', () => {
  it('desde el chat deja origin chat en el Payment creado, queda CLIENT_REPORTED y avisa al socio', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    const payment = await reportClientPayment(client, 'bk1', { method: 'CASH', note: 'en la puerta' }, chat)
    expect(payment).toMatchObject({ confirmationStatus: 'CLIENT_REPORTED', status: 'PENDING', clientReportedMethod: 'CASH' })
    expect(m.paymentUpsert.mock.calls[0][0].create).toMatchObject({ origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'conv1', originAgentId: 'ag1', totalAmount: 130000 })
    expect(m.paymentUpsert.mock.calls[0][0].update).not.toHaveProperty('origin')
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ type: 'payment', actorType: 'ai', origin: 'chat', detail: 'Cliente reportó pago en efectivo' })
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'partner-user', type: 'PAYMENT_REPORTED_BY_CLIENT' })
    expect(m.payoutCreate).not.toHaveBeenCalled()
  })

  it('desde la app el origen es app y el actor es client', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    await reportClientPayment(client, 'bk1', { method: 'DIRECT_TRANSFER' }, APP_ORIGIN)
    expect(m.paymentUpsert.mock.calls[0][0].create).toMatchObject({ origin: 'app', originChannel: null })
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ actorType: 'client', detail: 'Cliente reportó pago en transferencia' })
  })

  it('solo el cliente dueño, con la reserva completada y el método habilitado', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    await expect(reportClientPayment(partner, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    await expect(reportClientPayment({ ...client, userId: 'other' }, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'CONFIRMED' }))
    await expect(reportClientPayment(client, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.configFindFirst.mockResolvedValue({ cashEnabled: false, transferEnabled: true })
    m.bookingFindUnique.mockResolvedValue(booking())
    await expect(reportClientPayment(client, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: /efectivo no está habilitado/ })
    expect(m.paymentUpsert).not.toHaveBeenCalled()
  })

  it('un pago ya confirmado no se vuelve a reportar → 409', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { confirmationStatus: 'CONFIRMED', status: 'APPROVED' } }))
    await expect(reportClientPayment(client, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
  })

  it('si el socio ya había dejado el mismo método (disputa previa) queda confirmado y se crea el payout', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'DISPUTED', status: 'PENDING', partnerConfirmedMethod: 'CASH' } }))
    const payment = await reportClientPayment(client, 'bk1', { method: 'CASH' }, APP_ORIGIN)
    expect(payment).toMatchObject({ confirmationStatus: 'CONFIRMED', status: 'APPROVED' })
    expect(m.payoutCreate).toHaveBeenCalledTimes(1)
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ type: 'PAYMENT_CONFIRMED_BY_PARTNER', userId: 'partner-user' })
  })
})

describe('confirmPartnerPayment', () => {
  it('crea el Payout con la comisión de la reserva y la cuenta por defecto, y no lo duplica', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ partnerCommissionRate: 12, payment: { id: 'pay1', confirmationStatus: 'CLIENT_REPORTED', status: 'PENDING', clientReportedMethod: 'CASH' } }))
    const payment = await confirmPartnerPayment(partner, 'bk1', { method: 'CASH' }, APP_ORIGIN)
    expect(payment).toMatchObject({ confirmationStatus: 'CONFIRMED', status: 'APPROVED', partnerConfirmedMethod: 'CASH' })
    expect(payment.paidAt).toBeInstanceOf(Date)
    expect(m.payoutCreate).toHaveBeenCalledTimes(1)
    expect(m.payoutCreate.mock.calls[0][0].data).toEqual({
      paymentId: 'pay1', partnerId: 'p1', bankAccountId: 'bank1', amount: 130000, partnerCommission: 15600, partnerCommissionRate: 12, netAmount: 114400, status: 'PENDING',
    })
    expect(m.bankFindFirst.mock.calls[0][0].where).toEqual({ partnerId: 'p1', isDefault: true, isActive: true })
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'u1', type: 'PAYMENT_CONFIRMED_BY_PARTNER', title: 'Pago confirmado por el socio' })
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ type: 'payment', actorType: 'partner', detail: 'Socio confirmó pago en efectivo' })

    // second approval for the same payment finds the existing payout
    m.payoutFindUnique.mockResolvedValue({ id: 'po1' })
    await ensurePayoutForPayment({ id: 'pay1', serviceAmount: 130000, totalAmount: 130000 }, { id: 'bk1', partnerId: 'p1', partnerCommissionRate: 12 })
    expect(m.payoutCreate).toHaveBeenCalledTimes(1)
  })

  it('sin tasa en la reserva usa la de la plataforma; sin cuenta por defecto bankAccountId null', async () => {
    m.bankFindFirst.mockResolvedValue(null)
    m.bookingFindUnique.mockResolvedValue(booking())
    await confirmPartnerPayment(partner, 'bk1', { method: 'DIRECT_TRANSFER' }, APP_ORIGIN)
    expect(m.payoutCreate.mock.calls[0][0].data).toMatchObject({ bankAccountId: null, partnerCommissionRate: 10, partnerCommission: 13000, netAmount: 117000 })
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ title: 'El socio marcó tu reserva como pagada' })
  })

  it('método distinto al del cliente → disputa: avisa al cliente y a los admins, sin payout', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'CLIENT_REPORTED', status: 'PENDING', clientReportedMethod: 'DIRECT_TRANSFER' } }))
    const payment = await confirmPartnerPayment(partner, 'bk1', { method: 'CASH' }, chat)
    expect(payment).toMatchObject({ confirmationStatus: 'DISPUTED', status: 'PENDING' })
    expect(m.payoutCreate).not.toHaveBeenCalled()
    const targets = m.createNotification.mock.calls.map((c) => c[0].userId)
    expect(targets).toEqual(['u1', 'adm1'])
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ actorType: 'ai', origin: 'chat' })
  })

  it('exige socio de la reserva, reserva completada, método habilitado y pago no confirmado', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    await expect(confirmPartnerPayment(client, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    await expect(confirmPartnerPayment({ ...partner, partnerId: 'p2' }, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'IN_PROGRESS' }))
    await expect(confirmPartnerPayment(partner, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.bookingFindUnique.mockResolvedValue(booking())
    m.configFindFirst.mockResolvedValue({ cashEnabled: true, transferEnabled: false })
    await expect(confirmPartnerPayment(partner, 'bk1', { method: 'DIRECT_TRANSFER' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: /transferencia directa no está habilitada/ })
    m.configFindFirst.mockResolvedValue({ cashEnabled: true, transferEnabled: true })
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { confirmationStatus: 'CONFIRMED', status: 'APPROVED' } }))
    await expect(confirmPartnerPayment(partner, 'bk1', { method: 'CASH' }, APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
    expect(m.paymentUpsert).not.toHaveBeenCalled()
  })
})

describe('rejectPartnerPayment', () => {
  it('rechaza un reporte del cliente, limpia y avisa', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'CLIENT_REPORTED', status: 'PENDING' } }))
    const payment = await rejectPartnerPayment(partner, 'bk1', 'No llegó la plata', APP_ORIGIN)
    expect(payment).toMatchObject({ confirmationStatus: 'REJECTED_BY_PARTNER', status: 'PENDING', rejectionReason: 'No llegó la plata', clientReportedMethod: null, paidAt: null })
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'u1', type: 'PAYMENT_REJECTED_BY_PARTNER' })
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ type: 'payment', detail: 'Socio rechazó el pago reportado: No llegó la plata' })
  })

  it('en estado CONFIRMED → 409; sin pago → 400; motivo corto → 400', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'CONFIRMED', status: 'APPROVED' } }))
    await expect(rejectPartnerPayment(partner, 'bk1', 'No llegó la plata', APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
    m.bookingFindUnique.mockResolvedValue(booking())
    await expect(rejectPartnerPayment(partner, 'bk1', 'No llegó la plata', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    await expect(rejectPartnerPayment(partner, 'bk1', 'no', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    expect(m.paymentUpdate).not.toHaveBeenCalled()
  })
})

describe('undoClientReport', () => {
  it('vuelve a NONE solo si está CLIENT_REPORTED', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'CLIENT_REPORTED' } }))
    const payment = await undoClientReport(client, 'bk1')
    expect(payment).toMatchObject({ confirmationStatus: 'NONE', clientReportedMethod: null })
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay1', confirmationStatus: 'CONFIRMED' } }))
    await expect(undoClientReport(client, 'bk1')).rejects.toMatchObject({ status: 400 })
    await expect(undoClientReport(partner, 'bk1')).rejects.toMatchObject({ status: 403 })
  })
})

describe('mercadoPagoLinkFor', () => {
  it('con MercadoPago apagado → 400 sin tocar la reserva', async () => {
    await expect(mercadoPagoLinkFor(client, 'bk1')).rejects.toMatchObject({ status: 400, message: 'MercadoPago no está habilitado' })
    expect(m.bookingFindUnique).not.toHaveBeenCalled()
  })

  it('encendido pero sin credenciales → 400 «no está configurado»', async () => {
    m.configFindFirst.mockResolvedValue({ mercadoPagoEnabled: true, clientCommissionRate: 5 })
    m.bookingFindUnique.mockResolvedValue({ ...booking(), clientCommissionRate: 5, service: { name: 'Plomería' }, user: { name: 'Ana', email: 'c@x.co' } })
    m.paymentFindUnique.mockResolvedValue(null)
    await expect(mercadoPagoLinkFor(client, 'bk1')).rejects.toMatchObject({ status: 400, message: 'MercadoPago no está configurado' })
  })
})

describe('paymentSummaryForChat', () => {
  it('describe el estado del pago en una línea', () => {
    expect(paymentSummaryForChat({ totalPrice: 130000, payment: null })).toBe('Pago: $130.000 · pendiente')
    expect(paymentSummaryForChat({ totalPrice: 130000, payment: { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED', clientReportedMethod: 'CASH', totalAmount: 130000 } })).toBe('Pago: $130.000 · reportado por el cliente (efectivo)')
    expect(paymentSummaryForChat({ totalPrice: 130000, payment: { status: 'APPROVED', confirmationStatus: 'CONFIRMED', totalAmount: 136500 } })).toBe('Pago: $136.500 · confirmado')
    expect(paymentSummaryForChat({ totalPrice: 130000, payment: { status: 'PENDING', confirmationStatus: 'DISPUTED' } })).toBe('Pago: $130.000 · en disputa')
  })
})
