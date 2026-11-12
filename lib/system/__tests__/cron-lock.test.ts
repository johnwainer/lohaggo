import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  cronFindFirst: vi.fn(), cronCreate: vi.fn(), cronUpdate: vi.fn(), cronUpdateMany: vi.fn(), cronDelete: vi.fn(), cronFindMany: vi.fn(), cronDeleteMany: vi.fn(),
  incFindFirst: vi.fn(), incUpdate: vi.fn(), incCreate: vi.fn(), openIncident: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cronRun: { findFirst: m.cronFindFirst, create: m.cronCreate, update: m.cronUpdate, updateMany: m.cronUpdateMany, delete: m.cronDelete, findMany: m.cronFindMany, deleteMany: m.cronDeleteMany },
    adminIncident: { findFirst: m.incFindFirst, update: m.incUpdate, create: m.incCreate },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) }))
vi.mock('@/lib/ops/platform-ops', () => ({ openIncident: m.openIncident }))

import { acquireCronRun, cronRoute, reapStaleRuns, staleAfterMs } from '@/lib/system/cron'

const NOW = Date.parse('2026-11-12T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
})

describe('candado contra solapamiento', () => {
  it('la ventana es maxDuration + 60 s', () => {
    expect(staleAfterMs(300)).toBe(360_000)
    expect(staleAfterMs(60)).toBe(120_000)
  })

  it('omite la ejecución si otra del mismo job sigue viva', async () => {
    m.cronFindFirst.mockResolvedValueOnce({ id: 'live' })
    const r = await acquireCronRun('automations', 300, NOW)
    expect(r).toEqual({ run: null, skipped: true })
    expect(m.cronCreate).not.toHaveBeenCalled()
    // looks only at runs younger than maxDuration + 60 s
    const where = m.cronFindFirst.mock.calls[0][0].where
    expect(where.status).toBe('running')
    expect(where.startedAt.gte.getTime()).toBe(NOW - 360_000)
  })

  it('toma el candado cuando no hay otra viva', async () => {
    m.cronFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    m.cronCreate.mockResolvedValueOnce({ id: 'mine' })
    const r = await acquireCronRun('automations', 300, NOW)
    expect(r).toEqual({ run: { id: 'mine' }, skipped: false })
  })

  it('si dos arrancan juntos, la que ve otra viva al reconfirmar se retira', async () => {
    m.cronFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'other' })
    m.cronCreate.mockResolvedValueOnce({ id: 'mine' })
    m.cronDelete.mockResolvedValueOnce({})
    const r = await acquireCronRun('automations', 300, NOW)
    expect(r.skipped).toBe(true)
    expect(m.cronDelete).toHaveBeenCalledWith({ where: { id: 'mine' } })
  })

  it('cronRoute responde skipped sin correr el handler', async () => {
    m.cronUpdateMany.mockResolvedValue({ count: 0 })
    m.cronFindFirst.mockResolvedValueOnce({ id: 'live' })
    const handler = vi.fn()
    const res = await cronRoute('automations', handler)({ headers: new Headers({ authorization: 'Bearer cron-secret' }) } as never)
    expect(handler).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ ok: true, skipped: 'overlap' })
  })

  it('sin CRON_SECRET se niega y con otro secreto responde 401', async () => {
    const handler = vi.fn()
    expect((await cronRoute('x', handler)({ headers: new Headers({ authorization: 'Bearer nope' }) } as never)).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await cronRoute('x', handler)({ headers: new Headers() } as never)).status).toBe(503)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('ejecuciones cortadas por la plataforma', () => {
  it('marca las viejas como error timeout y abre un incidente cron:timeout con el detalle', async () => {
    m.cronFindMany.mockResolvedValueOnce([{ id: 'r1', startedAt: new Date(NOW - 400_000) }])
    m.cronUpdateMany.mockResolvedValueOnce({ count: 1 })
    m.incFindFirst.mockResolvedValueOnce(null)
    const n = await reapStaleRuns('automations', 300, NOW)
    expect(n).toBe(1)
    expect(m.cronFindMany.mock.calls[0][0].where).toMatchObject({ job: 'automations', status: 'running', finishedAt: null, durationMs: null })
    const call = m.cronUpdateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ id: { in: ['r1'] }, job: 'automations', status: 'running', finishedAt: null, durationMs: null })
    expect(call.where.startedAt.lt.getTime()).toBe(NOW - 360_000)
    expect(call.data).toMatchObject({ status: 'error', error: 'timeout' })
    expect(m.openIncident).toHaveBeenCalledWith(expect.objectContaining({ type: 'cron:timeout:automations', severity: 'HIGH', description: expect.stringMatching(/r1.*maxDuration de la ruta: 300 s/) }))
  })

  it('falso positivo: una ejecución que terminó entre la lectura y la escritura no abre incidente', async () => {
    m.cronFindMany.mockResolvedValueOnce([{ id: 'r1', startedAt: new Date(NOW - 400_000) }])
    m.cronUpdateMany.mockResolvedValueOnce({ count: 0 })
    expect(await reapStaleRuns('meta-pending', 300, NOW)).toBe(0)
    expect(m.openIncident).not.toHaveBeenCalled()
    expect(m.incUpdate).not.toHaveBeenCalled()
  })

  it('falso positivo: sin filas vivas pasado su propio límite no hay candidatas', async () => {
    m.cronFindMany.mockResolvedValueOnce([])
    expect(await reapStaleRuns('haggo', 60, NOW)).toBe(0)
    expect(m.cronUpdateMany).not.toHaveBeenCalled()
    expect(m.cronFindMany.mock.calls[0][0].where.startedAt.lt.getTime()).toBe(NOW - 120_000)
  })

  it('falso positivo: si el cierre de la fila falla una vez se reintenta y no queda «running»', async () => {
    m.cronUpdateMany.mockResolvedValue({ count: 0 })
    m.cronFindMany.mockResolvedValue([])
    m.cronFindFirst.mockResolvedValue(null)
    m.cronCreate.mockResolvedValueOnce({ id: 'mine' })
    m.cronUpdate.mockRejectedValueOnce(new Error('pooler')).mockResolvedValue({})
    m.incFindFirst.mockResolvedValue(null)
    const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await cronRoute('haggo', handler)({ headers: new Headers({ authorization: 'Bearer cron-secret' }) } as never)
    expect(m.cronUpdate).toHaveBeenCalledTimes(2)
    expect(m.cronUpdate.mock.calls[1][0].data.status).toBe('ok')
  })

  it('no abre un segundo incidente si ya hay uno abierto', async () => {
    m.cronFindMany.mockResolvedValueOnce([{ id: 'a', startedAt: new Date(NOW - 500_000) }, { id: 'b', startedAt: new Date(NOW - 450_000) }])
    m.cronUpdateMany.mockResolvedValueOnce({ count: 2 })
    m.incFindFirst.mockResolvedValueOnce({ id: 'inc1' })
    await reapStaleRuns('automations', 300, NOW)
    expect(m.openIncident).not.toHaveBeenCalled()
    expect(m.incUpdate).toHaveBeenCalled()
  })

  it('sin ejecuciones colgadas no hace nada', async () => {
    m.cronFindMany.mockResolvedValueOnce([])
    expect(await reapStaleRuns('automations', 300, NOW)).toBe(0)
    expect(m.incFindFirst).not.toHaveBeenCalled()
  })

  it('una ejecución exitosa cierra el incidente de timeout', async () => {
    m.cronUpdateMany.mockResolvedValue({ count: 0 })
    m.cronFindFirst.mockResolvedValue(null)
    m.cronCreate.mockResolvedValueOnce({ id: 'mine' })
    m.cronUpdate.mockResolvedValue({})
    m.incFindFirst.mockImplementation(async ({ where }: { where: { type: string } }) => (where.type === 'cron:timeout:automations' ? { id: 'inc-timeout' } : null))
    const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await cronRoute('automations', handler)({ headers: new Headers({ authorization: 'Bearer cron-secret' }) } as never)
    expect(m.incUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inc-timeout' }, data: expect.objectContaining({ status: 'RESOLVED' }) }))
  })
})
