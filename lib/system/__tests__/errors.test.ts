import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ upsert: vi.fn(), findUnique: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { appErrorGroup: { upsert: m.upsert, findUnique: m.findUnique } } }))

const word = (i: number) => String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + String.fromCharCode(97 + Math.floor(i / 676))

import { errorTrackingState, recordError, resetErrorTrackingForTests } from '@/lib/system/errors'

beforeEach(() => {
  vi.clearAllMocks()
  resetErrorTrackingForTests()
})

describe('recordError', () => {
  it('guarda el grupo, enmascara datos personales y anota la hora de la última escritura', async () => {
    m.upsert.mockResolvedValue({ count: 1 })
    await recordError({ source: 'server', context: 'x', message: 'falló para juan@correo.com con 3001234567' })
    expect(m.upsert).toHaveBeenCalledTimes(1)
    const arg = m.upsert.mock.calls[0][0]
    expect(arg.create.message).toBe('falló para <email> con <num>')
    expect(errorTrackingState().lastWriteAt).not.toBeNull()
    expect(errorTrackingState().failures).toBe(0)
  })

  it('si la base de datos falla no lanza, deja console.error y queda a la vista', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    m.upsert.mockRejectedValue(new Error('db caída'))
    await expect(recordError({ source: 'server', message: 'boom' })).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0].join(' '))).toContain('db caída')
    const s = errorTrackingState()
    expect(s.failures).toBe(1)
    expect(s.lastFailure).toBe('db caída')
    expect(s.lastWriteAt).toBeNull()
    spy.mockRestore()
  })

  it('el tope de grupos nuevos por hora cuenta solo los grupos nuevos, no las repeticiones', async () => {
    // 400 repeated errors of existing groups (count > 1) must not use up the cap of 300 new client groups
    m.upsert.mockImplementation(async () => ({ count: 5 }))
    m.findUnique.mockResolvedValue(null)
    for (let i = 0; i < 400; i++) await recordError({ source: 'client', message: `repetido ${word(i)}` })
    expect(m.upsert).toHaveBeenCalledTimes(400)
    // a new group still gets written
    m.upsert.mockClear()
    m.upsert.mockResolvedValue({ count: 1 })
    await recordError({ source: 'client', message: 'nuevo de verdad' })
    expect(m.upsert).toHaveBeenCalledTimes(1)
  })

  it('pasado el tope, un error de navegador de un grupo nuevo se descarta pero uno existente se cuenta', async () => {
    m.upsert.mockResolvedValue({ count: 1 })
    for (let i = 0; i < 302; i++) await recordError({ source: 'client', message: `grupo ${word(i)}` })
    m.upsert.mockClear()
    m.findUnique.mockResolvedValueOnce(null)
    await recordError({ source: 'client', message: 'otro grupo nuevo' })
    expect(m.upsert).not.toHaveBeenCalled()
    m.findUnique.mockResolvedValueOnce({ id: 'g' })
    await recordError({ source: 'client', message: 'grupo ya existente' })
    expect(m.upsert).toHaveBeenCalledTimes(1)
  })
})
