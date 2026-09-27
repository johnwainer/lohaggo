import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { cancelServiceRequest } from '@/lib/service-requests/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('service-requests-cancel')

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    try {
      const result = await cancelServiceRequest(actor, id, APP_ORIGIN)
      return NextResponse.json({ ok: true, cancelledProposals: result.cancelledProposals })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error cancelling service request', error)
    return NextResponse.json({ error: 'Error al cancelar la solicitud' }, { status: 500 })
  }
}
