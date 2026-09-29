import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  partnerFindUnique: vi.fn(),
  srFindUnique: vi.fn(),
  srUpdate: vi.fn(),
  srUpdateMany: vi.fn(),
  psFindFirst: vi.fn(),
  configFindFirst: vi.fn(),
  proposalFindUnique: vi.fn(),
  proposalFindMany: vi.fn(),
  proposalCreate: vi.fn(),
  proposalUpdate: vi.fn(),
  proposalUpdateMany: vi.fn(),
  bookingCreate: vi.fn(),
  eventCreate: vi.fn(),
  notifyNewProposal: vi.fn(async () => {}),
  notifyProposalAccepted: vi.fn(async () => {}),
  notifyProposalRejected: vi.fn(async () => {}),
  scheduleAutomationsForUser: vi.fn(async () => {}),
  recordPromptContext: vi.fn(async () => {}),
}))

vi.mock('@/lib/prisma', () => {
  const prisma: Record<string, unknown> = {
    partnerProfile: { findUnique: m.partnerFindUnique },
    serviceRequest: { findUnique: m.srFindUnique, update: m.srUpdate, updateMany: m.srUpdateMany },
    partnerService: { findFirst: m.psFindFirst },
    platformConfig: { findFirst: m.configFindFirst },
    proposal: { findUnique: m.proposalFindUnique, findMany: m.proposalFindMany, create: m.proposalCreate, update: m.proposalUpdate, updateMany: m.proposalUpdateMany },
    booking: { create: m.bookingCreate },
    bookingEvent: { create: m.eventCreate },
  }
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
  return { prisma }
})
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/messaging/wa-events', () => ({ waRequestCancelled: vi.fn(async () => null), waRequestNoProposals: vi.fn(async () => null), waRequestExpired: vi.fn(async () => null), waProposalAccepted: vi.fn(async () => null) }))
vi.mock('@/lib/notifications/notificationService', () => ({
  notifyNewProposal: m.notifyNewProposal,
  notifyProposalAccepted: m.notifyProposalAccepted,
  notifyProposalRejected: m.notifyProposalRejected,
}))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: m.scheduleAutomationsForUser }))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: m.recordPromptContext }))

import { APP_ORIGIN, chatOrigin } from '@/lib/ops/origin'
import { acceptProposal, createProposal, proposalSummaryForChat, rejectProposal, resolveSchedule } from '@/lib/proposals/ops'
import { bookingWhen } from '@/lib/bookings/when'

const client = { userId: 'u1', role: 'CLIENT' as const }
const partnerActor = { userId: 'pu1', role: 'PARTNER' as const, partnerId: 'p1' }
const future = new Date(Date.now() + 3600_000)

function pendingProposal(over: Record<string, unknown> = {}) {
  return {
    id: 'pr1', partnerId: 'p1', price: 130000, status: 'PENDING', serviceRequestId: 'r1',
    serviceRequest: { id: 'r1', userId: 'u1', serviceId: 's1', address: 'Calle 1', notes: null, city: 'MEDELLIN', status: 'ACTIVE', preferredDate: new Date('2026-10-02T15:00:00.000Z'), preferredTime: '10:00', isUrgent: false, user: { id: 'u1' }, service: { id: 's1' } },
    partner: { id: 'p1', user: { id: 'pu1' } },
    ...over,
  }
}

describe('crear propuesta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.partnerFindUnique.mockResolvedValue({ id: 'p1', isActive: true, verified: true })
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', serviceId: 's1', city: 'MEDELLIN', status: 'ACTIVE', expiresAt: future, partnerId: null, service: { basePrice: 50000 } })
    m.psFindFirst.mockResolvedValue({ id: 'ps1' })
    m.configFindFirst.mockResolvedValue({ minServicePrice: 10000, maxServicePrice: 10000000 })
    m.proposalFindUnique.mockResolvedValue(null)
    m.proposalCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'pr1', ...a.data }))
  })

  it('socio no verificado → 403', async () => {
    m.partnerFindUnique.mockResolvedValue({ id: 'p1', isActive: true, verified: false })
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000 }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
  })

  it('precio menor al precio base → 400', async () => {
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 40000 }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('precio base') })
  })

  it('sin PartnerService activo en la ciudad → 400', async () => {
    m.psFindFirst.mockResolvedValue(null)
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000 }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'No ofreces este servicio en la ciudad solicitada' })
  })

  it('solicitud vencida → 400', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', serviceId: 's1', city: 'MEDELLIN', status: 'ACTIVE', expiresAt: new Date(Date.now() - 1000), partnerId: null, service: { basePrice: 50000 } })
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000 }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'Esta solicitud ha expirado' })
  })

  it('crea con la marca de origen del chat, avisa y registra el contexto del cliente', async () => {
    const p = await createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000, notes: 'Voy hoy' }, chatOrigin({ channel: 'WHATSAPP', conversationId: 'c1', agentId: 'a1' }))
    expect(p.id).toBe('pr1')
    expect(m.proposalCreate.mock.calls[0][0].data).toMatchObject({ partnerId: 'p1', price: 60000, notes: 'Voy hoy', origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1' })
    expect(m.notifyNewProposal).toHaveBeenCalledWith('pr1')
    expect(m.recordPromptContext).toHaveBeenCalledWith('u1', 'CLIENT_PROPOSAL_RECEIVED', { proposalId: 'pr1', serviceRequestId: 'r1' })
  })

  it('la fecha propuesta se guarda como día solo (00:00 UTC) y la hora aparte; las reglas usan la hora real', async () => {
    const day = new Date(Date.now() + 3 * 24 * 3600_000).toISOString().slice(0, 10)
    await createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000, proposedDate: day, proposedTime: '08:30' }, APP_ORIGIN)
    expect(m.proposalCreate.mock.calls[0][0].data).toMatchObject({ proposedDate: new Date(`${day}T00:00:00.000Z`), proposedTime: '08:30' })
    const past = new Date(Date.now() - 3 * 24 * 3600_000).toISOString().slice(0, 10)
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000, proposedDate: past }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'La fecha propuesta ya pasó' })
    const far = new Date(Date.now() + 90 * 24 * 3600_000).toISOString().slice(0, 10)
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000, proposedDate: far }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'Propón una fecha dentro de los próximos 60 días' })
  })

  it('solicitud directa al socio no exige PartnerService en la ciudad', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', serviceId: 's1', city: 'BOGOTA', status: 'ACTIVE', expiresAt: future, partnerId: 'p1', service: { basePrice: 50000 } })
    m.psFindFirst.mockResolvedValue(null)
    await expect(createProposal(partnerActor, { serviceRequestId: 'r1', price: 60000 }, APP_ORIGIN)).resolves.toMatchObject({ id: 'pr1' })
  })
})

describe('aceptar propuesta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.proposalFindUnique.mockResolvedValue(pendingProposal())
    m.configFindFirst.mockResolvedValue({ commissionEnabled: true, clientCommissionRate: 5, partnerCommissionRate: 10 })
    m.proposalFindMany.mockResolvedValue([{ id: 'pr2' }])
    m.bookingCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'b1', ...a.data, partner: { user: { id: 'pu1' } } }))
    m.proposalUpdateMany.mockResolvedValue({ count: 1 })
    m.srUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('usa la fecha y hora preferidas de la solicitud (el día solo, a las 00:00 UTC; la hora aparte)', async () => {
    const b = await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(b.id).toBe('b1')
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(new Date('2026-10-02T00:00:00.000Z'))
    expect(data.scheduledTime).toBe('10:00')
    expect(data).toMatchObject({ origin: 'app', originChannel: null, totalPrice: 130000, clientCommissionRate: 5, partnerCommissionRate: 10 })
  })

  it('con opts usa la fecha y hora indicadas', async () => {
    const day = new Date(Date.now() + 5 * 24 * 3600_000).toISOString().slice(0, 10)
    await acceptProposal(client, 'pr1', APP_ORIGIN, { scheduledDate: new Date(`${day}T19:00:00.000Z`), scheduledTime: '14:30' })
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(new Date(`${day}T00:00:00.000Z`))
    expect(data.scheduledTime).toBe('14:30')
  })

  it('un instante sin hora (chat) guarda su día en Bogotá y su hora', async () => {
    const day = new Date(Date.now() + 5 * 24 * 3600_000).toISOString().slice(0, 10)
    await acceptProposal(client, 'pr1', APP_ORIGIN, { scheduledDate: new Date(`${day}T19:30:00-05:00`) })
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(new Date(`${day}T00:00:00.000Z`))
    expect(data.scheduledTime).toBe('19:30')
  })

  it('la fecha que propuso el socio se usa; sin hora queda a las 09:00, nunca a medianoche', async () => {
    const day = new Date(Date.now() + 3 * 24 * 3600_000).toISOString().slice(0, 10)
    const sr = { ...pendingProposal().serviceRequest, preferredTime: null }
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ proposedDate: new Date(`${day}T00:00:00.000Z`), proposedTime: null, serviceRequest: sr }))
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(new Date(`${day}T00:00:00.000Z`))
    expect(data.scheduledTime).toBe('09:00')
  })

  it('una fecha elegida a menos de una hora (o pasada) se rechaza sin crear la reserva', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10)
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN, { scheduledDate: new Date(`${yesterday}T00:00:00.000Z`), scheduledTime: '10:00' }))
      .rejects.toMatchObject({ status: 400, message: 'Elige una fecha y hora futura (al menos en una hora)' })
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ proposedDate: new Date(`${yesterday}T00:00:00.000Z`), proposedTime: '10:00' }))
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    expect(m.bookingCreate).not.toHaveBeenCalled()
  })

  it('dos aceptaciones a la vez: la segunda no crea otra reserva (409)', async () => {
    m.proposalUpdateMany.mockResolvedValueOnce({ count: 0 })
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 409, message: 'Esta solicitud ya tiene una reserva' })
    m.srUpdateMany.mockResolvedValueOnce({ count: 0 })
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
    expect(m.bookingCreate).not.toHaveBeenCalled()
  })

  it('urgente sin fecha → la próxima hora en punto (hora de Bogotá)', async () => {
    const now = new Date('2026-10-01T14:20:00.000Z') // 09:20 en Bogotá
    const s = resolveSchedule({ preferredDate: null, preferredTime: null, isUrgent: true }, undefined, now)
    expect(s.scheduledDate).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(s.scheduledTime).toBe('10:00')
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ serviceRequest: { ...pendingProposal().serviceRequest, preferredDate: null, preferredTime: null, isUrgent: true } }))
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate.toISOString()).toMatch(/T00:00:00\.000Z$/)
    expect(bookingWhen(data).getTime()).toBeGreaterThan(Date.now())
    expect(data.scheduledTime).toMatch(/^\d{2}:00$/)
  })

  it('crea el BookingEvent con la marca de origen y rechaza solo las pendientes, avisando después', async () => {
    await acceptProposal(client, 'pr1', chatOrigin({ channel: 'WHATSAPP', conversationId: 'c1', agentId: 'a1' }))
    expect(m.bookingCreate.mock.calls[0][0].data).toMatchObject({ origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1' })
    expect(m.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: 'b1', type: 'status', fromStatus: null, toStatus: 'PENDING', actorType: 'ai', actorId: 'u1', origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1' }),
    })
    expect(m.proposalFindMany.mock.calls[0][0].where).toMatchObject({ serviceRequestId: 'r1', id: { not: 'pr1' }, status: 'PENDING' })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: 'pr1', status: 'PENDING' }, data: { status: 'ACCEPTED' } })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['pr2'] } }, data: { status: 'REJECTED' } })
    expect(m.srUpdateMany).toHaveBeenCalledWith({ where: { id: 'r1', status: 'ACTIVE' }, data: { status: 'ACCEPTED' } })
    expect(m.notifyProposalRejected).toHaveBeenCalledWith('pr2', { notChosen: true })
    expect(m.notifyProposalAccepted).toHaveBeenCalledWith('pr1')
    expect(m.scheduleAutomationsForUser).toHaveBeenCalledWith('u1', 'BOOKING_CREATED', { targetRole: 'CLIENT', contextId: 'b1' })
    expect(m.scheduleAutomationsForUser).toHaveBeenCalledWith('pu1', 'BOOKING_CREATED', { targetRole: 'PARTNER', contextId: 'b1' })
  })

  it('desde la app el evento lo firma el cliente', async () => {
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ actorType: 'client', origin: 'app' })
  })

  it('sin PlatformConfig la reserva queda sin comisión (0/0) sin fallar', async () => {
    m.configFindFirst.mockResolvedValue(null)
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(m.bookingCreate.mock.calls[0][0].data).toMatchObject({ clientCommissionRate: 0, partnerCommissionRate: 0 })
  })

  it('con la comisión apagada la reserva guarda 0/0 aunque haya tasas guardadas', async () => {
    m.configFindFirst.mockResolvedValue({ commissionEnabled: false, clientCommissionRate: 5, partnerCommissionRate: 10 })
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(m.bookingCreate.mock.calls[0][0].data).toMatchObject({ clientCommissionRate: 0, partnerCommissionRate: 0 })
  })

  it('solicitud ajena → 403; propuesta no PENDING → 400; inexistente → 404', async () => {
    await expect(acceptProposal({ userId: 'otro', role: 'CLIENT' }, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ status: 'REJECTED' }))
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.proposalFindUnique.mockResolvedValue(null)
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
    expect(m.bookingCreate).not.toHaveBeenCalled()
  })

  it('solicitud vencida → 400 pidiendo reactivarla', async () => {
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ serviceRequest: { ...pendingProposal().serviceRequest, expiresAt: new Date(Date.now() - 60_000) } }))
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'Esta solicitud venció: reactívala para aceptar propuestas' })
    expect(m.bookingCreate).not.toHaveBeenCalled()
  })
})

describe('rechazar propuesta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.proposalUpdate.mockResolvedValue({ id: 'pr1', status: 'REJECTED' })
  })

  it('dueño y pendiente → REJECTED y aviso', async () => {
    m.proposalFindUnique.mockResolvedValue({ id: 'pr1', status: 'PENDING', serviceRequest: { userId: 'u1' } })
    await rejectProposal(client, 'pr1', APP_ORIGIN)
    expect(m.proposalUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'pr1' }, data: { status: 'REJECTED' } })
    expect(m.notifyProposalRejected).toHaveBeenCalledWith('pr1')
  })

  it('ajena → 403; ya resuelta → 400', async () => {
    m.proposalFindUnique.mockResolvedValue({ id: 'pr1', status: 'PENDING', serviceRequest: { userId: 'otro' } })
    await expect(rejectProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.proposalFindUnique.mockResolvedValue({ id: 'pr1', status: 'ACCEPTED', serviceRequest: { userId: 'u1' } })
    await expect(rejectProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
  })
})

describe('resumen para el chat', () => {
  it('arma la línea con nombre, reputación, precio y nota', () => {
    expect(proposalSummaryForChat({ id: 'ckxabc123', price: 130000, notes: 'Llevo repuestos', partner: { rating: 4.8, totalReviews: 12, user: { name: 'Darwin' } } }))
      .toBe('Propuesta #abc123 de Darwin (4.8★, 12 reseñas): $130.000 · "Llevo repuestos"')
    expect(proposalSummaryForChat({ id: 'ckxabc123', price: 90000, partner: { rating: 0, totalReviews: 0, user: { name: null } } }))
      .toBe('Propuesta #abc123 de un socio (sin reseñas aún): $90.000')
  })
})
