import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { rejectProposal } from '@/lib/proposals/ops'
import { isProposalReason } from '@/lib/proposals/feedback'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals-id-reject')

/** Body (optional): { reason: one of PROPOSAL_REASONS, detail?: string } — why the client turns it down. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const body = await request.json().catch(() => ({})) as { reason?: unknown; detail?: unknown }
    const feedback = isProposalReason(body?.reason)
      ? { reason: body.reason, detail: typeof body.detail === 'string' ? body.detail.slice(0, 300) : null }
      : null

    try {
      const proposal = await rejectProposal(actor, id, APP_ORIGIN, feedback)
      return NextResponse.json({ message: 'Propuesta rechazada', proposal })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error rejecting proposal:', error || undefined)
    return NextResponse.json({ error: 'Error al rechazar la propuesta' }, { status: 500 })
  }
}
