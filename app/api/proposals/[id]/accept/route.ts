import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { acceptProposal } from '@/lib/proposals/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals-id-accept')

const bodySchema = z.object({
  scheduledDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)').optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params

    const raw = await request.text()
    const parsed = bodySchema.safeParse(raw ? JSON.parse(raw) : {})
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Datos inválidos' }, { status: 400 })
    const opts = {
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
      scheduledTime: parsed.data.scheduledTime,
    }

    try {
      const booking = await acceptProposal(actor, id, APP_ORIGIN, opts)
      return NextResponse.json({ message: 'Propuesta aceptada exitosamente', booking })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error accepting proposal:', error || undefined)
    return NextResponse.json(
      { error: 'No pudimos aceptar la propuesta. Intenta de nuevo.' },
      { status: 500 },
    )
  }
}
