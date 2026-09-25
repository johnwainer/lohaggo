import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  findMany: vi.fn(), updateMany: vi.fn(), emit: vi.fn(), notifCreate: vi.fn(async (a: { data: { userId: string } }) => ({ id: 'n', ...a.data })), findUnique: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { conversation: { findMany: m.findMany, updateMany: m.updateMany }, serviceRequest: { findUnique: m.findUnique }, notification: { create: m.notifCreate }, user: { findUnique: async () => null } } }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/messaging/inbox-emitter', () => ({ emitInboxEvent: m.emit }))
vi.mock('@/lib/messaging/whatsapp-templates', () => ({ sendNuevaSolicitudSocio: vi.fn(async () => {}), sendSolicitudEnviadaCliente: vi.fn(async () => {}) }))

import { releaseAgentConversations } from '@/lib/ai/agent-ops'

describe('pausar un agente de la bandeja libera sus conversaciones', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('las abiertas pasan a personas con prioridad alta y se avisa a la bandeja', async () => {
    m.findMany.mockResolvedValue([{ id: 'c1', workspaceId: 'w' }, { id: 'c2', workspaceId: 'w' }])
    expect(await releaseAgentConversations('a1')).toEqual(['c1', 'c2'])
    expect(m.findMany.mock.calls[0][0].where).toMatchObject({ aiAgentId: 'a1', aiHandled: true, status: { in: ['OPEN', 'IN_PROGRESS'] } })
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1', 'c2'] } }, data: { aiHandled: false, priority: 'high' } })
    expect(m.emit).toHaveBeenCalledTimes(2)
  })
  it('sin conversaciones abiertas no escribe nada', async () => {
    m.findMany.mockResolvedValue([])
    expect(await releaseAgentConversations('a1')).toEqual([])
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})

describe('avisar a socios de una solicitud: con partnersOnly no se le escribe otra vez al cliente', async () => {
  const svc = await import('@/lib/notifications/notificationService')
  const request = {
    id: 'r1', serviceId: 's1', city: 'MEDELLIN', isUrgent: false, preferredDate: null, preferredTime: null, partnerId: null, partner: null,
    user: { id: 'client', name: 'Cliente', phone: '300' },
    service: { name: 'Plomería', partners: [{ partner: { city: 'MEDELLIN', isActive: true, verified: true, isAvailable: true, user: { id: 'p1', name: 'Socio', phone: '301' } } }, { partner: { city: 'BOGOTA', isActive: true, verified: true, isAvailable: true, user: { id: 'p2', name: 'Otro', phone: null } } }] },
  }
  it('cuenta los socios avisados y no crea la notificación del cliente', async () => {
    m.findUnique.mockResolvedValue(request)
    m.notifCreate.mockClear()
    const n = await svc.notifyNewServiceRequest('r1', { partnersOnly: true })
    expect(n).toBe(1)
    const users = m.notifCreate.mock.calls.map((c) => c[0].data.userId)
    expect(users).toContain('p1')
    expect(users).not.toContain('client')
    expect(users).not.toContain('p2')
  })

  it('sin la opción (solicitud nueva) el cliente sí recibe su confirmación, como siempre', async () => {
    m.findUnique.mockResolvedValue(request)
    m.notifCreate.mockClear()
    await svc.notifyNewServiceRequest('r1')
    expect(m.notifCreate.mock.calls.map((c) => c[0].data.userId)).toContain('client')
  })
})
