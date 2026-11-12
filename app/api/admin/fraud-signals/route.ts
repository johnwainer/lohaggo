import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const signals = await prisma.fraudSignal.findMany({
    where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    take: 60,
    select: {
      id: true, type: true, severity: true, status: true, score: true, reason: true, createdAt: true, userId: true, partnerId: true,
      user: { select: { id: true, name: true, role: true } },
      partner: { select: { id: true, user: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json({ signals })
}

/** { id, status: 'ACKNOWLEDGED' | 'RESOLVED' } */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = body?.status === 'ACKNOWLEDGED' || body?.status === 'RESOLVED' ? body.status : null
  if (!id || !status) return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 })
  const row = await prisma.fraudSignal.update({
    where: { id },
    data: { status, ...(status === 'RESOLVED' ? { resolvedAt: new Date(), resolvedBy: admin.email } : {}) },
    select: { id: true },
  }).catch(() => null)
  if (!row) return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'fraud-signal.update', entityType: 'FraudSignal', entityId: id, route: '/api/admin/fraud-signals', details: status, request })
  return NextResponse.json({ ok: true })
}
