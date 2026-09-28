import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, ADMIN_ORIGIN, OpsError } from '@/lib/ops/origin'
import { addBookingPhotos, listBookingPhotos, BOOKING_PHOTOS_MAX } from '@/lib/bookings/photos'

export const dynamic = 'force-dynamic'

const logger = createLogger('bookings-photos')

const schema = z.object({
  urls: z.array(z.string().url().max(1000)).min(1).max(BOOKING_PHOTOS_MAX),
  kind: z.enum(['before', 'after']),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    return NextResponse.json({ photos: await listBookingPhotos(actor, id) })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error listing booking photos:', error)
    return NextResponse.json({ error: 'Error al cargar las fotos' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })

    const photos = await addBookingPhotos(actor, id, parsed.data, actor.role === 'ADMIN' ? ADMIN_ORIGIN : APP_ORIGIN)
    return NextResponse.json({ photos })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error adding booking photos:', error)
    return NextResponse.json({ error: 'Error al guardar las fotos' }, { status: 500 })
  }
}
