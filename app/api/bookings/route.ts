import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

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
    const { serviceId, scheduledDate, scheduledTime, address, notes, totalPrice } = body

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
        }
      }
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Error al crear reserva" },
      { status: 500 }
    )
  }
}
