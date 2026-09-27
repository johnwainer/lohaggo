import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  srFindUnique: vi.fn(),
  srFindMany: vi.fn(),
  srUpdateMany: vi.fn(),
  proposalUpdateMany: vi.fn(async () => ({ count: 0 })),
  auditCount: vi.fn(async () => 0),
  auditCreate: vi.fn(async (_a: any) => ({})),
  auditFindFirst: vi.fn(async () => null),
  auditFindMany: vi.fn(async () => []),
  notifyNewServiceRequest: vi.fn(async () => 3),
  notifyProposalRejected: vi.fn(async () => {}),
  createNotification: vi.fn(async (_a: any) => ({})),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceRequest: { findUnique: m.srFindUnique, findMany: m.srFindMany, updateMany: m.srUpdateMany },
    proposal: { updateMany: m.proposalUpdateMany },
    adminAuditLog: { count: m.auditCount, create: m.auditCreate, findFirst: m.auditFindFirst, findMany: m.auditFindMany },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({
  notifyNewServiceRequest: m.notifyNewServiceRequest,
  notifyProposalRejected: m.notifyProposalRejected,
  createNotification: m.createNotification,
}))
vi.mock('@/lib/pwa/adoption-strategy', () => ({ recordPromptContext: vi.fn() }))

import { APP_ORIGIN } from '@/lib/ops/origin'
import {
  MAX_REACTIVATIONS, REQUEST_EXPIRE_ACTION, REQUEST_REACTIVATE_ACTION, REQUEST_RESEND_ACTION,
  expireOverdueRequests, isRequestExpired, reactivateServiceRequest, resendUnansweredRequests,
} from '@/lib/service-requests/ops'

const client = { userId: 'u1', role: 'CLIENT' as const }
const now = new Date('2026-10-01T15:00:00.000Z')
const past = new Date(now.getTime() - 60_000)
const future = new Date(now.getTime() + 3600_000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  m.srUpdateMany.mockResolvedValue({ count: 1 })
})

describe('isRequestExpired', () => {
  it('EXPIRED o ACTIVE con fecha pasada', () => {
    expect(isRequestExpired({ status: 'EXPIRED', expiresAt: future }, now)).toBe(true)
    expect(isRequestExpired({ status: 'ACTIVE', expiresAt: past }, now)).toBe(true)
    expect(isRequestExpired({ status: 'ACTIVE', expiresAt: future }, now)).toBe(false)
    expect(isRequestExpired({ status: 'ACCEPTED', expiresAt: past }, now)).toBe(false)
  })
})

describe('reactivar solicitud', () => {
  it('pone ACTIVE por 24 h, restaura propuestas cerradas por vencimiento, audita y avisa a socios', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'EXPIRED', expiresAt: past })
    m.auditFindFirst.mockResolvedValue({ details: JSON.stringify({ proposalIds: ['p1', 'p2'] }) } as never)
    m.proposalUpdateMany.mockResolvedValue({ count: 2 })
    const r = await reactivateServiceRequest(client, 'r1', APP_ORIGIN)
    expect(r).toMatchObject({ reactivations: 1, remaining: MAX_REACTIVATIONS - 1, restoredProposals: 2 })
    expect(r.expiresAt.toISOString()).toBe('2026-10-02T15:00:00.000Z')
    expect(m.srUpdateMany.mock.calls[0][0].data).toMatchObject({ status: 'ACTIVE' })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['p1', 'p2'] }, serviceRequestId: 'r1', status: 'REJECTED' }, data: { status: 'PENDING' } })
    expect(m.auditCreate.mock.calls[0][0].data).toMatchObject({ action: REQUEST_REACTIVATE_ACTION, entityId: 'r1', actorId: 'u1' })
    expect(m.notifyNewServiceRequest).toHaveBeenCalledWith('r1', { partnersOnly: true })
  })

  it('ACTIVE ya vencida también se reactiva (sin restaurar nada)', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'ACTIVE', expiresAt: past })
    await reactivateServiceRequest(client, 'r1', APP_ORIGIN)
    expect(m.proposalUpdateMany).not.toHaveBeenCalled()
    expect(m.srUpdateMany).toHaveBeenCalled()
  })

  it('ajena → 403; activa vigente o aceptada → 400; tope de 3 → 400; inexistente → 404', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'otro', status: 'EXPIRED', expiresAt: past })
    await expect(reactivateServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'ACTIVE', expiresAt: future })
    await expect(reactivateServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 400, message: 'Tu solicitud sigue activa' })
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'ACCEPTED', expiresAt: past })
    await expect(reactivateServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.srFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1', status: 'EXPIRED', expiresAt: past })
    m.auditCount.mockResolvedValueOnce(3)
    await expect(reactivateServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 400 })
    m.srFindUnique.mockResolvedValue(null)
    await expect(reactivateServiceRequest(client, 'r1', APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
    expect(m.srUpdateMany).not.toHaveBeenCalled()
  })
})

describe('reenvío a las 2 h sin propuestas', () => {
  it('solo una vez por solicitud: salta las que ya tienen marca', async () => {
    m.srFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    m.auditFindMany.mockResolvedValue([{ entityId: 'r1' }] as never)
    const res = await resendUnansweredRequests(now)
    expect(res).toEqual({ resent: 1, partnersNotified: 3 })
    expect(m.notifyNewServiceRequest).toHaveBeenCalledTimes(1)
    expect(m.notifyNewServiceRequest).toHaveBeenCalledWith('r2', { partnersOnly: true })
    expect(m.auditCreate.mock.calls[0][0].data).toMatchObject({ action: REQUEST_RESEND_ACTION, entityId: 'r2' })
    const where = m.srFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({ status: 'ACTIVE', proposals: { none: {} } })
    expect(where.createdAt.lte.toISOString()).toBe('2026-10-01T13:00:00.000Z')
  })
})

describe('vencimiento', () => {
  it('pasa a EXPIRED, rechaza propuestas pendientes, guarda cuáles y avisa al cliente con enlace', async () => {
    m.srFindMany.mockResolvedValue([{ id: 'r1', userId: 'u1', service: { name: 'Plomería' }, proposals: [{ id: 'p1' }] }])
    const res = await expireOverdueRequests(now)
    expect(res).toEqual({ expired: 1, rejectedProposals: 1 })
    expect(m.srUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'r1', status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
    expect(m.proposalUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] }, status: 'PENDING' }, data: { status: 'REJECTED' } })
    expect(m.auditCreate.mock.calls[0][0].data).toMatchObject({ action: REQUEST_EXPIRE_ACTION, entityId: 'r1', details: JSON.stringify({ proposalIds: ['p1'] }) })
    expect(m.notifyProposalRejected).toHaveBeenCalledWith('p1')
    const n = m.createNotification.mock.calls[0][0] as unknown as { userId: string; message: string; data: { url: string } }
    expect(n.userId).toBe('u1')
    expect(n.message).toBe('Tu solicitud de Plomería venció sin que eligieras propuesta. Puedes reactivarla con un toque.')
    expect(n.data.url).toBe('/dashboard?tab=requests')
  })

  it('si otra ejecución ya la venció, no repite avisos', async () => {
    m.srFindMany.mockResolvedValue([{ id: 'r1', userId: 'u1', service: { name: 'Plomería' }, proposals: [] }])
    m.srUpdateMany.mockResolvedValue({ count: 0 })
    expect(await expireOverdueRequests(now)).toEqual({ expired: 0, rejectedProposals: 0 })
    expect(m.createNotification).not.toHaveBeenCalled()
  })
})
