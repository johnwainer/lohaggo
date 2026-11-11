import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma, send, hit } = vi.hoisted(() => ({
  prisma: {
    serviceRequest: { findUnique: vi.fn(), findMany: vi.fn() },
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    conversationMessage: { findFirst: vi.fn() },
    messagingOptOut: { findFirst: vi.fn() },
  },
  send: vi.fn(),
  hit: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/inbox/send', () => ({ sendToConversation: send }))
vi.mock('@/lib/rate-limit-store', () => ({ hit }))
vi.mock('@/lib/messaging/inbox-emitter', () => ({ emitInboxEvent: vi.fn() }))
vi.mock('@/lib/payments/commission', () => ({ loadEffectiveRates: async () => ({ client: 0 }) }))

import { partnerCancelledInChat, proposalArrivedInChat } from '@/lib/proposals/chat-digest'

const now = new Date('2026-11-11T16:00:00Z')
const proposal = (id: string, price: number, name: string) => ({
  id, price, status: 'PENDING', createdAt: now, proposedDate: null, proposedTime: null,
  partner: { rating: 4.8, totalReviews: 10, completedServicesCount: 10, user: { name } },
})
const request = (over: Record<string, unknown> = {}) => ({
  id: 'req1', userId: 'u1', status: 'ACTIVE', origin: 'chat', originConversationId: 'conv1', service: { name: 'Plomería' },
  proposals: [proposal('p1', 150000, 'Darwin Pérez'), proposal('p2', 120000, 'Luis')], ...over,
})
const conv = (fields: Record<string, unknown> = {}) => ({
  id: 'conv1', workspaceId: 'ws', channel: 'WHATSAPP', contactPhone: '+573000000000', userId: 'u1', isTest: false, aiSpam: false,
  customFields: { inbox: { lastInboundAt: new Date(now.getTime() - 3600_000).toISOString() }, ...fields },
})

beforeEach(() => {
  vi.clearAllMocks()
  prisma.messagingOptOut.findFirst.mockResolvedValue(null)
  hit.mockResolvedValue({ count: 1 })
  send.mockResolvedValue({ ok: true })
  prisma.conversation.update.mockResolvedValue({})
})

describe('propuestas que llegan a una solicitud pedida por chat', () => {
  it('chat abierto: un solo mensaje con todas, ordenado y numerado (sin plantilla)', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(request())
    prisma.conversation.findUnique.mockResolvedValue(conv())
    expect(await proposalArrivedInChat('req1', now)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const msg = send.mock.calls[0][0].message as string
    expect(msg).toContain('Ya tienes 2 propuestas para Plomería')
    expect(msg).toContain('Responde 1 o 2 para elegir')
    const saved = prisma.conversation.update.mock.calls[0][0].data.customFields
    expect(saved.proposalDigest.req1.ids).toEqual(['p1', 'p2'])
    expect(saved.proposalOptions.items).toHaveLength(2)
  })
  it('otra propuesta minutos después espera la actualización (ni mensaje ni plantilla)', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(request())
    prisma.conversation.findUnique.mockResolvedValue(conv({ proposalDigest: { req1: { at: new Date(now.getTime() - 5 * 60_000).toISOString(), ids: ['p1'] } } }))
    expect(await proposalArrivedInChat('req1', now)).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })
  it('ventana cerrada, STOP o solicitud de la app: va la plantilla de siempre', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(request())
    prisma.conversation.findUnique.mockResolvedValue({ ...conv(), customFields: { inbox: { lastInboundAt: new Date(now.getTime() - 30 * 3600_000).toISOString() } } })
    expect(await proposalArrivedInChat('req1', now)).toBe(false)
    prisma.conversation.findUnique.mockResolvedValue(conv())
    prisma.messagingOptOut.findFirst.mockResolvedValue({ id: 'stop' })
    expect(await proposalArrivedInChat('req1', now)).toBe(false)
    prisma.serviceRequest.findUnique.mockResolvedValue(request({ origin: 'app', originConversationId: null }))
    expect(await proposalArrivedInChat('req1', now)).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it('si el envío falla, la plantilla lo cubre', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(request())
    prisma.conversation.findUnique.mockResolvedValue(conv())
    send.mockResolvedValue({ ok: false, error: 'x' })
    expect(await proposalArrivedInChat('req1', now)).toBe(false)
  })
})

describe('el socio canceló una reserva que vino de una solicitud por chat', () => {
  it('el cliente recibe en su chat las otras propuestas de la solicitud', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(request({ proposals: [proposal('p2', 120000, 'Luis')] }))
    prisma.conversation.findUnique.mockResolvedValue(conv())
    expect(await partnerCancelledInChat({ requestId: 'req1', partnerName: 'Darwin Pérez' }, now)).toBe(true)
    const msg = send.mock.calls[0][0].message as string
    expect(msg).toContain('Darwin canceló tu reserva de Plomería')
    expect(msg).toContain('1) Luis')
  })
})
