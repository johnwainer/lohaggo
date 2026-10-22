import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'
import { CLIENT_FOLLOWUP_ACTIONS, PARTNER_FOLLOWUP_ACTIONS, applyFollowup } from '@/lib/bookings/followups'

export const dynamic = 'force-dynamic'

const logger = createLogger('bookings-followup')

const schema = z.object({
  action: z.enum([...CLIENT_FOLLOWUP_ACTIONS, ...PARTNER_FOLLOWUP_ACTIONS]),
  method: z.enum(['CASH', 'DIRECT_TRANSFER']).optional(),
  amount: z.number().int().positive().max(100_000_000).optional(),
  note: z.string().max(300).optional(),
})

/** The client or the partner answers a booking follow-up from the app (el socio no llegó, ya terminó, buscar otro socio…). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (actor.role === 'ADMIN') return NextResponse.json({ error: 'El equipo actúa desde la solicitud en el admin' }, { status: 403 })
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    return NextResponse.json(await applyFollowup(actor, id, parsed.data.action, APP_ORIGIN, { method: parsed.data.method, amount: parsed.data.amount, note: parsed.data.note }))
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error applying booking follow-up:', error)
    return NextResponse.json({ error: 'No pudimos registrar tu respuesta' }, { status: 500 })
  }
}
