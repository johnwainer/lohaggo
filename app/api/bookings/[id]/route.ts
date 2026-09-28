import { NextResponse } from "next/server"
import { z } from 'zod'
import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, ADMIN_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'
import { BOOKING_INCLUDE, assertBookingAccess, transitionBooking } from '@/lib/bookings/ops'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings-id')

const originFor = (actor: Actor) => (actor.role === 'ADMIN' ? ADMIN_ORIGIN : APP_ORIGIN)

const patchSchema = z.object({
  status: z.nativeEnum(BookingStatus, { errorMap: () => ({ message: 'Estado inválido' }) }),
  reason: z.string().max(500).optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { ...BOOKING_INCLUDE, payment: true, events: { orderBy: { createdAt: 'asc' } } },
    })
    if (!booking) throw new OpsError('Reserva no encontrada', 404)
    assertBookingAccess(actor, booking)

    return NextResponse.json(booking)
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error fetching booking:', error)
    return NextResponse.json({ error: "Error al obtener reserva" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })

    const updated = await transitionBooking(actor, id, parsed.data.status, originFor(actor), { reason: parsed.data.reason })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error updating booking:', error)
    return NextResponse.json({ error: "Error al actualizar reserva" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const parsedReason = patchSchema.shape.reason.safeParse(new URL(request.url).searchParams.get('reason') ?? undefined)
    const reason = parsedReason.success ? parsedReason.data?.trim() || undefined : undefined
    await transitionBooking(actor, id, 'CANCELLED', originFor(actor), { reason })
    return NextResponse.json({ message: "Reserva cancelada" })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error cancelling booking:', error)
    return NextResponse.json({ error: "Error al cancelar reserva" }, { status: 500 })
  }
}
