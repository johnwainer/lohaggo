import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'
import { reportClientPayment, undoClientReport } from '@/lib/payments/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-report-client')

const reportSchema = z.object({
  method: z.enum(['CASH', 'DIRECT_TRANSFER']),
  note: z.string().max(500).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const validation = reportSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: validation.error.flatten() }, { status: 400 })
    }

    const payment = await reportClientPayment(actor, id, validation.data, APP_ORIGIN)
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error reporting client payment', error)
    return NextResponse.json({ error: 'Error al reportar pago' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const payment = await undoClientReport(actor, id)
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error un-reporting client payment', error)
    return NextResponse.json({ error: 'Error al des-reportar pago' }, { status: 500 })
  }
}
