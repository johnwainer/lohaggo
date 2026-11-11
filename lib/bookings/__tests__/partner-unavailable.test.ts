import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  prisma: {
    booking: { findUnique: vi.fn() },
    bookingEvent: { findFirst: vi.fn(), create: vi.fn() },
    proposal: { findMany: vi.fn() },
    conversation: { findFirst: vi.fn(), findUnique: vi.fn() },
    conversationTask: { create: vi.fn() },
    user: { findMany: vi.fn() },
  },
  openClientChat: vi.fn(),
  send: vi.fn(),
  notify: vi.fn(),
  adminsInApp: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))
vi.mock('@/lib/proposals/chat-digest', () => ({ openClientChat: m.openClientChat }))
vi.mock('@/lib/inbox/send', () => ({ sendToConversation: m.send }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: m.notify }))
vi.mock('@/lib/inbox/escalation', () => ({ notifyAdminsInApp: m.adminsInApp, workspaceAdminIds: async () => ['admin1'] }))

import { handlePartnerUnavailable } from '@/lib/bookings/partner-unavailable'

const now = new Date('2026-11-11T14:00:00Z')
const booking = {
  id: 'bk-000abc', userId: 'u1', status: 'CONFIRMED', scheduledDate: new Date('2026-11-12T00:00:00Z'), scheduledTime: '09:00', originConversationId: null, proposalId: 'pr1',
  service: { name: 'Plomería' }, proposal: { serviceRequestId: 'sr1', serviceRequest: { originConversationId: 'conv1' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  m.prisma.booking.findUnique.mockResolvedValue(booking)
  m.prisma.bookingEvent.findFirst.mockResolvedValue(null)
  m.prisma.bookingEvent.create.mockResolvedValue({})
  m.prisma.proposal.findMany.mockResolvedValue([{ price: 130000 }, { price: 110000 }])
  m.prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' })
  m.prisma.conversationTask.create.mockResolvedValue({})
  m.openClientChat.mockResolvedValue({ id: 'conv1', workspaceId: 'ws', userId: 'u1' })
  m.send.mockResolvedValue({ ok: true })
  m.notify.mockResolvedValue({})
})

describe('el socio avisa que no puede ir', () => {
  it('el cliente recibe sus opciones en el chat, y el equipo una tarea y una alerta', async () => {
    expect(await handlePartnerUnavailable({ bookingId: booking.id, kind: 'cannot', partnerName: 'Darwin Pérez', now })).toBe(true)
    const msg = m.send.mock.calls[0][0].message as string
    expect(msg).toContain('Darwin nos avisó que no podrá atender tu servicio de Plomería')
    expect(msg).toMatch(/2 propuestas más \(desde \$\s?110\.000\)/)
    const task = m.prisma.conversationTask.create.mock.calls[0][0].data
    expect(task).toMatchObject({ conversationId: 'conv1', workspaceId: 'ws', source: 'automation' })
    expect(task.title).toContain('#000abc')
    expect(m.adminsInApp).toHaveBeenCalledWith(['admin1'], expect.objectContaining({ kind: 'booking:partner-unavailable', conversationId: 'conv1' }))
  })
  it('una vez por reserva y tipo: repetirlo no vuelve a avisar a todos', async () => {
    m.prisma.bookingEvent.findFirst.mockResolvedValue({ id: 'e1' })
    expect(await handlePartnerUnavailable({ bookingId: booking.id, kind: 'cannot', partnerName: 'Darwin', now })).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.adminsInApp).not.toHaveBeenCalled()
  })
  it('reservas ya canceladas o terminadas no disparan nada', async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...booking, status: 'COMPLETED' })
    expect(await handlePartnerUnavailable({ bookingId: booking.id, kind: 'late', partnerName: 'Darwin', now })).toBe(false)
    expect(m.prisma.bookingEvent.create).not.toHaveBeenCalled()
  })
  it('sin chat abierto el cliente lo recibe por la app (y el equipo igual)', async () => {
    m.openClientChat.mockResolvedValue(null)
    m.prisma.conversation.findUnique.mockResolvedValue({ id: 'conv1', workspaceId: 'ws' })
    expect(await handlePartnerUnavailable({ bookingId: booking.id, kind: 'other_city', partnerName: 'Darwin', now })).toBe(true)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Tu socio no podrá ir' }))
    expect(m.prisma.conversationTask.create).toHaveBeenCalled()
  })
})
