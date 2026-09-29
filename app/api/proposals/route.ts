import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { currentActor } from '@/lib/ops/actor'
import { listProposalsForPartner } from '@/lib/proposals/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals')

/** Retired: partners propose through POST /api/partner/proposals (with date and time). */
export async function POST() {
  return NextResponse.json({ error: 'Esta forma de enviar propuestas ya no está disponible. Actualiza la app e inténtalo de nuevo.' }, { status: 410 })
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
