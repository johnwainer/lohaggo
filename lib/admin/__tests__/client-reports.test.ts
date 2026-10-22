import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  partnerFindUnique: vi.fn(),
  bookingFindUnique: vi.fn(),
  srFindUnique: vi.fn(),
  psFindFirst: vi.fn(),
  caseFindFirst: vi.fn(),
  caseFindMany: vi.fn(),
  caseCreate: vi.fn(),
  userFindMany: vi.fn(),
  createNotification: vi.fn(async (_p: Record<string, unknown>) => ({})),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    partnerProfile: { findUnique: m.partnerFindUnique },
    booking: { findUnique: m.bookingFindUnique },
    serviceRequest: { findUnique: m.srFindUnique },
    partnerService: { findFirst: m.psFindFirst },
    adminSupportCase: { findFirst: m.caseFindFirst, findMany: m.caseFindMany, create: m.caseCreate },
    user: { findMany: m.userFindMany },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: m.createNotification }))

import { APP_ORIGIN } from '@/lib/ops/origin'
import { clientReportPriority, clientReportSubject, listClientReportsBy, reportClient, validateClientReport } from '@/lib/admin/client-reports'

const partnerActor = { userId: 'pu1', role: 'PARTNER' as const, partnerId: 'p1' }

describe('validar reporte', () => {
  it('exige solicitud o reserva, un motivo válido y detalle si es «otro»', () => {
    expect(validateClientReport({ reason: 'NOT_SERIOUS' })).toMatchObject({ ok: false })
    expect(validateClientReport({ requestId: 'r1', reason: 'X' })).toMatchObject({ ok: false, error: 'Elige un motivo' })
    expect(validateClientReport({ requestId: 'r1', reason: 'OTHER', details: 'no' })).toMatchObject({ ok: false })
    expect(validateClientReport({ requestId: 'r1', reason: 'OTHER', details: 'Se echó para atrás' })).toMatchObject({ ok: true, reason: 'OTHER' })
    expect(validateClientReport({ bookingId: ' b1 ', reason: 'NO_RESPONSE' })).toMatchObject({ ok: true, bookingId: 'b1', requestId: null })
  })

  it('pagar por fuera es prioridad alta; el asunto lleva la referencia', () => {
    expect(clientReportPriority('PAY_OUTSIDE')).toBe('HIGH')
    expect(clientReportPriority('NOT_SERIOUS')).toBe('MEDIUM')
    expect(clientReportSubject('NOT_SERIOUS', { requestId: 'cmabcdef123456', bookingId: null })).toBe('Reporte de cliente: no es serio · solicitud #123456')
  })
})

describe('reportar cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.partnerFindUnique.mockResolvedValue({ id: 'p1', user: { name: 'Darwin' } })
    m.caseFindFirst.mockResolvedValue(null)
    m.caseCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'c1', subject: a.data.subject, priority: a.data.priority }))
    m.userFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
  })

  it('solo socios', async () => {
    await expect(reportClient({ userId: 'u1', role: 'CLIENT' }, { requestId: 'r1', reason: 'NOT_SERIOUS' }, APP_ORIGIN)).rejects.toMatchObject({ status: 403 })
  })

  it('una oportunidad: crea el caso en RISK firmado por el socio y avisa a los admins', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', partnerId: null, serviceId: 's1', city: 'MEDELLIN', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposals: [] })
    m.psFindFirst.mockResolvedValue({ id: 'ps1' })
    const c = await reportClient(partnerActor, { requestId: 'r1', reason: 'NOT_SERIOUS', details: 'quedamos y se echó para atrás' }, APP_ORIGIN)
    expect(c.id).toBe('c1')
    const data = m.caseCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ userId: 'pu1', role: 'PARTNER', requestId: 'r1', bookingId: null, queue: 'RISK', priority: 'MEDIUM', status: 'OPEN' })
    expect(data.description).toContain('Pedro')
    expect(data.description).toContain('quedamos y se echó para atrás')
    expect(m.createNotification).toHaveBeenCalledTimes(2)
    expect(m.createNotification.mock.calls[0][0]).toMatchObject({ userId: 'a1', data: expect.objectContaining({ supportCaseId: 'c1', url: '/admin/operations' }) })
  })

  it('una solicitud que el socio no podía ver → 404', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', partnerId: 'otro', serviceId: 's1', city: 'MEDELLIN', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposals: [] })
    m.psFindFirst.mockResolvedValue(null)
    await expect(reportClient(partnerActor, { requestId: 'r1', reason: 'NOT_SERIOUS' }, APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
    expect(m.caseCreate).not.toHaveBeenCalled()
  })

  it('una reserva ajena → 404; la propia guarda reserva y solicitud', async () => {
    m.bookingFindUnique.mockResolvedValue({ id: 'b1', partnerId: 'p2', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposal: { serviceRequestId: 'r1' } })
    await expect(reportClient(partnerActor, { bookingId: 'b1', reason: 'PAY_OUTSIDE' }, APP_ORIGIN)).rejects.toMatchObject({ status: 404 })
    m.bookingFindUnique.mockResolvedValue({ id: 'b1', partnerId: 'p1', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposal: { serviceRequestId: 'r1' } })
    await reportClient(partnerActor, { bookingId: 'b1', reason: 'PAY_OUTSIDE' }, APP_ORIGIN)
    expect(m.caseCreate.mock.calls[0][0].data).toMatchObject({ bookingId: 'b1', requestId: 'r1', priority: 'HIGH' })
  })

  it('un segundo reporte del mismo socio para la misma solicitud o reserva → 409', async () => {
    m.bookingFindUnique.mockResolvedValue({ id: 'b1', partnerId: 'p1', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposal: { serviceRequestId: 'r1' } })
    m.caseFindFirst.mockResolvedValue({ id: 'c0' })
    await expect(reportClient(partnerActor, { bookingId: 'b1', reason: 'NO_RESPONSE' }, APP_ORIGIN)).rejects.toMatchObject({ status: 409 })
    expect(m.caseFindFirst.mock.calls[0][0].where).toMatchObject({ userId: 'pu1', role: 'PARTNER', OR: [{ requestId: 'r1' }, { bookingId: 'b1' }] })
    expect(m.caseCreate).not.toHaveBeenCalled()
  })

  it('si avisar a los admins falla, el reporte queda igual', async () => {
    m.srFindUnique.mockResolvedValue({ id: 'r1', partnerId: 'p1', serviceId: 's1', city: 'MEDELLIN', user: { id: 'u9', name: 'Pedro' }, service: { name: 'Plomería' }, proposals: [] })
    m.userFindMany.mockRejectedValue(new Error('db'))
    await expect(reportClient(partnerActor, { requestId: 'r1', reason: 'CANCELLED_NO_NOTICE' }, APP_ORIGIN)).resolves.toMatchObject({ id: 'c1' })
  })

  it('lista los ids ya reportados por el socio', async () => {
    m.caseFindMany.mockResolvedValue([{ requestId: 'r1', bookingId: null }, { requestId: 'r2', bookingId: 'b2' }])
    await expect(listClientReportsBy('pu1')).resolves.toEqual({ requestIds: ['r1', 'r2'], bookingIds: ['b2'] })
  })
})
