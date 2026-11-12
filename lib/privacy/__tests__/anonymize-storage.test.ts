import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ destroy: vi.fn(), order: [] as string[], txFail: false, url: (p: string) => `https://res.cloudinary.com/lohaggo/image/upload/v1/${p}.jpg` }))
const URL_ = m.url

vi.mock('@/lib/cloudinary', () => ({ cloudinaryService: { destroy: m.destroy, isEnabled: () => true, cloudName: () => 'lohaggo' } }))
vi.mock('bcryptjs', () => ({ default: { hash: async () => 'h' } }))

vi.mock('@/lib/prisma', () => {
  const URL_ = m.url
  const rows: Record<string, unknown> = {
    'user.findUnique': { id: 'u1', role: 'PARTNER', phone: null, image: URL_('avatar'), partnerProfile: { id: 'p1' } },
    'verificationDocument.findMany': [{ documentUrl: URL_('doc1'), publicId: 'docs/doc1' }],
    'partnerWorkPhoto.findMany': [{ url: URL_('work1'), publicId: null }],
    'conversation.findMany': [{ id: 'c1' }],
    'conversationMessage.findMany': [{ mediaUrl: URL_('chat1') }],
    'chatMessage.findMany': [],
    'bookingPhoto.findMany': [],
    'requestPhoto.findMany': [],
    'partnerBankAccount.findMany': [],
  }
  const model = (name: string) => new Proxy({}, { get: (_t, op: string) => (..._a: unknown[]) => {
    const key = `${name}.${op}`
    if (key in rows) return Promise.resolve(rows[key])
    return Promise.resolve({ count: op === 'count' ? 0 : 1 })
  } })
  const prisma = new Proxy({ $transaction: async (ops: unknown[]) => { m.order.push('tx'); if (m.txFail) throw new Error('tx failed'); return Promise.all(ops) } }, {
    get: (t, k: string) => (k in t ? (t as never)[k] : model(k)),
  })
  return { prisma }
})

import { anonymizeUser } from '../anonymize'

beforeEach(() => { vi.clearAllMocks(); m.order.length = 0; m.txFail = false; m.destroy.mockImplementation(async () => { m.order.push('destroy'); return 'ok' }) })

describe('anonimizar borra los archivos del proveedor', () => {
  it('borra después de la transacción y avisa la lista antes de ella', async () => {
    const collected: string[][] = []
    const r = await anonymizeUser('u1', { onAssetsCollected: async (refs) => { m.order.push('collected'); collected.push(refs) } })
    if (!r.ok) throw new Error('expected ok')
    expect(collected[0].sort()).toEqual(['image:avatar', 'image:chat1', 'image:docs/doc1', 'image:work1'])
    expect(m.order[0]).toBe('collected')
    expect(m.order.indexOf('tx')).toBeLessThan(m.order.indexOf('destroy'))
    expect(r.storage).toMatchObject({ total: 4, deleted: 4, failed: 0, pending: [] })
  })

  it('un fallo del proveedor no revierte la anonimización y deja el archivo pendiente', async () => {
    m.destroy.mockImplementation(async (id: string) => { if (id === 'work1') throw new Error('timeout'); return 'ok' })
    const r = await anonymizeUser('u1')
    if (!r.ok) throw new Error('expected ok')
    expect(r.storage).toMatchObject({ deleted: 3, failed: 1, pending: ['image:work1'] })
    expect(r.documents).toBe(1)
  })

  it('si la transacción falla no se borra ningún archivo', async () => {
    m.txFail = true
    await expect(anonymizeUser('u1')).rejects.toThrow('tx failed')
    expect(m.destroy).not.toHaveBeenCalled()
  })
})
