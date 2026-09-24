import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { loadPostDetail, mediaFolder, reopenReviewIfNeeded } from '@/lib/marketing/service'
import { validateUploadedMedia } from '@/lib/marketing/input'
import { ImageError, setMediaBranding } from '@/lib/marketing/images'

type Ctx = { params: Promise<{ id: string }> }

async function editable(id: string) {
  const auth = await marketingAuth()
  if (!auth.ok) return { error: auth.response }
  const post = await prisma.marketingPost.findUnique({ where: { id }, select: { id: true, workspaceId: true, status: true } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return { error: NextResponse.json({ error: 'No encontrada' }, { status: 404 }) }
  if (post.status === 'publishing') return { error: NextResponse.json({ error: 'No se puede cambiar la media mientras se publica' }, { status: 409 }) }
  // What a publisher approved is what goes out: a change by someone who cannot publish reopens the review
  await reopenReviewIfNeeded(id, mkCan(auth.access, post.workspaceId, 'marketing.publish'))
  return { post }
}

/** Records a file the browser uploaded to Cloudinary (after checking it is ours and in this post's folder). */
export async function POST(request: NextRequest, context: Ctx) {
  const { id } = await context.params
  const r = await editable(id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  try {
    const cloud = cloudinaryService.cloudName()
    if (!cloud) return NextResponse.json({ error: 'Cloudinary no está configurado' }, { status: 500 })
    const m = validateUploadedMedia(body, cloud, mediaFolder(r.post.workspaceId, id))
    const count = await prisma.marketingMedia.count({ where: { postId: id } })
    if (count >= 10) return NextResponse.json({ error: 'Máximo 10 archivos por publicación' }, { status: 400 })
    const created = await prisma.marketingMedia.create({ data: { ...m, postId: id, position: count, originalUrl: m.url } })
    // Brand kit set to "always": the logo goes on every new image
    if (m.kind === 'image' && body.brand !== false) {
      const kit = await prisma.marketingBrandKit.findUnique({ where: { workspaceId: r.post.workspaceId }, select: { autoApply: true, logoPublicId: true } })
      if (kit?.autoApply && kit.logoPublicId) await setMediaBranding(r.post.workspaceId, created.id, true).catch(() => null)
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Archivo inválido' }, { status: 400 })
  }
  return NextResponse.json({ post: await loadPostDetail(id) })
}

/** Reorder ({ order: [ids] }) or edit alt text ({ mediaId, alt }). */
export async function PATCH(request: NextRequest, context: Ctx) {
  const { id } = await context.params
  const r = await editable(id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  if (Array.isArray(body.order)) {
    const ids = body.order.filter((x: unknown): x is string => typeof x === 'string')
    await prisma.$transaction(ids.map((mediaId: string, position: number) => prisma.marketingMedia.updateMany({ where: { id: mediaId, postId: id }, data: { position } })))
  }
  if (typeof body.mediaId === 'string' && typeof body.brand === 'boolean') {
    const m = await prisma.marketingMedia.findFirst({ where: { id: body.mediaId, postId: id }, select: { id: true } })
    if (!m) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    try {
      await setMediaBranding(r.post.workspaceId, m.id, body.brand)
    } catch (err) {
      return NextResponse.json({ error: err instanceof ImageError ? err.message : 'No se pudo cambiar el logo' }, { status: 400 })
    }
  }
  if (typeof body.mediaId === 'string' && typeof body.alt === 'string') {
    await prisma.marketingMedia.updateMany({ where: { id: body.mediaId, postId: id }, data: { alt: body.alt.trim().slice(0, 200) || null } })
  }
  return NextResponse.json({ post: await loadPostDetail(id) })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const { id } = await context.params
  const r = await editable(id)
  if ('error' in r) return r.error
  const mediaId = request.nextUrl.searchParams.get('mediaId') || ''
  const media = await prisma.marketingMedia.findFirst({ where: { id: mediaId, postId: id } })
  if (!media) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  await prisma.marketingMedia.delete({ where: { id: media.id } })
  // Variants that picked this file stop referencing it
  const variants = await prisma.marketingPostVariant.findMany({ where: { postId: id, mediaIds: { has: media.id } } })
  for (const v of variants) await prisma.marketingPostVariant.update({ where: { id: v.id }, data: { mediaIds: v.mediaIds.filter((x) => x !== media.id) } })
  // The Cloudinary file is only removed if nothing ever went out or is queued with it
  const used = await prisma.marketingPublication.count({ where: { postId: id, status: { not: 'cancelled' } } })
  if (!used && media.publicId && media.kind === 'image') await cloudinaryService.delete(media.publicId).catch(() => null)
  return NextResponse.json({ post: await loadPostDetail(id) })
}
