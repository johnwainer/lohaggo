import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createNotification } from "@/lib/notifications/notificationService"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bookingId, rating, comment, reviewType } = body

    if (!bookingId || !rating || !reviewType) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La calificación debe estar entre 1 y 5" },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      )
    }

    if (booking.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Solo puedes calificar servicios completados" },
        { status: 400 }
      )
    }

    if (reviewType === "client" && user.role !== "CLIENT") {
      return NextResponse.json(
        { error: "Solo los clientes pueden calificar socios" },
        { status: 403 }
      )
    }

    if (reviewType === "partner" && user.role !== "PARTNER") {
      return NextResponse.json(
        { error: "Solo los socios pueden calificar clientes" },
        { status: 403 }
      )
    }

    if (reviewType === "client" && booking.userId !== user.id) {
      return NextResponse.json(
        { error: "No puedes calificar esta reserva" },
        { status: 403 }
      )
    }

    if (reviewType === "partner" && booking.partner?.userId !== user.id) {
      return NextResponse.json(
        { error: "No puedes calificar esta reserva" },
        { status: 403 }
      )
    }

    let review = await prisma.review.findUnique({
      where: { bookingId }
    })

    if (reviewType === "client") {
      if (review?.clientToPartnerRating) {
        return NextResponse.json(
          { error: "Ya has calificado este servicio" },
          { status: 400 }
        )
      }

      review = await prisma.review.upsert({
        where: { bookingId },
        create: {
          bookingId,
          clientToPartnerRating: rating,
          clientToPartnerComment: comment,
          clientReviewedAt: new Date()
        },
        update: {
          clientToPartnerRating: rating,
          clientToPartnerComment: comment,
          clientReviewedAt: new Date()
        }
      })

      if (booking.partner) {
        const allPartnerReviews = await prisma.review.findMany({
          where: {
            clientToPartnerRating: { not: null },
            booking: {
              partnerId: booking.partnerId
            }
          }
        })

        const totalRating = allPartnerReviews.reduce((sum, r) => sum + (r.clientToPartnerRating || 0), 0)
        const avgRating = totalRating / allPartnerReviews.length

        await prisma.partnerProfile.update({
          where: { id: booking.partnerId! },
          data: {
            rating: avgRating,
            totalReviews: allPartnerReviews.length
          }
        })

        await createNotification({
          userId: booking.partner.userId,
          type: "BOOKING_COMPLETED",
          title: "Nueva calificación recibida",
          message: `${booking.user.name} te ha calificado con ${rating} estrellas`,
          data: {
            bookingId: booking.id,
            rating
          }
        })
      }
    } else {
      if (review?.partnerToClientRating) {
        return NextResponse.json(
          { error: "Ya has calificado este cliente" },
          { status: 400 }
        )
      }

      review = await prisma.review.upsert({
        where: { bookingId },
        create: {
          bookingId,
          partnerToClientRating: rating,
          partnerToClientComment: comment,
          partnerReviewedAt: new Date()
        },
        update: {
          partnerToClientRating: rating,
          partnerToClientComment: comment,
          partnerReviewedAt: new Date()
        }
      })

      const allClientReviews = await prisma.review.findMany({
        where: {
          partnerToClientRating: { not: null },
          booking: {
            userId: booking.userId
          }
        }
      })

      const totalRating = allClientReviews.reduce((sum, r) => sum + (r.partnerToClientRating || 0), 0)
      const avgRating = totalRating / allClientReviews.length

      await prisma.user.update({
        where: { id: booking.userId },
        data: {
          clientRating: avgRating,
          clientTotalReviews: allClientReviews.length
        }
      })

      await createNotification({
        userId: booking.userId,
        type: "BOOKING_COMPLETED",
        title: "Nueva calificación recibida",
        message: `${booking.partner?.user.name} te ha calificado con ${rating} estrellas`,
        data: {
          bookingId: booking.id,
          rating
        }
      })
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error("Error creating review:", error)
    return NextResponse.json(
      { error: "Error al crear calificación" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get("bookingId")

    if (bookingId) {
      const review = await prisma.review.findUnique({
        where: { bookingId },
        include: {
          booking: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              partner: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      return NextResponse.json(review)
    }

    return NextResponse.json({ error: "bookingId requerido" }, { status: 400 })
  } catch (error) {
    console.error("Error fetching review:", error)
    return NextResponse.json(
      { error: "Error al obtener calificación" },
      { status: 500 }
    )
  }
}
