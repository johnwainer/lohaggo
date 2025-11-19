import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { notifyBookingStatusChange } from "@/lib/notifications/notificationService"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings-id')

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      where: { id }
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

    if (user.role === "PARTNER") {
      if (!user.partnerProfile) {
        return NextResponse.json(
          { error: "Perfil de socio no encontrado" },
          { status: 403 }
        )
      }
      if (booking.partnerId !== user.partnerProfile.id) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 403 }
        )
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
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

    await notifyBookingStatusChange(id, status)

    return NextResponse.json(updatedBooking)
  } catch (error) {
    logger.error('Error updating booking:', error)
    return NextResponse.json(
      { error: "Error al actualizar reserva" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
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

    if (user.role === "PARTNER") {
      if (!user.partnerProfile) {
        return NextResponse.json(
          { error: "Perfil de socio no encontrado" },
          { status: 403 }
        )
      }
      if (booking.partnerId !== user.partnerProfile.id) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 403 }
        )
      }
    }

    // Notify partner/client about cancellation before deleting the booking
    await notifyBookingStatusChange(id, 'CANCELLED')

    await prisma.booking.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Reserva cancelada" })
  } catch (error) {
    logger.error('Error deleting booking:', error)
    return NextResponse.json(
      { error: "Error al cancelar reserva" },
      { status: 500 }
    )
  }
}
