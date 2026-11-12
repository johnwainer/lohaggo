import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { anonymizeUser } from '@/lib/privacy/anonymize'

export const dynamic = 'force-dynamic'

/**
 * Superadmin: runs the deletion right on the account of a DELETE request (after the team verified the person's
 * identity) and closes the request. Irreversible, so the body must confirm it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo el superadmin puede anonimizar cuentas' }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (body?.confirm !== true) return NextResponse.json({ error: 'Confirma la acción' }, { status: 400 })

  const dr = await prisma.dataRequest.findUnique({ where: { id }, select: { id: true, type: true, userId: true, status: true } })
  if (!dr) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (dr.type !== 'DELETE') return NextResponse.json({ error: 'Solo las solicitudes de eliminación se anonimizan' }, { status: 400 })
  if (!dr.userId) return NextResponse.json({ error: 'No hay una cuenta con ese correo' }, { status: 400 })

  if (dr.status === 'RESOLVED' || dr.status === 'REJECTED') return NextResponse.json({ error: 'Esta solicitud ya fue cerrada; no se puede anonimizar de nuevo' }, { status: 409 })

  const result = await anonymizeUser(dr.userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await prisma.dataRequest.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: admin.email, notes: `Cuenta anonimizada: ${result.addresses} direcciones, ${result.cards} tarjetas y ${result.photos} fotos, ${result.documents} archivos de verificación, ${result.conversations} conversaciones y ${result.bankAccounts} cuentas bancarias depuradas.` },
  })
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: 'data-request.anonymize', entityType: 'User', entityId: dr.userId,
    route: '/api/admin/data-requests/[id]/anonymize', details: `DataRequest ${id}: ${result.addresses} direcciones, ${result.cards} tarjetas, ${result.photos} fotos, ${result.documents} documentos, ${result.conversations} conversaciones, ${result.bankAccounts} cuentas`, request,
  })
  return NextResponse.json({ ...result })
}
