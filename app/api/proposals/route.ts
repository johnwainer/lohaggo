import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { proposalSchema, validateRequest } from '@/lib/validation'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { createProposal, listProposalsForPartner } from '@/lib/proposals/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals')

export async function POST(req: NextRequest) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const validation = await validateRequest(proposalSchema, body)
    if (!validation.success) return validation.error
    const { serviceRequestId, price, description } = validation.data

    try {
      const proposal = await createProposal(actor, { serviceRequestId, price, notes: description }, APP_ORIGIN)
      return NextResponse.json(proposal)
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    logger.error('Error creating proposal:', error || undefined)
    return NextResponse.json({ error: 'Error al crear la propuesta' }, { status: 500 })
  }
}

// GET - The signed-in partner's proposals
export async function GET() {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!actor.partnerId) return NextResponse.json({ error: 'Solo los partners pueden ver propuestas' }, { status: 403 })

    return NextResponse.json(await listProposalsForPartner(actor.partnerId))
  } catch (error) {
    logger.error('Error fetching proposals:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener las propuestas' }, { status: 500 })
  }
}
