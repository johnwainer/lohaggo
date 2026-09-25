export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { ActionError, approvePlan } from '@/lib/haggo/actions/engine'
import { actionView } from '@/lib/haggo/actions/views'

/** «Aprobar todo el plan»: the pending steps in order, stopping at the first that fails. */
export async function POST(_request: NextRequest, context: { params: Promise<{ planId: string }> }) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const { planId } = await context.params
  if (!/^[\w-]{1,40}$/.test(planId)) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  try {
    const results = await approvePlan(planId, { id: auth.admin.id, email: auth.admin.email })
    return NextResponse.json({ actions: results.filter(Boolean).map((r) => actionView(r!)) })
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'No se pudo completar' }, { status: 500 })
  }
}
