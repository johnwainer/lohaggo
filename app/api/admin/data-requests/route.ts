import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { DATA_REQUEST_STATUSES } from '@/lib/privacy/data-requests-core'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requests = await prisma.dataRequest.findMany({
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    take: 100,
    select: { id: true, email: true, name: true, type: true, status: true, message: true, dueAt: true, resolvedAt: true, notes: true, createdAt: true, userId: true, user: { select: { id: true, name: true, role: true, isActive: true } } },
  })
  return NextResponse.json({ requests, canAnonymize: admin.isSuperAdmin })
}

/** { id, status?, notes? } */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const status = DATA_REQUEST_STATUSES.find((s) => s === body.status)
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : undefined
  const closing = status === 'RESOLVED' || status === 'REJECTED'
  const row = await prisma.dataRequest.update({
    where: { id },
    data: { ...(status ? { status, ...(closing ? { resolvedAt: new Date(), resolvedBy: admin.email } : { resolvedAt: null, resolvedBy: null }) } : {}), ...(notes !== undefined ? { notes } : {}) },
    select: { id: true, status: true },
  }).catch(() => null)
  if (!row) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'data-request.update', entityType: 'DataRequest', entityId: id, route: '/api/admin/data-requests', details: status ?? 'notes', request })
  return NextResponse.json({ ok: true, request: row })
}
