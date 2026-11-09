import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { LibraryError, addLibraryAsset, findAsset, loadLibrary, reeditPost, setArchived, topPieces } from '@/lib/marketing/library'
import { loadPostDetail, reopenReviewIfNeeded } from '@/lib/marketing/service'
import { markStaleIfChanged } from '@/lib/marketing/editorial'

export const dynamic = 'force-dynamic'

/** Resource library of a workspace (view=assets) or its pieces that worked (view=pieces). */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const sp = request.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId') || ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const canEdit = mkCan(auth.access, workspaceId, 'marketing.edit')
  if (sp.get('view') === 'pieces') return NextResponse.json({ pieces: await topPieces(workspaceId), canEdit })
  const [library, targets] = await Promise.all([
    loadLibrary(workspaceId),
    canEdit ? prisma.marketingPost.findMany({ where: { workspaceId, status: { in: ['draft', 'review'] } }, select: { id: true, title: true, status: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 60 }) : [],
  ])
  return NextResponse.json({ ...library, targets, canEdit })
}

/**
 * use: a library file into a post (same Cloudinary file, source library-<origin>).
 * archive: hide it from the library (or bring it back). reuse: a new draft from a piece that worked.
 */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No tienes permiso para editar en este workspace' }, { status: 403 })
  try {
    if (b.action === 'use') {
      const post = typeof b.postId === 'string' ? await prisma.marketingPost.findFirst({ where: { id: b.postId, workspaceId }, select: { id: true, status: true } }) : null
      if (!post) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
      if (['publishing', 'published', 'partial', 'archived'].includes(post.status)) return NextResponse.json({ error: 'Esa publicación ya no se puede cambiar' }, { status: 409 })
      const asset = typeof b.key === 'string' ? await findAsset(workspaceId, b.key) : null
      if (!asset) return NextResponse.json({ error: 'Recurso no encontrado en la biblioteca' }, { status: 404 })
      await addLibraryAsset({ workspaceId, postId: post.id, asset, brand: b.brand === true, alt: typeof b.alt === 'string' ? b.alt : null })
      await reopenReviewIfNeeded(post.id, mkCan(auth.access, workspaceId, 'marketing.publish'))
      await markStaleIfChanged(post.id)
      return NextResponse.json({ post: await loadPostDetail(post.id) })
    }
    if (b.action === 'archive') {
      if (typeof b.key !== 'string') return NextResponse.json({ error: 'Recurso inválido' }, { status: 400 })
      await setArchived({ workspaceId, key: b.key, archived: b.archived !== false, actorId: auth.admin.id, actorEmail: auth.admin.email })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'reuse') {
      if (typeof b.postId !== 'string') return NextResponse.json({ error: 'Publicación inválida' }, { status: 400 })
      const post = await reeditPost({ workspaceId, postId: b.postId, actorId: auth.admin.id })
      await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_POST_REEDIT', entityType: 'MarketingPost', entityId: post.id, details: JSON.stringify({ from: b.postId }), request })
      return NextResponse.json({ postId: post.id })
    }
  } catch (err) {
    if (err instanceof LibraryError) return NextResponse.json({ error: err.message }, { status: 409 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error con la biblioteca' }, { status: 502 })
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
