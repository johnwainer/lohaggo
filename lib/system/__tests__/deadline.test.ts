import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ partnerFindMany: vi.fn(), sendToUser: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => m.partnerFindMany }) }),
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) }))
vi.mock('@/lib/messaging/wa-send', () => ({ deliverWa: vi.fn(), sendWaToAdmins: vi.fn(), sendWaToUser: m.sendToUser }))

import { createDeadline, isExpired } from '@/lib/system/deadline'
import { runWaDaily } from '@/lib/messaging/wa-scheduled'

describe('deadline compartido', () => {
  it('expira cuando pasa el presupuesto y cuenta lo que queda', () => {
    let t = 1000
    const d = createDeadline(240_000, () => t)
    expect(d.expired()).toBe(false)
    expect(d.remaining()).toBe(240_000)
    t += 239_999
    expect(d.expired()).toBe(false)
    t += 1
    expect(d.expired()).toBe(true)
    expect(d.remaining()).toBe(0)
  })

  it('isExpired tolera la ausencia de deadline', () => {
    expect(isExpired(undefined)).toBe(false)
    expect(isExpired(null)).toBe(false)
  })
})

describe('runWaDaily con deadline', () => {
  it('con el deadline vencido no consulta ni envía nada y deja todo para la próxima ejecución', async () => {
    m.partnerFindMany.mockClear()
    m.sendToUser.mockClear()
    const t = await runWaDaily(new Date('2026-11-12T15:00:00Z'), createDeadline(0))
    expect(m.partnerFindMany).not.toHaveBeenCalled()
    expect(m.sendToUser).not.toHaveBeenCalled()
    expect(Object.keys(t).every((k) => k.endsWith('_deferred'))).toBe(true)
    expect(Object.keys(t)).toEqual(expect.arrayContaining(['C3_deferred', 'B24_deferred']))
  })

  it('se detiene entre envíos cuando el deadline vence a mitad', async () => {
    let t = 0
    const deadline = createDeadline(10, () => t)
    m.partnerFindMany.mockReset()
    m.sendToUser.mockReset()
    // C3: the first query returns 3 partners; the clock runs out after the first send
    m.partnerFindMany.mockResolvedValueOnce([
      { userId: 'a', user: { name: 'A' } }, { userId: 'b', user: { name: 'B' } }, { userId: 'c', user: { name: 'C' } },
    ]).mockResolvedValue([])
    m.sendToUser.mockImplementation(async () => { t += 100; return { ok: true } })
    await runWaDaily(new Date('2026-11-12T15:00:00Z'), deadline)
    expect(m.sendToUser).toHaveBeenCalledTimes(1)
  })
})
