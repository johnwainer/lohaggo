export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { ActionError, approveAction, rejectAction, undoAction } from '@/lib/haggo/actions/engine'
import { actionView } from '@/lib/haggo/actions/views'

/** Approve and execute, reject (with an optional reason Haggo learns from) or undo. Superadmin only. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const admin = { id: auth.admin.id, email: auth.admin.email }
  try {
    if (body.op === 'approve') await approveAction(id, admin, { confirm: typeof body.confirm === 'string' ? body.confirm : undefined })
    else if (body.op === 'reject') await rejectAction(id, admin, typeof body.reason === 'string' ? body.reason : null)
    else if (body.op === 'undo') await undoAction(id, admin)
    else return NextResponse.json({ error: 'Operación inválida' }, { status: 400 })
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'No se pudo completar' }, { status: 500 })
  }
  const row = await prisma.haggoAction.findUnique({ where: { id } })
  return NextResponse.json({ action: row ? actionView(row) : null })
}
