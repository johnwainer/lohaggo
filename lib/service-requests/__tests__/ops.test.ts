import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  partnerFindUnique: vi.fn(),
  serviceFindUnique: vi.fn(),
  configFindFirst: vi.fn(),
  srCreate: vi.fn(),
  srFindUnique: vi.fn(),
  srUpdate: vi.fn(),
  proposalUpdateMany: vi.fn(),
  transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  notifyNewServiceRequest: vi.fn(async () => 1),
  notifyProposalRejected: vi.fn(async () => {}),
  recordPromptContext: vi.fn(async () => {}),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: m.userFindUnique },
    partnerProfile: { findUnique: m.partnerFindUnique },
    service: { findUnique: m.serviceFindUnique },
    platformConfig: { findFirst: m.configFindFirst },
    serviceRequest: { create: m.srCreate, findUnique: m.srFindUnique, update: m.srUpdate },
    proposal: { updateMany: m.proposalUpdateMany },
    $transaction: m.transaction,
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({
  notifyNewServiceRequest: m.notifyNewServiceRequest,
  notifyProposalRejected: m.notifyProposalRejected,
}))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: m.recordPromptContext }))

import { OpsError, APP_ORIGIN, chatOrigin } from '@/lib/ops/origin'
import { cancelServiceRequest, createServiceRequest } from '@/lib/service-requests/ops'

const client = { userId: 'u1', role: 'CLIENT' as const }
const input = { serviceId: 's1', address: 'Calle 10 # 20-30', city: 'MEDELLIN' as const, preferredDate: '2026-10-02', preferredTime: '10:00', budget: 80000 }

describe('crear solicitud', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.userFindUnique.mockResolvedValue({ isActive: true })
    m.serviceFindUnique.mockResolvedValue({ basePrice: 50000 })
    m.configFindFirst.mockResolvedValue(null)
    m.srCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'r1', city: 'MEDELLIN', isUrgent: false, ...a.data }))
  })

  it('desde la app queda con origin app y sin canal', async () => {
    const r = await createServiceRequest(client, input, APP_ORIGIN)
    expect(r.id).toBe('r1')
    const data = m.srCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ userId: 'u1', origin: 'app', originChannel: null, originConversationId: null, originAgentId: null, status: 'ACTIVE' })
    expect(data.preferredTime).toBe('10:00')
    expect(data.preferredDate.getHours()).toBe(10)
    expect(m.notifyNewServiceRequest).toHaveBeenCalledWith('r1')
    expect(m.recordPromptContext).toHaveBeenCalledWith('u1', 'CLIENT_REQUEST_CREATED', expect.objectContaining({ serviceRequestId: 'r1' }))
  })

  it('desde el chat lleva canal, conversación y agente', async () => {
    await createServiceRequest(client, input, chatOrigin({ channel: 'WHATSAPP', conversationId: 'c9', agentId: 'a3', agentName: 'Sofía' }))
    expect(m.srCreate.mock.calls[0][0].data).toMatchObject({ origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c9', originAgentId: 'a3' })
  })

  it('rechaza datos inválidos con 400 y el primer mensaje del schema', async () => {
    await expect(createServiceRequest(client, { ...input, address: 'x' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Address') })
  })

  it('presupuesto por debajo del precio base → 400', async () => {
    await expect(createServiceRequest(client, { ...input, budget: 1000 }, APP_ORIGIN)).rejects.toBeInstanceOf(OpsError)
    expect(m.srCreate).not.toHaveBeenCalled()
  })

  it('con socio directo exige que lo ofrezca activo y verificado', async () => {
    m.partnerFindUnique.mockResolvedValue({ id: 'p1', verified: true, isActive: true, services: [] })
    await expect(createServiceRequest(client, { ...input, partnerId: 'p1' }, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'Ese socio no ofrece este servicio' })
    m.partnerFindUnique.mockResolvedValue({ id: 'p1', verified: true, isActive: true, services: [{ price: 60000 }] })
    const r = await createServiceRequest(client, { ...input, partnerId: 'p1' }, APP_ORIGIN)
    expect(r.partnerId).toBe('p1')
  })

  it('aplica el mínimo y máximo de PlatformConfig', async () => {
    m.configFindFirst.mockResolvedValue({ minServicePrice: 100000, maxServicePrice: 1000000 })
    await expect(createServiceRequest(client, input, APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('mínimo') })
  })
})

describe('cancelar solicitud', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('ajena → 403', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'otro', status: 'ACTIVE', proposals: [] })
    await expect(cancelServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it('inexistente → 404 y no activa → 400', async () => {
    m.srFindUnique.mockResolvedValue(null)
    await expect(cancelServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'ACCEPTED', proposals: [] })
    await expect(cancelServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
  })

  it('propia y activa: cancela, rechaza las pendientes y avisa fuera de la transacción', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'ACTIVE', proposals: [{ id: 'p1', status: 'PENDING' }, { id: 'p2', status: 'REJECTED' }] })
    const r = await cancelServiceRequest(client, 'r1', APP_ORIGIN)
    expect(r).toEqual({ id: 'r1', cancelledProposals: 1 })
    expect(m.srUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CANCELLED' } })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] } }, data: { status: 'REJECTED' } })
    expect(m.notifyProposalRejected).toHaveBeenCalledWith('p1')
  })
})
