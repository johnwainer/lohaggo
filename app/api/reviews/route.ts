import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'
import { leaveReview, reviewsForBooking } from '@/lib/reviews/ops'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'

export const dynamic = 'force-dynamic'

const logger = createLogger('reviews')

function actorOf(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Actor {
  return { userId: user.id, role: user.role, partnerId: user.partnerProfile?.id ?? null, email: user.email }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { bookingId, rating, comment, reviewType } = body ?? {}

    // Legacy field: the side is the caller's role; a mismatch is a client bug, not a way to switch sides
    if (reviewType === 'client' && user.role !== 'CLIENT') return NextResponse.json({ error: 'Solo los clientes pueden calificar socios' }, { status: 403 })
    if (reviewType === 'partner' && user.role !== 'PARTNER') return NextResponse.json({ error: 'Solo los socios pueden calificar clientes' }, { status: 403 })

    const review = await leaveReview(actorOf(user), { bookingId, rating, comment }, APP_ORIGIN)
    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    if (error instanceof OpsError) return NextResponse.json({ error: error.message }, { status: error.status })
    logger.error('Error creating review:', error || undefined)
    return NextResponse.json({ error: "Error al crear calificación" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const bookingId = new URL(request.url).searchParams.get("bookingId")
    if (!bookingId) return NextResponse.json({ error: "bookingId requerido" }, { status: 400 })

    const review = await reviewsForBooking(actorOf(user), bookingId)
    return NextResponse.json(review)
  } catch (error) {
    if (error instanceof OpsError) return NextResponse.json({ error: error.message }, { status: error.status })
    logger.error('Error fetching review:', error || undefined)
    return NextResponse.json({ error: "Error al obtener calificación" }, { status: 500 })
  }
}
