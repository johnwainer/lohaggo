import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  srFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  srFindUnique: vi.fn(async (_a: any): Promise<any> => null),
  auditFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  auditCreate: vi.fn(async (_a: any) => ({})),
  psFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  notifFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  proposalFindMany: vi.fn(async (_a: any): Promise<any[]> => []),
  userFindMany: vi.fn(async (_a: any): Promise<any[]> => [{ id: 'admin1' }]),
  send: vi.fn(async (..._a: any[]) => ({ ok: true })),
  createNotification: vi.fn(async (_a: any) => ({})),
  sendWaToAdmins: vi.fn(async (..._a: any[]) => ({ admins: 1, sent: 1 })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceRequest: { findMany: m.srFindMany, findUnique: m.srFindUnique },
    adminAuditLog: { findMany: m.auditFindMany, create: m.auditCreate },
    partnerService: { findMany: m.psFindMany },
    notification: { findMany: m.notifFindMany },
    proposal: { findMany: m.proposalFindMany },
    user: { findMany: m.userFindMany },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({
  createNotification: m.createNotification,
  requestWhenText: vi.fn(async () => 'sáb 15 nov'),
  sendRequestNoticeToPartner: m.send,
}))
vi.mock('@/lib/messaging/wa-send', () => ({ sendWaToAdmins: m.sendWaToAdmins }))
vi.mock('@/lib/messaging/wa-specs', () => ({ WA: { D7: (p: unknown) => ({ event: 'D7', p }) } }))

import { REQUEST_WIDEN_ACTION, widenUnansweredRequests, widenedRequestIdsFor } from '@/lib/service-requests/reach'

const now = new Date('2026-11-09T15:00:00.000Z')
const request = (createdAt: Date) => ({
  id: 'sr1', serviceId: 's-pintura', address: 'Cra 100 #40, San Javier', city: 'MEDELLIN', zone: 'san-javier', isUrgent: false,
  preferredDate: new Date('2026-11-15T00:00:00.000Z'), preferredTime: null, status: 'ACTIVE', expiresAt: new Date('2026-11-11T15:00:00.000Z'), partnerId: null, createdAt,
  service: { name: 'Pintura', categoryId: 'cat-hogar' }, user: { name: 'Ana' }, proposals: [],
})
const offer = (id: string, zones: string[], rating = 4) => ({ partner: { id, userId: `u-${id}`, coverageZones: zones, rating, completedServicesCount: 0, user: { name: id } } })

beforeEach(() => {
  vi.clearAllMocks()
  m.psFindMany.mockResolvedValue([offer('zona', ['san-javier']), offer('vecino', ['robledo']), offer('lejos', ['el-poblado'], 5)])
  // The zone partner already got the first notice
  m.notifFindMany.mockImplementation(async (a: any) => (a.where.data?.contains === 'sr1' ? [{ userId: 'u-zona' }] : []))
})

describe('más socios para una solicitud sin propuestas', () => {
  it('a los 60 min: los de las zonas vecinas (nunca a quien ya se le avisó), marca la ola y alerta al equipo', async () => {
    const sr = request(new Date(now.getTime() - 70 * 60_000))
    m.srFindMany.mockResolvedValue([sr])
    m.srFindUnique.mockResolvedValue(sr)
    expect(await widenUnansweredRequests(now)).toEqual({ widened: 1, partnersWidened: 1 })
    expect(m.srFindMany.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE', partnerId: null, proposals: { none: {} } })
    expect(m.psFindMany.mock.calls[0][0].where).toMatchObject({ serviceId: 's-pintura', city: 'MEDELLIN', active: true, partner: { isActive: true, verified: true, isAvailable: true } })
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.send.mock.calls[0][1]).toEqual({ id: 'u-vecino', name: 'vecino' })
    expect(m.send.mock.calls[0][2]).toMatchObject({ direct: false, round: 51, reach: 'nearby' })
    expect(m.auditCreate.mock.calls[0][0].data).toMatchObject({ action: REQUEST_WIDEN_ACTION, entityId: 'sr1' })
    expect(JSON.parse(m.auditCreate.mock.calls[0][0].data.details)).toMatchObject({ wave: 1, scope: 'nearby', partners: 1 })
    expect(m.sendWaToAdmins).toHaveBeenCalledTimes(1)
    expect(m.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin1', title: 'Solicitud sin propuestas', channels: ['PUSH'] }))
  })

  it('a las 3 h: toda la ciudad, sin repetir la ola 1', async () => {
    const sr = request(new Date(now.getTime() - 3.2 * 3600_000))
    m.srFindMany.mockResolvedValue([sr])
    m.srFindUnique.mockResolvedValue(sr)
    m.auditFindMany.mockResolvedValue([{ entityId: 'sr1', details: JSON.stringify({ wave: 1 }) }])
    m.notifFindMany.mockImplementation(async (a: any) => (a.where.data?.contains === 'sr1' ? [{ userId: 'u-zona' }, { userId: 'u-vecino' }] : []))
    await widenUnansweredRequests(now)
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.send.mock.calls[0][1]).toEqual({ id: 'u-lejos', name: 'lejos' })
    expect(m.send.mock.calls[0][2]).toMatchObject({ round: 52, reach: 'city' })
  })

  it('las dos olas hechas, o un socio con el tope diario de avisos: no se envía nada', async () => {
    const sr = request(new Date(now.getTime() - 5 * 3600_000))
    m.srFindMany.mockResolvedValue([sr])
    m.srFindUnique.mockResolvedValue(sr)
    m.auditFindMany.mockResolvedValue([{ entityId: 'sr1', details: JSON.stringify({ wave: 1 }) }, { entityId: 'sr1', details: JSON.stringify({ wave: 2 }) }])
    expect(await widenUnansweredRequests(now)).toEqual({ widened: 0, partnersWidened: 0 })
    expect(m.send).not.toHaveBeenCalled()

    m.auditFindMany.mockResolvedValue([])
    m.notifFindMany.mockImplementation(async (a: any) => {
      if (a.where.data?.contains === 'sr1') return [{ userId: 'u-zona' }]
      return Array.from({ length: 6 }, () => ({ userId: 'u-vecino' }))
    })
    await widenUnansweredRequests(now)
    expect(m.send.mock.calls.map((c) => c[1].id)).not.toContain('u-vecino')
  })

  it('el socio ve en «Oportunidades» las solicitudes que se le avisaron fuera de sus zonas', async () => {
    m.notifFindMany.mockResolvedValue([{ data: JSON.stringify({ serviceRequestId: 'sr1', reach: 'nearby' }) }, { data: JSON.stringify({ serviceRequestId: 'sr1', reach: 'city' }) }, { data: '{}' }])
    expect(await widenedRequestIdsFor('u-vecino', now)).toEqual(['sr1'])
  })
})
