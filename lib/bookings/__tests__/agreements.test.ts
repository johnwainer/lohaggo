import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  eventFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  eventFindFirst: vi.fn(async (_a: any): Promise<any> => null),
  addEvent: vi.fn(async (_a: any) => ({})),
  reschedule: vi.fn(async (..._a: any[]) => ({ booking: {}, previous: {} })),
  sendWa: vi.fn(async (..._a: any[]) => null),
  notify: vi.fn(async (_a: any) => ({})),
  tx: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: m.bookingFindUnique },
    bookingEvent: { findMany: m.eventFindMany, findFirst: m.eventFindFirst },
    $transaction: (fn: (tx: unknown) => unknown) => m.tx(fn),
  },
}))
vi.mock('@/lib/messaging/wa-send', () => ({ sendWaToUser: m.sendWa }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: m.notify }))
vi.mock('@/lib/bookings/ops', async () => {
  const { OpsError } = await import('@/lib/ops/origin')
  return {
    addBookingEvent: m.addEvent,
    rescheduleBooking: m.reschedule,
    formatCOP: (n: number) => `$${n}`,
    assertBookingAccess: (actor: { role: string; userId: string; partnerId?: string }, b: { userId: string; partnerId: string | null }) => {
      if (actor.role === 'CLIENT' && b.userId === actor.userId) return
      if (actor.role === 'PARTNER' && b.partnerId === actor.partnerId) return
      throw new OpsError('No autorizado', 403)
    },
  }
})

import { answerPrice, answerReschedule, openAgreements, proposePrice, rescheduleOrPropose } from '@/lib/bookings/agreements'
import { APP_ORIGIN, type Actor } from '@/lib/ops/origin'

const client: Actor = { userId: 'u1', role: 'CLIENT' }
const otherClient: Actor = { userId: 'u9', role: 'CLIENT' }
const partner: Actor = { userId: 'pu1', role: 'PARTNER', partnerId: 'p1' }
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'bk-abc123', userId: 'u1', partnerId: 'p1', status: 'COMPLETED', scheduledDate: new Date('2026-10-25T00:00:00Z'), scheduledTime: '10:00', totalPrice: 100000,
  service: { name: 'Plomería' }, user: { name: 'Ana' }, partner: { userId: 'pu1', user: { name: 'Carlos' } }, payment: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.eventFindMany.mockResolvedValue([])
  m.eventFindFirst.mockResolvedValue(null)
})

describe('Acuerdos de la reserva', () => {
  it('la propuesta abierta es la última sin respuesta', async () => {
    m.eventFindMany.mockResolvedValueOnce([
      { bookingId: 'b', type: 'price_request', detail: JSON.stringify({ amount: 1, previous: 2, note: 'x', at: 'a' }) },
      { bookingId: 'b', type: 'price_answer', detail: 'no' },
      { bookingId: 'b', type: 'reschedule_request', detail: JSON.stringify({ date: '2026-10-26', time: '09:00', at: 'b', by: 'PARTNER' }) },
    ])
    const open = (await openAgreements(['b'])).get('b')
    expect(open?.price).toBeUndefined()
    expect(open?.reschedule?.date).toBe('2026-10-26')
  })

  it('solo el socio propone precio y con límites; el cliente responde', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    await expect(proposePrice(client, 'bk-abc123', { amount: 150000, note: 'más trabajo' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    await expect(proposePrice(partner, 'bk-abc123', { amount: 400000, note: 'más trabajo' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    await expect(proposePrice(partner, 'bk-abc123', { amount: 150000, note: 'x' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    await proposePrice(partner, 'bk-abc123', { amount: 150000, note: 'cambié el sifón' }, APP_ORIGIN)
    expect(m.addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'price_request' }))
    await expect(answerPrice(partner, 'bk-abc123', true, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    await expect(answerPrice(otherClient, 'bk-abc123', true, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
  })

  it('no cambia el precio con el pago en línea iniciado ni dos veces', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ payment: { id: 'pay', status: 'PENDING', confirmationStatus: 'NONE', clientCommission: 0, preferenceId: 'pref', mercadopagoId: null } }))
    await expect(proposePrice(partner, 'bk-abc123', { amount: 150000, note: 'cambié el sifón' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.bookingFindUnique.mockResolvedValue(booking())
    m.eventFindFirst.mockResolvedValueOnce({ id: 'ya' })
    await expect(proposePrice(partner, 'bk-abc123', { amount: 150000, note: 'cambié el sifón' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
  })

  it('aceptar el precio cambia la reserva solo si nadie pagó entretanto', async () => {
    m.bookingFindUnique.mockResolvedValue(booking())
    m.eventFindMany.mockResolvedValue([{ bookingId: 'bk-abc123', type: 'price_request', detail: JSON.stringify({ amount: 150000, previous: 100000, note: 'x', at: '2026-10-22T10:00:00Z' }) }])
    const tx = { payment: { findUnique: vi.fn(async () => null), update: vi.fn() }, booking: { updateMany: vi.fn(async () => ({ count: 1 })) } }
    m.tx.mockImplementation((fn: (t: unknown) => unknown) => fn(tx))
    const r = await answerPrice(client, 'bk-abc123', true, APP_ORIGIN)
    expect(r.message).toContain('150000')
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ totalPrice: 100000 }) }))
    tx.payment.findUnique.mockResolvedValueOnce({ id: 'p', status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED', preferenceId: null, mercadopagoId: null } as never)
    await expect(answerPrice(client, 'bk-abc123', true, APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
  })

  it('un botón viejo no acepta una propuesta más nueva', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'CONFIRMED' }))
    m.eventFindMany.mockResolvedValue([{ bookingId: 'bk-abc123', type: 'reschedule_request', detail: JSON.stringify({ date: '2030-01-02', time: '09:00', at: '2026-10-22T12:00:00Z', by: 'PARTNER' }) }])
    const r = await answerReschedule(client, 'bk-abc123', true, APP_ORIGIN, new Date('2026-10-22T10:00:00Z'))
    expect(r.message).toContain('después')
    expect(m.reschedule).not.toHaveBeenCalled()
    await answerReschedule(client, 'bk-abc123', true, APP_ORIGIN)
    expect(m.reschedule).toHaveBeenCalledWith(client, 'bk-abc123', expect.anything(), APP_ORIGIN, { agreed: true })
  })

  it('el socio propone fecha; el cliente la cambia directo', async () => {
    m.bookingFindUnique.mockResolvedValue(booking({ status: 'CONFIRMED' }))
    const when = { scheduledDate: new Date('2030-01-02T00:00:00Z'), scheduledTime: '09:00' }
    const p = await rescheduleOrPropose(partner, 'bk-abc123', when, APP_ORIGIN)
    expect(p.proposed).toBe(true)
    expect(m.reschedule).not.toHaveBeenCalled()
    const c = await rescheduleOrPropose(client, 'bk-abc123', when, APP_ORIGIN)
    expect(c.proposed).toBe(false)
    expect(m.reschedule).toHaveBeenCalledTimes(1)
  })
})
