import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'
import { APP_ORIGIN } from '@/lib/ops/origin'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { createServiceRequest, listClientRequests } from '@/lib/service-requests/ops'
import { webAttribution } from '@/lib/analytics/touches'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    try {
      const serviceRequest = await createServiceRequest(actor, body, APP_ORIGIN, { attribution: webAttribution(req), browserSent: body?.gaTracked === true })
      return NextResponse.json(serviceRequest, { status: 201 })
    } catch (err) {
      return opsErrorResponse(err)
    }
  } catch (error) {
    return handleApiError(error, 'service-requests-create')
  }
}

export async function GET() {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    return NextResponse.json(await listClientRequests(actor.userId))
  } catch (error) {
    return handleApiError(error, 'service-requests-get')
  }
}
