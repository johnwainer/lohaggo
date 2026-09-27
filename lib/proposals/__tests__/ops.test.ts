import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  partnerFindUnique: vi.fn(),
  srFindUnique: vi.fn(),
  srUpdate: vi.fn(),
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
    serviceRequest: { findUnique: m.srFindUnique, update: m.srUpdate },
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
vi.mock('@/lib/notifications/notificationService', () => ({
  notifyNewProposal: m.notifyNewProposal,
  notifyProposalAccepted: m.notifyProposalAccepted,
  notifyProposalRejected: m.notifyProposalRejected,
}))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: m.scheduleAutomationsForUser }))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: m.recordPromptContext }))

import { APP_ORIGIN, chatOrigin } from '@/lib/ops/origin'
import { acceptProposal, createProposal, proposalSummaryForChat, rejectProposal, resolveSchedule } from '@/lib/proposals/ops'

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
    m.configFindFirst.mockResolvedValue({ clientCommissionRate: 5, partnerCommissionRate: 10 })
    m.proposalFindMany.mockResolvedValue([{ id: 'pr2' }])
    m.bookingCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'b1', ...a.data, partner: { user: { id: 'pu1' } } }))
  })

  it('usa la fecha y hora preferidas de la solicitud', async () => {
    const b = await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(b.id).toBe('b1')
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(new Date('2026-10-02T15:00:00.000Z'))
    expect(data.scheduledTime).toBe('10:00')
    expect(data).toMatchObject({ origin: 'app', originChannel: null, totalPrice: 130000, clientCommissionRate: 5, partnerCommissionRate: 10 })
  })

  it('con opts usa la fecha y hora indicadas', async () => {
    const d = new Date('2026-10-05T19:00:00.000Z')
    await acceptProposal(client, 'pr1', APP_ORIGIN, { scheduledDate: d, scheduledTime: '14:30' })
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate).toEqual(d)
    expect(data.scheduledTime).toBe('14:30')
  })

  it('urgente sin fecha → la próxima hora en punto (hora de Bogotá)', async () => {
    const now = new Date('2026-10-01T14:20:00.000Z') // 09:20 en Bogotá
    const s = resolveSchedule({ preferredDate: null, preferredTime: null, isUrgent: true }, undefined, now)
    expect(s.scheduledDate).toEqual(new Date('2026-10-01T15:00:00.000Z'))
    expect(s.scheduledTime).toBe('10:00')
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ serviceRequest: { ...pendingProposal().serviceRequest, preferredDate: null, preferredTime: null, isUrgent: true } }))
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    const data = m.bookingCreate.mock.calls[0][0].data
    expect(data.scheduledDate.getMinutes()).toBe(0)
    expect(data.scheduledDate.getTime()).toBeGreaterThan(Date.now())
    expect(data.scheduledTime).toMatch(/^\d{2}:00$/)
  })

  it('crea el BookingEvent con la marca de origen y rechaza solo las pendientes, avisando después', async () => {
    await acceptProposal(client, 'pr1', chatOrigin({ channel: 'WHATSAPP', conversationId: 'c1', agentId: 'a1' }))
    expect(m.bookingCreate.mock.calls[0][0].data).toMatchObject({ origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1' })
    expect(m.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: 'b1', type: 'status', fromStatus: null, toStatus: 'PENDING', actorType: 'ai', actorId: 'u1', origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1' }),
    })
    expect(m.proposalFindMany.mock.calls[0][0].where).toMatchObject({ serviceRequestId: 'r1', id: { not: 'pr1' }, status: 'PENDING' })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['pr2'] } }, data: { status: 'REJECTED' } })
    expect(m.srUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'ACCEPTED' } })
    expect(m.notifyProposalRejected).toHaveBeenCalledWith('pr2')
    expect(m.notifyProposalAccepted).toHaveBeenCalledWith('pr1')
    expect(m.scheduleAutomationsForUser).toHaveBeenCalledWith('u1', 'BOOKING_CREATED', { targetRole: 'CLIENT', contextId: 'b1' })
    expect(m.scheduleAutomationsForUser).toHaveBeenCalledWith('pu1', 'BOOKING_CREATED', { targetRole: 'PARTNER', contextId: 'b1' })
  })

  it('desde la app el evento lo firma el cliente', async () => {
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({ actorType: 'client', origin: 'app' })
  })

  it('sin PlatformConfig usa 5/10 sin fallar', async () => {
    m.configFindFirst.mockResolvedValue(null)
    await acceptProposal(client, 'pr1', APP_ORIGIN)
    expect(m.bookingCreate.mock.calls[0][0].data).toMatchObject({ clientCommissionRate: 5, partnerCommissionRate: 10 })
  })

  it('solicitud ajena → 403; propuesta no PENDING → 400; inexistente → 404', async () => {
    await expect(acceptProposal({ userId: 'otro', role: 'CLIENT' }, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.proposalFindUnique.mockResolvedValue(pendingProposal({ status: 'REJECTED' }))
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.proposalFindUnique.mockResolvedValue(null)
    await expect(acceptProposal(client, 'pr1', APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
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
