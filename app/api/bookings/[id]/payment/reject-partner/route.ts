import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'
import { rejectPartnerPayment } from '@/lib/payments/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-reject-partner')

const rejectSchema = z.object({
  reason: z.string().min(5).max(500),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const validation = rejectSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ error: 'Razón de rechazo inválida', details: validation.error.flatten() }, { status: 400 })
    }

    const payment = await rejectPartnerPayment(actor, id, validation.data.reason, APP_ORIGIN)
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error rejecting partner payment', error)
    return NextResponse.json({ error: 'Error al rechazar pago' }, { status: 500 })
  }
}
