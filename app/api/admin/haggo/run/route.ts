export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { HaggoError, runNow, type RunType } from '@/lib/haggo/runner'

const TYPES: RunType[] = ['cycle', 'daily', 'weekly']

/** «Revisar ahora» / «Generar informe»: runs at once, with the same budget and lock as the schedule. */
export async function POST(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const type = TYPES.includes(body.type) ? (body.type as RunType) : 'cycle'
  try {
    const result = await runNow(type)
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_RUN_NOW', entityType: 'HaggoRun', entityId: type, details: JSON.stringify({ type, status: result.status }), request })
    return NextResponse.json({ ok: result.status !== 'error', ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof HaggoError ? err.message : 'No se pudo ejecutar' }, { status: err instanceof HaggoError ? 409 : 500 })
  }
}
