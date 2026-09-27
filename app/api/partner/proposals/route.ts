import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { proposalCreateSchema } from '@/lib/validation/proposal-schemas'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { createProposal } from '@/lib/proposals/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('partner-proposals')

export async function POST(req: NextRequest) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (actor.role !== 'PARTNER') return NextResponse.json({ error: 'Solo partners pueden crear propuestas' }, { status: 403 })

    const body = await req.json()
    const validation = await validateRequest(proposalCreateSchema, body)
    if (!validation.success) return validation.error
    const { serviceRequestId, price, notes } = validation.data

    try {
      const proposal = await createProposal(actor, { serviceRequestId, price, notes }, APP_ORIGIN)
      return NextResponse.json(proposal, { status: 201 })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error creating proposal:', error || undefined)
    return NextResponse.json({ error: 'Error al crear la propuesta' }, { status: 500 })
  }
}
