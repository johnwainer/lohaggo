import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { currentActor } from '@/lib/ops/actor'
import { reviewPreview } from '@/lib/proposals/compare'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals-id-reviews')

/**
 * The two latest reviews of the partner behind a proposal, for the client deciding between proposals (shown
 * inline, no new tab). Only the client who owns the request (or an admin) can read it; reviewers appear by
 * first name only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params

    const proposal = await prisma.proposal.findUnique({ where: { id }, select: { partnerId: true, serviceRequest: { select: { userId: true } } } })
    if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    if (actor.role !== 'ADMIN' && proposal.serviceRequest.userId !== actor.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const rows = await prisma.review.findMany({
      where: { clientToPartnerRating: { not: null }, booking: { partnerId: proposal.partnerId } },
      orderBy: { clientReviewedAt: 'desc' },
      take: 4,
      select: {
        clientToPartnerRating: true,
        clientToPartnerComment: true,
        clientReviewedAt: true,
        booking: { select: { user: { select: { name: true } }, service: { select: { name: true } } } },
      },
    })

    return NextResponse.json({
      reviews: reviewPreview(rows.map((r) => ({
        clientToPartnerRating: r.clientToPartnerRating,
        clientToPartnerComment: r.clientToPartnerComment,
        clientReviewedAt: r.clientReviewedAt,
        reviewerName: r.booking.user?.name ?? null,
        serviceName: r.booking.service?.name ?? null,
      }))),
    })
  } catch (error) {
    logger.error('Error reading proposal partner reviews:', error || undefined)
    return NextResponse.json({ error: 'No pudimos cargar las reseñas' }, { status: 500 })
  }
}
