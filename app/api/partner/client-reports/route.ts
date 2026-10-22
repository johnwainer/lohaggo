import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { listClientReportsBy, reportClient } from '@/lib/admin/client-reports'

export const dynamic = 'force-dynamic'

const logger = createLogger('partner-client-reports')

/** The requests and bookings this partner already reported. */
export async function GET() {
  const actor = await currentActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (actor.role !== 'PARTNER') return NextResponse.json({ error: 'Solo socios' }, { status: 403 })
  try {
    return NextResponse.json(await listClientReportsBy(actor.userId))
  } catch (error) {
    logger.error('Error listing client reports', error)
    return NextResponse.json({ error: 'Error al cargar tus reportes' }, { status: 500 })
  }
}

/** Body: { requestId? , bookingId?, reason: NOT_SERIOUS | NO_RESPONSE | CANCELLED_NO_NOTICE | PAY_OUTSIDE | OTHER, details? } */
export async function POST(req: NextRequest) {
  const actor = await currentActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (actor.role !== 'PARTNER') return NextResponse.json({ error: 'Solo socios' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const supportCase = await reportClient(actor, {
      requestId: typeof body?.requestId === 'string' ? body.requestId : null,
      bookingId: typeof body?.bookingId === 'string' ? body.bookingId : null,
      reason: String(body?.reason ?? ''),
      details: typeof body?.details === 'string' ? body.details : null,
    }, APP_ORIGIN)
    return NextResponse.json({ ok: true, id: supportCase.id }, { status: 201 })
  } catch (err) {
    try {
      return opsErrorResponse(err)
    } catch (error) {
      logger.error('Error creating client report', error)
      return NextResponse.json({ error: 'No se pudo enviar el reporte' }, { status: 500 })
    }
  }
}
