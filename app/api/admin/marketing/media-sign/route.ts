import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { mediaFolder } from '@/lib/marketing/service'

/** Signature for a direct browser → Cloudinary upload into this post's folder. */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const post = typeof body.postId === 'string' ? await prisma.marketingPost.findUnique({ where: { id: body.postId }, select: { id: true, workspaceId: true } }) : null
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (!cloudinaryService.isEnabled()) return NextResponse.json({ error: 'Cloudinary no está configurado' }, { status: 500 })
  const kind = body.kind === 'video' ? 'video' : 'image'
  return NextResponse.json(cloudinaryService.signDirectUpload(mediaFolder(post.workspaceId, post.id), kind))
}
