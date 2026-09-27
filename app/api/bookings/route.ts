import { NextResponse } from "next/server"
import { z } from 'zod'
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications/notificationService"
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { bookingCreateSchema } from '@/lib/validation/booking-schemas'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, originColumns, OpsError } from '@/lib/ops/origin'
import { BOOKING_INCLUDE, addBookingEvent, bookingsFor } from '@/lib/bookings/ops'
import { BookingStatus, City } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings')

export async function GET(request: Request) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const status = new URL(request.url).searchParams.get("status")
    const statuses = status && (Object.values(BookingStatus) as string[]).includes(status) ? [status as BookingStatus] : undefined

    const bookings = await bookingsFor(actor, { status: statuses })
    return NextResponse.json(bookings)
  } catch (error) {
    logger.error('Error fetching bookings:', error)
    return NextResponse.json({ error: "Error al obtener reservas" }, { status: 500 })
  }
}

const citySchema = z.object({ city: z.nativeEnum(City).optional() })

export async function POST(request: Request) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "Debe iniciar sesión para reservar" }, { status: 401 })

    const body = await request.json()

    const validation = await validateRequest(bookingCreateSchema, body)
    if (!validation.success) return validation.error
    const { serviceId, scheduledDate, scheduledTime, address, notes, totalPrice, partnerId, proposalId } = validation.data
    const bodyCity = citySchema.safeParse(body).data?.city

    const [service, config] = await Promise.all([
      prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, basePrice: true } }),
      prisma.platformConfig.findFirst({ select: { clientCommissionRate: true, partnerCommissionRate: true } }),
    ])
    if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    if (totalPrice < service.basePrice) {
      return NextResponse.json({ error: `El precio no puede ser menor al precio base del servicio ($${service.basePrice.toLocaleString('es-CO')})` }, { status: 400 })
    }

    let partnerCity: City | null = null
    if (partnerId) {
      const partner = await prisma.partnerProfile.findUnique({
        where: { id: partnerId },
        select: { id: true, verified: true, isActive: true, city: true },
      })
      if (!partner) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 })
      if (!partner.verified || !partner.isActive) {
        return NextResponse.json({ error: "Este socio no tiene la verificación completa para prestar servicios" }, { status: 403 })
      }
      partnerCity = partner.city
    }

    const booking = await prisma.booking.create({
      data: {
        userId: actor.userId,
        serviceId,
        partnerId: partnerId || null,
        proposalId: proposalId || null,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        address,
        notes,
        totalPrice,
        ...(bodyCity ?? partnerCity ? { city: (bodyCity ?? partnerCity) as City } : {}),
        clientCommissionRate: config?.clientCommissionRate ?? null,
        partnerCommissionRate: config?.partnerCommissionRate ?? null,
        status: "PENDING",
        ...originColumns(APP_ORIGIN),
      },
      include: BOOKING_INCLUDE,
    })

    await addBookingEvent({ bookingId: booking.id, type: 'status', actor, origin: APP_ORIGIN, toStatus: 'PENDING', detail: 'Reserva creada' })

    if (booking.partner) {
      await createNotification({
        userId: booking.partner.userId,
        type: "BOOKING_CONFIRMED",
        title: "Nueva reserva pendiente",
        message: `${booking.user.name} ha solicitado el servicio de ${booking.service.name}`,
        data: { bookingId: booking.id, serviceId: booking.serviceId },
      })
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error creating booking:', error)
    return NextResponse.json({ error: "Error al crear reserva" }, { status: 500 })
  }
}
