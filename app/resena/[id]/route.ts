import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APP_ORIGIN, originColumns } from '@/lib/ops/origin'
import { googleReviewUrl } from '@/lib/reviews/google-ask'

export const dynamic = 'force-dynamic'

/**
 * The link of the review invitation (WhatsApp button, thank-you screen): records the click on the booking and sends the
 * person to the Google review page. Without a configured link it goes to the home page. The id only labels the click.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = await googleReviewUrl()
  if (url && /^[a-z0-9]{10,40}$/i.test(id)) {
    try {
      const b = await prisma.booking.findUnique({ where: { id }, select: { id: true } })
      // One click per booking per hour: a public link must not be a way to fill the table
      const recent = b ? await prisma.bookingEvent.findFirst({ where: { bookingId: b.id, type: 'google_review_click', createdAt: { gte: new Date(Date.now() - 3600_000) } }, select: { id: true } }) : null
      if (b && !recent) await prisma.bookingEvent.create({ data: { bookingId: b.id, type: 'google_review_click', actorType: 'client', ...originColumns(APP_ORIGIN) } })
    } catch { /* the click is only a measure: never blocks the redirect */ }
  }
  return NextResponse.redirect(url ?? new URL('/', request.url), 302)
}
