import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ getServerSession: vi.fn(), userFindUnique: vi.fn() }))

vi.mock('next-auth', () => ({ getServerSession: m.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: m.userFindUnique }, adminAuditLog: { create: vi.fn() } } }))

import { requireAdmin } from '@/lib/admin-utils'

const session = { user: { email: 'a@x.co', role: 'ADMIN' } }
const dbAdmin = { id: 'u1', email: 'a@x.co', name: 'A', role: 'ADMIN', isSuperAdmin: false, isActive: true }

beforeEach(() => vi.clearAllMocks())

describe('requireAdmin', () => {
  it('deja pasar a un admin activo', async () => {
    m.getServerSession.mockResolvedValue(session)
    m.userFindUnique.mockResolvedValue(dbAdmin)
    expect(await requireAdmin()).toMatchObject({ id: 'u1' })
  })

  it('rechaza a un admin desactivado aunque su token diga ADMIN', async () => {
    m.getServerSession.mockResolvedValue(session)
    m.userFindUnique.mockResolvedValue({ ...dbAdmin, isActive: false })
    expect(await requireAdmin()).toBeNull()
  })

  it('rechaza a quien ya no es admin en la base de datos', async () => {
    m.getServerSession.mockResolvedValue(session)
    m.userFindUnique.mockResolvedValue({ ...dbAdmin, role: 'CLIENT' })
    expect(await requireAdmin()).toBeNull()
  })

  it('rechaza sin sesión, con rol de token distinto o con usuario inexistente', async () => {
    m.getServerSession.mockResolvedValue(null)
    expect(await requireAdmin()).toBeNull()
    m.getServerSession.mockResolvedValue({ user: { email: 'a@x.co', role: 'CLIENT' } })
    expect(await requireAdmin()).toBeNull()
    m.getServerSession.mockResolvedValue(session)
    m.userFindUnique.mockResolvedValue(null)
    expect(await requireAdmin()).toBeNull()
  })
})
