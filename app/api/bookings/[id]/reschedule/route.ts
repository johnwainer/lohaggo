import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, ADMIN_ORIGIN, OpsError } from '@/lib/ops/origin'
import { rescheduleBooking } from '@/lib/bookings/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('bookings-reschedule')

const schema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser YYYY-MM-DD'),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe ser HH:mm'),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })

    const result = await rescheduleBooking(
      actor,
      id,
      { scheduledDate: new Date(`${parsed.data.scheduledDate}T00:00:00.000Z`), scheduledTime: parsed.data.scheduledTime },
      actor.role === 'ADMIN' ? ADMIN_ORIGIN : APP_ORIGIN,
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error rescheduling booking:', error)
    return NextResponse.json({ error: 'Error al reprogramar reserva' }, { status: 500 })
  }
}
