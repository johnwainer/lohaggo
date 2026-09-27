import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { rejectProposal } from '@/lib/proposals/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals-id-reject')

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params

    try {
      const proposal = await rejectProposal(actor, id, APP_ORIGIN)
      return NextResponse.json({ message: 'Propuesta rechazada', proposal })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error rejecting proposal:', error || undefined)
    return NextResponse.json({ error: 'Error al rechazar la propuesta' }, { status: 500 })
  }
}
