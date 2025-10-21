import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { notifyBookingStatusChange } from "@/lib/notifications/notificationService"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body

    const booking = await prisma.booking.findUnique({
      where: { id: params.id }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      )
    }

    if (user.role === "CLIENT" && booking.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: { status },
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

    await notifyBookingStatusChange(params.id, status)

    return NextResponse.json(updatedBooking)
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json(
      { error: "Error al actualizar reserva" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      )
    }

    // Solo el cliente o admin pueden cancelar
    if (user.role === "CLIENT" && booking.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    await prisma.booking.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: "Reserva cancelada" })
  } catch (error) {
    console.error("Error deleting booking:", error)
    return NextResponse.json(
      { error: "Error al cancelar reserva" },
      { status: 500 }
    )
  }
}
