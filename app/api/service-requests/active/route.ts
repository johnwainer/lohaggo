import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { listOpenRequestsForPartner } from '@/lib/service-requests/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('service-requests-active')

// GET - Open requests the signed-in partner can bid on
export async function GET() {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!actor.partnerId) return NextResponse.json({ error: 'Solo los socios pueden ver solicitudes activas' }, { status: 403 })

    try {
      return NextResponse.json(await listOpenRequestsForPartner(actor.partnerId))
    } catch (err) {
      return opsErrorResponse(err, (e) => (e.status === 403 ? { requiresVerification: true } : {}))
    }
  } catch (error) {
    logger.error('Error fetching active service requests:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener las solicitudes activas' }, { status: 500 })
  }
}
