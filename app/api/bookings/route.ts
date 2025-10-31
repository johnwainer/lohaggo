import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createNotification } from "@/lib/notifications/notificationService"

export const dynamic = 'force-dynamic'

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
    const status = searchParams.get("status")

    const where: any = {}

    if (user.role === "CLIENT") {
      where.userId = user.id
    } else if (user.role === "PARTNER") {
      const partnerProfile = await prisma.partnerProfile.findUnique({
        where: { userId: user.id }
      })

      if (partnerProfile) {
        where.partnerId = partnerProfile.id
      } else {
        return NextResponse.json([])
      }
    }

    if (status) {
      where.status = status
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
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
        },
        review: {
          select: {
            id: true,
            clientToPartnerRating: true,
            partnerToClientRating: true
          }
        },
        payment: {
          select: {
            id: true,
            status: true,
            totalAmount: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error("Error fetching bookings:", error)
    return NextResponse.json(
      { error: "Error al obtener reservas" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "Debe iniciar sesión para reservar" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { serviceId, scheduledDate, scheduledTime, address, notes, totalPrice, partnerId } = body

    if (!serviceId || !scheduledDate || !scheduledTime || !address || !totalPrice) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        serviceId,
        partnerId: partnerId || null,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        address,
        notes,
        totalPrice,
        status: "PENDING"
      },
      include: {
        service: true,
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          }
        },
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (booking.partner) {
      await createNotification({
        userId: booking.partner.userId,
        type: "BOOKING_CONFIRMED",
        title: "Nueva reserva pendiente",
        message: `${booking.user.name} ha solicitado el servicio de ${booking.service.name}`,
        data: {
          bookingId: booking.id,
          serviceId: booking.serviceId
        }
      })
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Error al crear reserva" },
      { status: 500 }
    )
  }
}
