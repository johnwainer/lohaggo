import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn<(a: any) => Promise<any>>(),
  bookingFindMany: vi.fn<(a: any) => Promise<any[]>>(),
  eventCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'e', ...a.data })),
  paymentFindUnique: vi.fn(),
  refundCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'rc1', ...a.data })),
  incidentCreate: vi.fn(async () => ({ id: 'inc1' })),
  incidentEventCreate: vi.fn(async (_a: any) => ({})),
  supportCaseCreate: vi.fn(async (_a: any) => ({})),
  partnerFindUnique: vi.fn(async () => ({ userId: 'partner-user' })),
  notifyStatus: vi.fn(async () => {}),
  createNotification: vi.fn(async (_a: any) => ({})),
  automations: vi.fn(async () => {}),
  promptContext: vi.fn(async () => {}),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: m.bookingFindUnique, update: m.bookingUpdate, findMany: m.bookingFindMany },
    bookingEvent: { create: m.eventCreate },
    payment: { findUnique: m.paymentFindUnique },
    refundCase: { create: m.refundCreate },
    paymentIncident: { create: m.incidentCreate },
    paymentIncidentEvent: { create: m.incidentEventCreate },
    adminSupportCase: { create: m.supportCaseCreate },
    partnerProfile: { findUnique: m.partnerFindUnique },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({ notifyBookingStatusChange: m.notifyStatus, createNotification: m.createNotification }))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: m.automations }))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: m.promptContext }))

import {
  BOOKING_STATUS_LABEL, bookingSummaryForChat, bookingWhen, bookingsFor, canTransition, rescheduleBooking, systemTransition, transitionBooking,
} from '@/lib/bookings/ops'
import { APP_ORIGIN, ADMIN_ORIGIN, chatOrigin, type Actor } from '@/lib/ops/origin'
import type { BookingStatus } from '@prisma/client'

const client: Actor = { userId: 'u1', role: 'CLIENT', email: 'c@x.co' }
const otherClient: Actor = { userId: 'u9', role: 'CLIENT', email: 'o@x.co' }
const partner: Actor = { userId: 'pu1', role: 'PARTNER', partnerId: 'p1', email: 'p@x.co' }
const admin: Actor = { userId: 'a1', role: 'ADMIN', email: 'a@x.co' }
const chat = chatOrigin({ channel: 'WHATSAPP', conversationId: 'conv1', agentId: 'ag1', agentName: 'Sofía' })

const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
const baseBooking = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'bk-abc123', userId: 'u1', partnerId: 'p1', status: 'PENDING' as BookingStatus, totalPrice: 130000, address: 'Calle 10 #5-20',
  scheduledDate: new Date(`${future.toISOString().slice(0, 10)}T00:00:00.000Z`), scheduledTime: '10:00', ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.bookingUpdate.mockImplementation(async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
    ...baseBooking(), ...a.data, service: { name: 'Plomería' }, user: { name: 'Ana', email: 'c@x.co', phone: null }, partner: { user: { id: 'partner-user', name: 'Darwin', phone: null } },
  }))
  m.paymentFindUnique.mockResolvedValue(null)
})

describe('canTransition: la máquina de estados por rol', () => {
  const ok: Array<[BookingStatus, BookingStatus, 'client' | 'partner' | 'admin']> = [
    ['PENDING', 'CONFIRMED', 'partner'], ['PENDING', 'CONFIRMED', 'admin'],
    ['PENDING', 'CANCELLED', 'client'], ['PENDING', 'CANCELLED', 'partner'], ['PENDING', 'CANCELLED', 'admin'],
    ['CONFIRMED', 'IN_PROGRESS', 'partner'], ['CONFIRMED', 'IN_PROGRESS', 'admin'], ['CONFIRMED', 'CANCELLED', 'client'],
    ['IN_PROGRESS', 'COMPLETED', 'partner'], ['IN_PROGRESS', 'COMPLETED', 'admin'], ['IN_PROGRESS', 'CANCELLED', 'admin'],
  ]
  it.each(ok)('%s → %s lo puede hacer %s', (from, to, role) => {
    expect(canTransition(from, to, role)).toEqual({ ok: true })
  })

  const bad: Array<[BookingStatus, BookingStatus, 'client' | 'partner' | 'admin', RegExp]> = [
    ['PENDING', 'CONFIRMED', 'client', /Solo el socio o un administrador/],
    ['IN_PROGRESS', 'COMPLETED', 'client', /Solo el socio o un administrador/],
    ['IN_PROGRESS', 'CANCELLED', 'client', /Solo un administrador/],
    ['IN_PROGRESS', 'CANCELLED', 'partner', /Solo un administrador/],
    ['PENDING', 'IN_PROGRESS', 'partner', /no puede pasar a en curso/],
    ['PENDING', 'COMPLETED', 'admin', /no puede pasar a completada/],
    ['COMPLETED', 'CANCELLED', 'admin', /ya no cambia de estado/],
    ['CANCELLED', 'PENDING', 'admin', /ya no cambia de estado/],
    ['CONFIRMED', 'CONFIRMED', 'partner', /ya está confirmada/],
  ]
  it.each(bad)('%s → %s NO lo puede hacer %s', (from, to, role, reason) => {
    const r = canTransition(from, to, role)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(reason)
  })

  it('las etiquetas están en español', () => {
    expect(BOOKING_STATUS_LABEL).toEqual({ PENDING: 'Pendiente de confirmación', CONFIRMED: 'Confirmada', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada' })
  })
})

describe('transitionBooking', () => {
  it('una reserva ajena da 403 y no escribe nada', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await expect(transitionBooking(otherClient, 'bk-abc123', 'CANCELLED', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    await expect(transitionBooking({ ...partner, partnerId: 'p-other' }, 'bk-abc123', 'CONFIRMED', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    expect(m.bookingUpdate).not.toHaveBeenCalled()
  })

  it('reserva inexistente da 404; transición inválida 400; el mismo estado 409', async () => {
    m.bookingFindUnique.mockResolvedValueOnce(null)
    await expect(transitionBooking(admin, 'nope', 'CONFIRMED', ADMIN_ORIGIN)).rejects.toMatchObject({ status: 404 })
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await expect(transitionBooking(client, 'bk-abc123', 'CONFIRMED', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'CONFIRMED' }))
    await expect(transitionBooking(partner, 'bk-abc123', 'CONFIRMED', APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
  })

  it('desde la app el socio confirma: evento con origen app, actorType partner y los efectos de siempre', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    const updated = await transitionBooking(partner, 'bk-abc123', 'CONFIRMED', APP_ORIGIN)
    expect(updated.status).toBe('CONFIRMED')
    expect(m.eventCreate).toHaveBeenCalledTimes(1)
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({
      bookingId: 'bk-abc123', type: 'status', fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'partner', actorId: 'pu1',
      origin: 'app', originChannel: null, originConversationId: null, originAgentId: null,
    })
    expect(m.notifyStatus).toHaveBeenCalledWith('bk-abc123', 'CONFIRMED')
    expect(m.promptContext).toHaveBeenCalledWith('pu1', 'PARTNER_BOOKING_STATUS_CHANGED', { bookingId: 'bk-abc123', status: 'CONFIRMED' })
    expect(m.automations).toHaveBeenCalledWith('u1', 'BOOKING_CONFIRMED', { targetRole: 'CLIENT', contextId: 'bk-abc123' })
    expect(m.automations).toHaveBeenCalledWith('partner-user', 'BOOKING_CONFIRMED', { targetRole: 'PARTNER', contextId: 'bk-abc123' })
  })

  it('desde el chat el evento lleva canal, conversación y agente, y actorType ai', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await transitionBooking(client, 'bk-abc123', 'CANCELLED', chat, { reason: 'Ya no lo necesito' })
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({
      type: 'status', fromStatus: 'PENDING', toStatus: 'CANCELLED', actorType: 'ai', actorId: 'u1',
      origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'conv1', originAgentId: 'ag1', detail: 'Ya no lo necesito',
    })
    expect(m.automations).toHaveBeenCalledWith('u1', 'BOOKING_CANCELLED', { targetRole: 'CLIENT', contextId: 'bk-abc123' })
  })

  it('cancelar sin pago aprobado no abre caso de reembolso', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    m.paymentFindUnique.mockResolvedValue({ id: 'pay1', status: 'PENDING', totalAmount: 130000 })
    await transitionBooking(client, 'bk-abc123', 'CANCELLED', APP_ORIGIN)
    expect(m.refundCreate).not.toHaveBeenCalled()
  })

  it('cancelar con pago aprobado abre refundCase, incidente, evento del incidente y caso de soporte', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'CONFIRMED' }))
    m.paymentFindUnique.mockResolvedValue({ id: 'pay1', status: 'APPROVED', totalAmount: 130000 })
    await transitionBooking(client, 'bk-abc123', 'CANCELLED', chat)
    expect(m.refundCreate).toHaveBeenCalledTimes(1)
    const refund = m.refundCreate.mock.calls[0][0].data
    // three days ahead: full refund, no manual review
    expect(refund).toMatchObject({ bookingId: 'bk-abc123', paymentId: 'pay1', policyCode: 'FLEX_24H', status: 'APPROVED', requestedAmount: 130000, approvedAmount: 130000, requestedBy: 'c@x.co' })
    expect(JSON.parse(refund.metadata as string)).toMatchObject({ source: 'booking-cancel', cancelledByRole: 'CLIENT', origin: 'chat' })
    expect(m.incidentCreate).toHaveBeenCalledTimes(1)
    expect(m.incidentEventCreate.mock.calls[0][0].data).toMatchObject({ incidentId: 'inc1', action: 'REFUND_CASE_CREATED' })
    expect(m.supportCaseCreate.mock.calls[0][0].data).toMatchObject({ queue: 'REFUNDS', bookingId: 'bk-abc123' })
    expect(m.notifyStatus).toHaveBeenCalledWith('bk-abc123', 'CANCELLED')
  })

  it('sin correo del actor (agente) requestedBy es «chat»', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    m.paymentFindUnique.mockResolvedValue({ id: 'pay1', status: 'APPROVED', totalAmount: 100 })
    await transitionBooking({ userId: 'u1', role: 'CLIENT' }, 'bk-abc123', 'CANCELLED', chat)
    expect(m.refundCreate.mock.calls[0][0].data.requestedBy).toBe('chat')
  })
})

describe('systemTransition', () => {
  it('no valida rol, escribe evento system con origen app y no repite si ya está', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await systemTransition('bk-abc123', 'CONFIRMED', 'Pago aprobado por MercadoPago')
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ type: 'status', fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'system', origin: 'app', detail: 'Pago aprobado por MercadoPago' })
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'CONFIRMED' }))
    expect(await systemTransition('bk-abc123', 'CONFIRMED')).toBeNull()
    expect(m.bookingUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('rescheduleBooking', () => {
  const nextDay = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  const when = { scheduledDate: new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00.000Z`), scheduledTime: '15:30' }

  it('el cliente sobre una CONFIRMED la devuelve a PENDING con dos eventos y avisa al socio', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'CONFIRMED' }))
    const { booking, previous } = await rescheduleBooking(client, 'bk-abc123', when, APP_ORIGIN)
    expect(previous.scheduledTime).toBe('10:00')
    expect(m.bookingUpdate.mock.calls[0][0].data).toMatchObject({ scheduledTime: '15:30', status: 'PENDING' })
    expect(booking.status).toBe('PENDING')
    expect(m.eventCreate).toHaveBeenCalledTimes(2)
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ type: 'reschedule', actorType: 'client' })
    expect(m.eventCreate.mock.calls[0][0].data.detail).toMatch(/^de .+ 10:00 a .+ 15:30$/)
    expect(m.eventCreate.mock.calls[1][0].data).toMatchObject({ type: 'status', fromStatus: 'CONFIRMED', toStatus: 'PENDING' })
    expect(m.createNotification).toHaveBeenCalledTimes(1)
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'partner-user', type: 'BOOKING_CONFIRMED', title: 'Reserva reprogramada' })
    expect(m.createNotification.mock.calls[0][0].message).toMatch(/Confírmala de nuevo/)
  })

  it('el socio conserva el estado y avisa al cliente; un solo evento', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'CONFIRMED' }))
    await rescheduleBooking(partner, 'bk-abc123', when, APP_ORIGIN)
    expect(m.bookingUpdate.mock.calls[0][0].data).not.toHaveProperty('status')
    expect(m.eventCreate).toHaveBeenCalledTimes(1)
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'u1' })
  })

  it('fecha pasada → 400; en curso → 400; ajena → 403', async () => {
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await expect(rescheduleBooking(client, 'bk-abc123', { scheduledDate: new Date('2020-01-01T00:00:00Z'), scheduledTime: '10:00' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.bookingFindUnique.mockResolvedValue(baseBooking({ status: 'IN_PROGRESS' }))
    await expect(rescheduleBooking(admin, 'bk-abc123', when, ADMIN_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.bookingFindUnique.mockResolvedValue(baseBooking())
    await expect(rescheduleBooking(otherClient, 'bk-abc123', when, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    expect(m.bookingUpdate).not.toHaveBeenCalled()
  })
})

describe('bookingWhen y resumen', () => {
  it('combina la fecha y la hora en Bogotá (UTC-5)', () => {
    expect(bookingWhen({ scheduledDate: new Date('2026-10-03T00:00:00.000Z'), scheduledTime: '10:00' }).toISOString()).toBe('2026-10-03T15:00:00.000Z')
    // the day stored at Bogotá midnight lands on the same UTC day
    expect(bookingWhen({ scheduledDate: new Date('2026-10-03T05:00:00.000Z'), scheduledTime: '08:30' }).toISOString()).toBe('2026-10-03T13:30:00.000Z')
    expect(bookingWhen({ scheduledDate: new Date('2026-10-03T00:00:00.000Z'), scheduledTime: '2:00 PM' }).toISOString()).toBe('2026-10-03T19:00:00.000Z')
  })

  it('resume la reserva en una línea', () => {
    const line = bookingSummaryForChat({
      id: 'clx0abc123', status: 'CONFIRMED', totalPrice: 130000, address: 'Calle 10 #5-20',
      scheduledDate: new Date('2026-10-02T00:00:00.000Z'), scheduledTime: '10:00', service: { name: 'Plomería' }, partner: { user: { name: 'Darwin' } },
    })
    expect(line).toBe('Reserva #abc123 · Plomería · vie 2 oct 10:00 · Calle 10 #5-20 · $130.000 · Confirmada · socio Darwin')
  })
})

describe('bookingsFor', () => {
  it('cliente filtra por userId, socio por partnerId, admin sin filtro; socio sin perfil → []', async () => {
    m.bookingFindMany.mockResolvedValue([])
    await bookingsFor(client)
    expect(m.bookingFindMany.mock.calls[0][0].where).toEqual({ userId: 'u1' })
    await bookingsFor(partner, { status: ['PENDING', 'CONFIRMED'] })
    expect(m.bookingFindMany.mock.calls[1][0].where).toEqual({ partnerId: 'p1', status: { in: ['PENDING', 'CONFIRMED'] } })
    await bookingsFor(admin, { upcomingOnly: true, take: 5 })
    expect(m.bookingFindMany.mock.calls[2][0]).toMatchObject({ take: 5, orderBy: { scheduledDate: 'asc' } })
    expect(m.bookingFindMany.mock.calls[2][0].where.scheduledDate.gte).toBeInstanceOf(Date)
    expect(await bookingsFor({ userId: 'x', role: 'PARTNER' })).toEqual([])
    expect(m.bookingFindMany).toHaveBeenCalledTimes(3)
  })
})
