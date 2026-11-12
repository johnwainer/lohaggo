import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { anonymizeUser } from '@/lib/privacy/anonymize'
import { deleteAssets, notesWithPending, pendingFromNotes, storageSummary } from '@/lib/privacy/assets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Superadmin: runs the deletion right on the account of a DELETE request (after the team verified the person's
 * identity) and closes the request. Irreversible, so the body must confirm it. The files at the storage provider are
 * destroyed after the database change; the ones that fail stay listed in the request notes and `{ confirm: true,
 * retryStorage: true }` on the already closed request retries only those.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo el superadmin puede anonimizar cuentas' }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (body?.confirm !== true) return NextResponse.json({ error: 'Confirma la acción' }, { status: 400 })

  const dr = await prisma.dataRequest.findUnique({ where: { id }, select: { id: true, type: true, userId: true, status: true, notes: true } })
  if (!dr) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (dr.type !== 'DELETE') return NextResponse.json({ error: 'Solo las solicitudes de eliminación se anonimizan' }, { status: 400 })
  if (!dr.userId) return NextResponse.json({ error: 'No hay una cuenta con ese correo' }, { status: 400 })

  if (body?.retryStorage === true) {
    const pending = pendingFromNotes(dr.notes)
    if (!pending.length) return NextResponse.json({ error: 'No hay archivos pendientes de borrar en esta solicitud' }, { status: 409 })
    const r = await deleteAssets(pending)
    await prisma.dataRequest.update({ where: { id }, data: { notes: notesWithPending(dr.notes, r.pending) } })
    await auditAdminAction({
      actorId: admin.id, actorEmail: admin.email, action: 'data-request.storage-retry', entityType: 'User', entityId: dr.userId,
      route: '/api/admin/data-requests/[id]/anonymize', details: `DataRequest ${id}: reintento de archivos, ${storageSummary(r)}`, request,
    })
    return NextResponse.json({ ok: true, storage: { deleted: r.deleted, notFound: r.notFound, failed: r.failed, pending: r.pending.length, errors: r.errors.slice(0, 5) } })
  }

  if (dr.status === 'RESOLVED' || dr.status === 'REJECTED') return NextResponse.json({ error: 'Esta solicitud ya fue cerrada; no se puede anonimizar de nuevo' }, { status: 409 })

  const result = await anonymizeUser(dr.userId, {
    // Saved before the database change empties the URLs: if the process dies mid-way the list is not lost
    onAssetsCollected: async (refs) => { await prisma.dataRequest.update({ where: { id }, data: { notes: notesWithPending(dr.notes, refs) } }) },
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const done = `Cuenta anonimizada: ${result.addresses} direcciones, ${result.cards} tarjetas y ${result.photos} fotos, ${result.documents} archivos de verificación, ${result.conversations} conversaciones y ${result.bankAccounts} cuentas bancarias depuradas; ${storageSummary(result.storage)}.`
  await prisma.dataRequest.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: admin.email, notes: notesWithPending(done, result.storage.pending) },
  })
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: 'data-request.anonymize', entityType: 'User', entityId: dr.userId,
    route: '/api/admin/data-requests/[id]/anonymize',
    details: `DataRequest ${id}: ${result.addresses} direcciones, ${result.cards} tarjetas, ${result.photos} fotos, ${result.documents} documentos, ${result.conversations} conversaciones, ${result.bankAccounts} cuentas; almacenamiento: ${result.storage.deleted} borrados, ${result.storage.notFound} ya no existían, ${result.storage.failed} fallidos de ${result.storage.total}`,
    request,
  })
  return NextResponse.json({ ...result, storage: { ...result.storage, pending: result.storage.pending.length, errors: result.storage.errors.slice(0, 5) } })
}
