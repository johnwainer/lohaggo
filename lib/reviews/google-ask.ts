/**
 * Invitation to a public Google review. Google's policy: never filter by how happy the customer was, so every
 * client who rated gets the same neutral invitation (good or bad experience). Once per booking, at most one per
 * client every 60 days, and only while the review link is configured (SEO settings).
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN, originColumns } from '@/lib/ops/origin'
import { getSeoSettings } from '@/lib/seo/agent/settings'

const logger = createLogger('google-review-ask')
const DAY = 86_400_000
export const ASK_COOLDOWN_DAYS = 60

/** The Google review link, or null when it is not set up. Cached by getSeoSettings (30 s). */
export async function googleReviewUrl(): Promise<string | null> {
  const c = await getSeoSettings().catch(() => null)
  return c?.googleReviewUrl || null
}

/** A client who rated yesterday (not today: let the thank-you screen do its work first) and has not been asked. */
export async function runGoogleReviewAsk(now = new Date(), limit = 20): Promise<{ sent: number; skipped: string | null }> {
  if (!(await googleReviewUrl())) return { sent: 0, skipped: 'sin enlace de Google configurado' }
  const { waGoogleReviewAsk } = await import('@/lib/messaging/wa-events')
  const rows = await prisma.review.findMany({
    where: { clientToPartnerRating: { not: null }, clientReviewedAt: { gte: new Date(now.getTime() - 72 * 3600_000), lte: new Date(now.getTime() - 20 * 3600_000) } },
    select: { bookingId: true, booking: { select: { id: true, userId: true } } },
    orderBy: { clientReviewedAt: 'asc' },
    take: 100,
  }).catch(() => [])
  let sent = 0
  for (const r of rows) {
    if (sent >= limit) break
    try {
      const events = await prisma.bookingEvent.findMany({
        where: { type: { in: ['google_review_ask', 'google_review_click'] }, OR: [{ bookingId: r.bookingId }, { booking: { userId: r.booking.userId }, createdAt: { gte: new Date(now.getTime() - ASK_COOLDOWN_DAYS * DAY) } }] },
        select: { id: true }, take: 1,
      })
      if (events.length) continue
      await prisma.bookingEvent.create({ data: { bookingId: r.bookingId, type: 'google_review_ask', actorType: 'system', ...originColumns(APP_ORIGIN) } })
      await waGoogleReviewAsk(r.bookingId)
      sent++
    } catch (err) {
      logger.warn('Google review ask failed', { bookingId: r.bookingId, err: err instanceof Error ? err.message : String(err) })
    }
  }
  return { sent, skipped: null }
}
