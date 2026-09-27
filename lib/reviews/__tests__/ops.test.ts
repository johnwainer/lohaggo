import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const state = { booking: null as Record<string, unknown> | null, review: null as Record<string, unknown> | null }
  return {
    state,
    prisma: {
      booking: { findUnique: vi.fn(async () => state.booking) },
      review: {
        findUnique: vi.fn(async () => state.review),
        upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({ id: 'r1', ...create })),
        aggregate: vi.fn(async () => ({ _avg: { clientToPartnerRating: 4.5, partnerToClientRating: 4 }, _count: { clientToPartnerRating: 2, partnerToClientRating: 1 } })),
      },
      partnerProfile: { update: vi.fn(async () => ({})) },
      user: { update: vi.fn(async () => ({})) },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
const notify = vi.hoisted(() => ({ createNotification: vi.fn(async () => ({})), scheduleAutomationsForUser: vi.fn(async () => undefined) }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: notify.createNotification }))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: notify.scheduleAutomationsForUser }))

import { leaveReview, reviewsForBooking } from '@/lib/reviews/ops'
import { APP_ORIGIN, OpsError, chatOrigin, type Actor } from '@/lib/ops/origin'

const client: Actor = { userId: 'u-client', role: 'CLIENT' }
const partner: Actor = { userId: 'u-partner', role: 'PARTNER', partnerId: 'p1' }
const completed = () => ({
  id: 'b1', userId: 'u-client', partnerId: 'p1', status: 'COMPLETED',
  user: { id: 'u-client', name: 'Ana' }, partner: { id: 'p1', userId: 'u-partner', user: { id: 'u-partner', name: 'Luis' } },
})

const failsWith = async (p: Promise<unknown>, status: number) => {
  const err = await p.then(() => null, (e) => e)
  expect(err).toBeInstanceOf(OpsError)
  expect((err as OpsError).status).toBe(status)
  return (err as OpsError).message
}

beforeEach(() => {
  db.state.booking = completed()
  db.state.review = null
  vi.clearAllMocks()
})

describe('leaveReview', () => {
  it('reserva no completada → 400', async () => {
    db.state.booking = { ...completed(), status: 'CONFIRMED' }
    expect(await failsWith(leaveReview(client, { bookingId: 'b1', rating: 5 }, APP_ORIGIN), 400)).toMatch(/completados/)
    expect(db.prisma.review.upsert).not.toHaveBeenCalled()
  })

  it('segundo rating del mismo lado → 400; el otro lado sí puede', async () => {
    db.state.review = { id: 'r1', bookingId: 'b1', clientToPartnerRating: 4 }
    expect(await failsWith(leaveReview(client, { bookingId: 'b1', rating: 5 }, APP_ORIGIN), 400)).toMatch(/Ya has calificado/)
    await expect(leaveReview(partner, { bookingId: 'b1', rating: 5 }, APP_ORIGIN)).resolves.toMatchObject({ partnerToClientRating: 5 })
  })

  it('solo las partes de la reserva califican, cada una a la otra', async () => {
    await failsWith(leaveReview({ userId: 'otro', role: 'CLIENT' }, { bookingId: 'b1', rating: 5 }, APP_ORIGIN), 403)
    await failsWith(leaveReview({ userId: 'otro', role: 'PARTNER' }, { bookingId: 'b1', rating: 5 }, APP_ORIGIN), 403)
    await failsWith(leaveReview(client, { bookingId: 'b1', rating: 9 }, APP_ORIGIN), 400)
  })

  it('el origen chat queda en el create y se recalcula el promedio con aggregate', async () => {
    const origin = chatOrigin({ channel: 'WHATSAPP', conversationId: 'c1', agentId: 'a1', agentName: 'Sofía' })
    await leaveReview(client, { bookingId: 'b1', rating: 5, comment: ' Excelente ' }, origin)
    const call = db.prisma.review.upsert.mock.calls[0][0] as { create: Record<string, unknown>; update: Record<string, unknown> }
    expect(call.create).toMatchObject({ origin: 'chat', originChannel: 'WHATSAPP', originConversationId: 'c1', originAgentId: 'a1', clientToPartnerRating: 5, clientToPartnerComment: 'Excelente' })
    expect(call.update).not.toHaveProperty('origin')
    expect(db.prisma.review.aggregate).toHaveBeenCalledTimes(1)
    expect(db.prisma.partnerProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { rating: 4.5, totalReviews: 2 } }))
  })

  it('notifica RATING_RECEIVED al receptor y dispara REVIEW_RECEIVED', async () => {
    await leaveReview(client, { bookingId: 'b1', rating: 5 }, APP_ORIGIN)
    expect(notify.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-partner', type: 'RATING_RECEIVED' }))
    expect(notify.scheduleAutomationsForUser).toHaveBeenCalledWith('u-partner', 'REVIEW_RECEIVED', { targetRole: 'PARTNER', contextId: 'b1' })

    vi.clearAllMocks()
    await leaveReview(partner, { bookingId: 'b1', rating: 3 }, APP_ORIGIN)
    expect(notify.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-client', type: 'RATING_RECEIVED' }))
    expect(notify.scheduleAutomationsForUser).toHaveBeenCalledWith('u-client', 'REVIEW_RECEIVED', { targetRole: 'CLIENT', contextId: 'b1' })
    expect(db.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { clientRating: 4, clientTotalReviews: 1 } }))
  })
})

describe('reviewsForBooking', () => {
  it('solo las partes (o un admin) ven la reseña', async () => {
    await failsWith(reviewsForBooking({ userId: 'otro', role: 'CLIENT' }, 'b1'), 403)
    await expect(reviewsForBooking(client, 'b1')).resolves.toBeNull()
    await expect(reviewsForBooking({ userId: 'adm', role: 'ADMIN' }, 'b1')).resolves.toBeNull()
    db.state.booking = null
    await failsWith(reviewsForBooking(client, 'nope'), 404)
  })
})
