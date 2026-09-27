import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  eventFindFirst: vi.fn(async () => null as null | { createdAt: Date }),
  claimFindFirst: vi.fn(async () => null as null | { id: string }),
  claimFindUnique: vi.fn(),
  claimCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'gc_000001', ...a.data })),
  claimUpdate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'gc_000001', ...a.data })),
  claimCount: vi.fn(async () => 1),
  caseCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'case1', ...a.data })),
  caseUpdate: vi.fn(async () => ({})),
  refundCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'rf_000009', ...a.data })),
  userFindMany: vi.fn(async () => [{ id: 'admin1' }]),
  createNotification: vi.fn(async (_a: unknown) => ({})),
  addBookingEvent: vi.fn(async (_a: unknown) => ({})),
  transitionBooking: vi.fn(async () => ({})),
  createServiceRequest: vi.fn(async () => ({ id: 'sr_00new1' })),
  setPartnerAvailability: vi.fn(async () => ({ previous: true })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: m.bookingFindUnique },
    bookingEvent: { findFirst: m.eventFindFirst },
    guaranteeClaim: { findFirst: m.claimFindFirst, findUnique: m.claimFindUnique, create: m.claimCreate, update: m.claimUpdate, count: m.claimCount },
    adminSupportCase: { create: m.caseCreate, update: m.caseUpdate },
    refundCase: { create: m.refundCreate },
    user: { findMany: m.userFindMany },
  },
}))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: m.createNotification }))
vi.mock('@/lib/bookings/ops', () => ({
  addBookingEvent: m.addBookingEvent,
  transitionBooking: m.transitionBooking,
  bookingWhen: (b: { scheduledDate: Date }) => new Date(b.scheduledDate),
}))
vi.mock('@/lib/service-requests/ops', () => ({ createServiceRequest: m.createServiceRequest }))
vi.mock('@/lib/ops/platform-ops', () => ({ setPartnerAvailability: m.setPartnerAvailability }))

import { openGuaranteeClaim, resolveGuaranteeClaim } from '@/lib/guarantee/ops'
import { ADMIN_ORIGIN, APP_ORIGIN, chatOrigin, type Actor } from '@/lib/ops/origin'

const H = 3600_000
const now = new Date('2026-09-27T20:00:00.000Z')
const client: Actor = { userId: 'u1', role: 'CLIENT', email: 'ana@x.co' }
const otherClient: Actor = { userId: 'u9', role: 'CLIENT' }
const partner: Actor = { userId: 'pu1', role: 'PARTNER', partnerId: 'p1' }
const admin: Actor = { userId: 'a1', role: 'ADMIN', email: 'ops@lohaggo.com' }
const chat = chatOrigin({ channel: 'WHATSAPP', conversationId: 'conv1', agentId: 'ag1', agentName: 'Sofía' })

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'bk_abc123', userId: 'u1', partnerId: 'p1', serviceId: 's1', status: 'CONFIRMED', address: 'Calle 10 #5-20', city: 'MEDELLIN', notes: 'Fuga en el baño',
  totalPrice: 130000, scheduledDate: new Date(now.getTime() - 2 * H), scheduledTime: '13:00', updatedAt: new Date(now.getTime() - H),
  service: { id: 's1', name: 'Plomería' }, user: { id: 'u1', name: 'Ana', email: 'ana@x.co' }, partner: { id: 'p1', userId: 'pu1', user: { name: 'Darwin' } },
  payment: null as null | Record<string, unknown>,
  ...over,
})
const claimRow = (over: Record<string, unknown> = {}) => ({
  id: 'gc_000001', bookingId: 'bk_abc123', clientId: 'u1', partnerId: 'p1', type: 'NO_SHOW', status: 'OPEN', remedy: null, partnerStrike: false,
  supportCaseId: 'case1', slaDueAt: new Date(now.getTime() + 70 * H), booking: booking(), ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.claimFindFirst.mockResolvedValue(null)
  m.eventFindFirst.mockResolvedValue(null)
  m.claimCount.mockResolvedValue(1)
})

describe('openGuaranteeClaim', () => {
  it('el cliente reclama por chat: reclamo, caso GUARANTEE con SLA de 72 h, evento y avisos', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    const claim = await openGuaranteeClaim(client, { bookingId: 'bk_abc123', type: 'NO_SHOW', description: 'El socio no llegó a las 13:00 y no avisó', photoUrls: ['https://x.co/a.jpg', 'no-url'] }, chat, now)
    expect(claim).toMatchObject({ type: 'NO_SHOW', status: 'OPEN', clientId: 'u1', partnerId: 'p1', supportCaseId: 'case1', photoUrls: ['https://x.co/a.jpg'], origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'conv1', originAgentId: 'ag1' })
    expect((claim.slaDueAt as Date).getTime()).toBe(now.getTime() + 72 * H)
    expect(m.caseCreate.mock.calls[0][0].data).toMatchObject({ queue: 'GUARANTEE', priority: 'HIGH', bookingId: 'bk_abc123', status: 'OPEN' })
    expect(m.addBookingEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'guarantee', bookingId: 'bk_abc123' }))
    const notified = m.createNotification.mock.calls.map((c) => (c[0] as { userId: string }).userId)
    expect(notified).toEqual(expect.arrayContaining(['pu1', 'admin1']))
  })

  it('trabajo mal hecho va con prioridad media', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'COMPLETED' }))
    m.eventFindFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 5 * H) })
    await openGuaranteeClaim(client, { bookingId: 'bk_abc123', type: 'BAD_WORK', description: 'Quedó goteando igual que antes' }, APP_ORIGIN, now)
    expect(m.caseCreate.mock.calls[0][0].data).toMatchObject({ priority: 'MEDIUM' })
  })

  it('fuera de plazo no se abre (trabajo completado hace más de 72 h)', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'COMPLETED' }))
    m.eventFindFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 80 * H) })
    await expect(openGuaranteeClaim(client, { bookingId: 'bk_abc123', type: 'BAD_WORK', description: 'Quedó goteando igual que antes' }, APP_ORIGIN, now)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/plazo/) })
    expect(m.claimCreate).not.toHaveBeenCalled()
  })

  it('un solo reclamo abierto por reserva (409)', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    m.claimFindFirst.mockResolvedValue({ id: 'gc_prev01' })
    await expect(openGuaranteeClaim(client, { bookingId: 'bk_abc123', type: 'NO_SHOW', description: 'El socio no llegó a las 13:00' }, APP_ORIGIN, now)).rejects.toMatchObject({ status: 409 })
    expect(m.caseCreate).not.toHaveBeenCalled()
  })

  it('solo el cliente dueño o un admin; ni otro cliente ni el socio', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    const input = { bookingId: 'bk_abc123', type: 'NO_SHOW' as const, description: 'El socio no llegó a las 13:00' }
    await expect(openGuaranteeClaim(otherClient, input, APP_ORIGIN, now)).rejects.toMatchObject({ status: 403 })
    await expect(openGuaranteeClaim(partner, input, APP_ORIGIN, now)).rejects.toMatchObject({ status: 403 })
    await expect(openGuaranteeClaim(admin, input, ADMIN_ORIGIN, now)).resolves.toBeTruthy()
  })

  it('pide una descripción concreta', async () => {
    await expect(openGuaranteeClaim(client, { bookingId: 'bk_abc123', type: 'NO_SHOW', description: 'mal' }, APP_ORIGIN, now)).rejects.toMatchObject({ status: 400 })
  })
})

describe('resolveGuaranteeClaim', () => {
  it('solo un admin', async () => {
    await expect(resolveGuaranteeClaim(client, 'gc_000001', { remedy: 'reassign', note: 'Otro socio', partnerStrike: true }, now)).rejects.toMatchObject({ status: 403 })
  })

  it('otro socio: solicitud nueva urgente a nombre del cliente con origen admin y notas de garantía; la reserva original se cancela', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow())
    const r = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'reassign', note: 'Se le busca otro socio', partnerStrike: true }, now)
    const [actor, input, origin] = m.createServiceRequest.mock.calls[0] as unknown as [Actor, Record<string, unknown>, { via: string }]
    expect(actor).toMatchObject({ userId: 'u1', role: 'CLIENT' })
    expect(input).toMatchObject({ serviceId: 's1', address: 'Calle 10 #5-20', city: 'MEDELLIN', isUrgent: true })
    expect(String(input.notes)).toMatch(/^Garantía de la reserva #abc123/)
    expect(origin.via).toBe('admin')
    expect(m.transitionBooking).toHaveBeenCalledWith(admin, 'bk_abc123', 'CANCELLED', ADMIN_ORIGIN, expect.anything())
    expect(r.claim).toMatchObject({ status: 'REASSIGNED', remedy: 'reassign', partnerStrike: true })
    expect(r.previous).toMatchObject({ status: 'OPEN' })
    expect(m.caseUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'case1' }, data: expect.objectContaining({ status: 'RESOLVED' }) }))
    expect(m.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Tu reclamo de garantía' }))
  })

  it('reembolso solo con pago en línea aprobado', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ booking: booking({ payment: { id: 'pay1', status: 'APPROVED', totalAmount: 130000, mercadopagoId: null, partnerConfirmedMethod: 'CASH' } }) }))
    await expect(resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'refund', note: 'Reembolso', partnerStrike: false }, now)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/en línea/) })
    expect(m.refundCreate).not.toHaveBeenCalled()
  })

  it('no llegó con pago en línea: RefundCase aprobado por el total', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ booking: booking({ payment: { id: 'pay1', status: 'APPROVED', totalAmount: 130000, mercadopagoId: 'mp1', partnerConfirmedMethod: null } }) }))
    const r = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'refund', note: 'Reembolso total', partnerStrike: true }, now)
    expect(m.refundCreate.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED', requestedAmount: 130000, approvedAmount: 130000, paymentId: 'pay1', policyCode: 'GUARANTEE_NO_SHOW' })
    expect(r.claim.status).toBe('RESOLVED')
  })

  it('trabajo mal hecho con pago en línea: RefundCase en revisión y el reclamo sigue activo', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ type: 'BAD_WORK', booking: booking({ status: 'COMPLETED', payment: { id: 'pay1', status: 'APPROVED', totalAmount: 130000, mercadopagoId: 'mp1' } }) }))
    const r = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'refund', note: 'Revisar parcial', partnerStrike: false }, now)
    expect(m.refundCreate.mock.calls[0][0].data).toMatchObject({ status: 'UNDER_REVIEW', approvedAmount: null })
    expect(r.claim).toMatchObject({ status: 'REFUND_REVIEW', resolvedAt: null })
    expect(m.caseUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }))
  })

  it('corregir: avisa al socio y queda en corrección acordada', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ type: 'BAD_WORK', booking: booking({ status: 'COMPLETED' }) }))
    const r = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'redo', note: 'El cliente acepta que corrija', partnerStrike: false }, now)
    expect(r.claim.status).toBe('REDO_SCHEDULED')
    expect(m.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'pu1', title: 'Corrección por garantía' }))
  })

  it('un remedio que no aplica al tipo se rechaza (daño no tiene reasignación)', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ type: 'DAMAGE', booking: booking({ status: 'COMPLETED' }) }))
    await expect(resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'reassign', note: 'x x x x x', partnerStrike: false }, now)).rejects.toMatchObject({ status: 400 })
  })

  it('un reclamo cerrado no se vuelve a resolver', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow({ status: 'RESOLVED' }))
    await expect(resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'reassign', note: 'otra vez', partnerStrike: false }, now)).rejects.toMatchObject({ status: 409 })
  })

  it('la primera falta no pausa; la segunda en 90 días pausa al socio y abre revisión', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow())
    m.claimCount.mockResolvedValue(1)
    const first = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'cancel_free', note: 'Cancelada sin costo', partnerStrike: true }, now)
    expect(first.consequence).toBe('none')
    expect(m.setPartnerAvailability).not.toHaveBeenCalled()

    vi.clearAllMocks()
    m.claimFindUnique.mockResolvedValue(claimRow())
    m.claimCount.mockResolvedValue(2)
    const second = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'cancel_free', note: 'Cancelada sin costo', partnerStrike: true }, now)
    expect(second.consequence).toBe('pause')
    expect(m.setPartnerAvailability).toHaveBeenCalledWith('p1', false)
    expect(m.caseCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ queue: 'GUARANTEE', role: 'PARTNER', priority: 'HIGH' }) }))
  })

  it('rechazar nunca marca falta', async () => {
    m.claimFindUnique.mockResolvedValue(claimRow())
    const r = await resolveGuaranteeClaim(admin, 'gc_000001', { remedy: 'reject', note: 'El cliente canceló por fuera', partnerStrike: true }, now)
    expect(r.claim).toMatchObject({ status: 'REJECTED', partnerStrike: false })
    expect(m.claimCount).not.toHaveBeenCalled()
  })
})
