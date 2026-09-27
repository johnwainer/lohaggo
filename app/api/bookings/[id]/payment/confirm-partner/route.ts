import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'
import { confirmPartnerPayment } from '@/lib/payments/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-confirm-partner')

const confirmSchema = z.object({
  method: z.enum(['CASH', 'DIRECT_TRANSFER']),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const validation = confirmSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: validation.error.flatten() }, { status: 400 })
    }

    const payment = await confirmPartnerPayment(actor, id, validation.data, APP_ORIGIN)
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error confirming partner payment', error)
    return NextResponse.json({ error: 'Error al confirmar pago' }, { status: 500 })
  }
}
