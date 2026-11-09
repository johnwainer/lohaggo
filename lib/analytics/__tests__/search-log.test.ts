import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; query: string; normalized: string; resultCount: number; userId: string | null; visitorId: string | null; source: string; createdAt: Date }

const db = vi.hoisted(() => {
  const rows: Row[] = []
  return {
    rows,
    fail: { create: false },
    prisma: {
      searchEvent: {
        findFirst: vi.fn(async ({ where }: { where: { userId?: string; visitorId?: string; createdAt: { gte: Date } } }) =>
          [...rows].reverse().find((r) => (where.userId ? r.userId === where.userId : r.visitorId === where.visitorId) && r.createdAt >= where.createdAt.gte) ?? null),
        create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
          if (db.fail.create) throw new Error('column "visitorId" does not exist')
          const row = { ...data, id: `s${rows.length + 1}`, createdAt: new Date() } as Row
          rows.push(row)
          return row
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
      },
    },
  }
})
const warn = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn, error() {} }) }))

import { continuesSearch, recordSearch } from '@/lib/analytics/search-log'
import { isInappropriate } from '@/lib/filters/searchFilter'

beforeEach(() => {
  db.rows.length = 0
  db.fail.create = false
  vi.clearAllMocks()
})

describe('registro de búsquedas', () => {
  it('las teclas de una misma búsqueda quedan en una fila con el texto completo', async () => {
    for (const q of ['plo', 'plom', 'plomero']) await recordSearch({ query: q, resultCount: q === 'plomero' ? 4 : 9, source: 'servicios', visitorId: 'v1' })
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]).toMatchObject({ query: 'plomero', normalized: 'plomero', resultCount: 4, visitorId: 'v1', source: 'servicios' })
  })

  it('otra búsqueda, otra persona u otro origen son filas aparte', async () => {
    await recordSearch({ query: 'plomero', resultCount: 4, source: 'servicios', visitorId: 'v1' })
    await recordSearch({ query: 'pintor', resultCount: 0, source: 'servicios', visitorId: 'v1' })
    await recordSearch({ query: 'pintor', resultCount: 2, source: 'servicios', visitorId: 'v2' })
    await recordSearch({ query: 'pintor', resultCount: 2, source: 'chat', userId: 'u1' })
    expect(db.rows.map((r) => [r.query, r.resultCount])).toEqual([['plomero', 4], ['pintor', 0], ['pintor', 2], ['pintor', 2]])
  })

  it('cuenta búsquedas reales que antes se descartaban y no las vacías', async () => {
    expect((await recordSearch({ query: 'computador', resultCount: 1, source: 'servicios', visitorId: 'v3' })).recorded).toBe(true)
    expect((await recordSearch({ query: 'x', resultCount: 1, source: 'servicios', visitorId: 'v3' })).recorded).toBe(false)
    expect(isInappropriate('techo')).toBe(false)
    expect(isInappropriate('cortinas')).toBe(false)
    expect(isInappropriate('paseador de perros')).toBe(false)
    expect(isInappropriate('control de ratas')).toBe(false)
    expect(isInappropriate('hijueputa')).toBe(true)
    expect(isInappropriate('jajaja')).toBe(true)
  })

  it('un insert que falla queda en el log, no en silencio', async () => {
    db.fail.create = true
    expect(await recordSearch({ query: 'plomero', resultCount: 1, source: 'servicios', visitorId: 'v1' })).toEqual({ recorded: false, reason: 'db' })
    expect(warn).toHaveBeenCalledWith('Search event not recorded', expect.objectContaining({ err: expect.stringMatching(/visitorId/) }))
  })

  it('continuesSearch: ventana de 90 s y mismo origen', () => {
    const now = new Date('2026-11-09T12:00:00Z')
    const prev = { normalized: 'plom', createdAt: new Date(now.getTime() - 30_000), source: 'servicios' }
    expect(continuesSearch(prev, { normalized: 'plomero', source: 'servicios' }, now)).toBe(true)
    expect(continuesSearch(prev, { normalized: 'pl', source: 'servicios' }, now)).toBe(true)
    expect(continuesSearch(prev, { normalized: 'pintor', source: 'servicios' }, now)).toBe(false)
    expect(continuesSearch(prev, { normalized: 'plomero', source: 'home' }, now)).toBe(false)
    expect(continuesSearch({ ...prev, createdAt: new Date(now.getTime() - 120_000) }, { normalized: 'plomero', source: 'servicios' }, now)).toBe(false)
    expect(continuesSearch(null, { normalized: 'plomero', source: 'servicios' }, now)).toBe(false)
  })
})
