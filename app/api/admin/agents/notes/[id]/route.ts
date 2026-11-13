import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** A person closes an open note: attended («resolve») or discarded («expire»). Superadmin only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede cerrar notas' }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  const action = body?.action
  if (action !== 'resolve' && action !== 'expire') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  try {
    const res = await prisma.agentNote.updateMany({
      where: { id, status: 'open' },
      data: action === 'resolve' ? { status: 'done', resolvedAt: new Date(), resolvedBy: 'admin' } : { status: 'expired', resolvedAt: new Date(), resolvedBy: 'admin' },
    })
    if (res.count === 0) return NextResponse.json({ error: 'La nota ya no está abierta' }, { status: 409 })
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar la nota (¿falta aplicar el SQL del tablón de notas?)' }, { status: 500 })
  }
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email,
    action: action === 'resolve' ? 'AGENT_NOTE_RESOLVE' : 'AGENT_NOTE_EXPIRE',
    entityType: 'AgentNote', entityId: id, route: `/api/admin/agents/notes/${id}`, request,
  })
  return NextResponse.json({ ok: true })
}
