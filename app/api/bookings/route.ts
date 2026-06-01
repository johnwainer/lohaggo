import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createNotification } from "@/lib/notifications/notificationService"
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { bookingCreateSchema } from '@/lib/validation/booking-schemas'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings')

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
            },
            bankAccounts: {
              where: { isDefault: true },
              select: {
                bankName: true,
                accountType: true,
                accountNumber: true,
                accountHolderName: true,
                holderDocumentNumber: true,
                isDefault: true,
              },
              take: 1,
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
            totalAmount: true,
            confirmationStatus: true,
            clientReportedMethod: true,
            clientReportedAt: true,
            partnerConfirmedMethod: true,
            partnerConfirmedAt: true,
            partnerRejectedAt: true,
            rejectionReason: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(bookings)
  } catch (error) {
    logger.error('Error fetching bookings:', error)
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

    const validation = await validateRequest(bookingCreateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { serviceId, scheduledDate, scheduledTime, address, notes, totalPrice, partnerId, proposalId } = validation.data

    // Si se especifica un partnerId, verificar que tenga documentos aprobados
    if (partnerId) {
      const partner = await prisma.partnerProfile.findUnique({
        where: { id: partnerId },
        select: { id: true, verified: true, isActive: true },
      })

      if (!partner) {
        return NextResponse.json(
          { error: "Socio no encontrado" },
          { status: 404 }
        )
      }

      if (!partner.verified || !partner.isActive) {
        return NextResponse.json(
          { error: "Este socio no tiene la verificación completa para prestar servicios" },
          { status: 403 }
        )
      }
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
    logger.error('Error creating booking:', error)
    return NextResponse.json(
      { error: "Error al crear reserva" },
      { status: 500 }
    )
  }
}
