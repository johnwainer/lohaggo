import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { loadPostDetail, reopenReviewIfNeeded, saveVariants, workspaceAccounts } from '@/lib/marketing/service'
import { sanitizePostInput, sanitizeVariantInput } from '@/lib/marketing/input'
import { canEditPost, type PostStatus } from '@/lib/marketing/publisher-core'
import { refreshPostStatus } from '@/lib/marketing/publisher'
import { revalidateLiveArticle } from '@/lib/marketing/blog'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await loadPostDetail(id)
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const [campaigns, accounts] = await Promise.all([
    prisma.marketingCampaign.findMany({ where: { workspaceId: post.workspaceId, status: { not: 'done' } }, select: { id: true, name: true, color: true }, orderBy: { createdAt: 'desc' } }),
    workspaceAccounts(post.workspaceId),
  ])
  return NextResponse.json({
    post, campaigns, accounts,
    permissions: { edit: mkCan(auth.access, post.workspaceId, 'marketing.edit'), publish: mkCan(auth.access, post.workspaceId, 'marketing.publish') },
  })
}

/** Title, brief, campaign, review status and the channel variants (validated and returned fresh). */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const existing = await prisma.marketingPost.findUnique({ where: { id }, select: { workspaceId: true, status: true } })
  if (!existing || !mkCan(auth.access, existing.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (!mkCan(auth.access, existing.workspaceId, 'marketing.edit')) return forbidden()
  if (!canEditPost(existing.status as PostStatus)) return NextResponse.json({ error: 'No se puede editar mientras se publica' }, { status: 409 })
  const body = await request.json().catch(() => ({}))
  try {
    const data = sanitizePostInput(body)
    if (typeof data.campaignId === 'string') {
      const c = await prisma.marketingCampaign.findUnique({ where: { id: data.campaignId }, select: { workspaceId: true } })
      if (c?.workspaceId !== existing.workspaceId) return NextResponse.json({ error: 'Campaña inválida' }, { status: 400 })
    }
    // Approving is publishing-level: a writer sends to review, a publisher approves
    if (data.status === 'approved' && !mkCan(auth.access, existing.workspaceId, 'marketing.publish')) return forbidden('Solo quien puede publicar aprueba')
    if (data.status === 'approved') Object.assign(data, { approvedById: auth.admin.id, approvedAt: new Date() })
    const variants = Array.isArray(body.variants) ? body.variants.map((v: Record<string, unknown>) => sanitizeVariantInput(v)) : []
    if (Array.isArray(body.removeChannels)) {
      const remove = body.removeChannels.filter((c: unknown) => c === 'WEB' || c === 'FACEBOOK' || c === 'INSTAGRAM')
      if (remove.length) await prisma.marketingPostVariant.deleteMany({ where: { postId: id, channel: { in: remove }, webPublishedAt: null } })
    }
    const contentChanged = variants.length > 0 || typeof data.title === 'string' || Array.isArray(body.removeChannels)
    if (Object.keys(data).length) await prisma.marketingPost.update({ where: { id }, data })
    if (variants.length) await saveVariants(id, variants)
    if (contentChanged && !data.status) await reopenReviewIfNeeded(id, mkCan(auth.access, existing.workspaceId, 'marketing.publish'))
    if (data.status === 'archived') await refreshPostStatus(id)
    // A live article shows the edit right away (and the sitemap its new date)
    if (contentChanged) await revalidateLiveArticle(id)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
  return NextResponse.json({ post: await loadPostDetail(id) })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await prisma.marketingPost.findUnique({ where: { id }, include: { publications: { where: { status: 'published' }, select: { id: true } } } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  // Something already went out: keep the record (and its metrics), archive instead
  if (post.publications.length) {
    await prisma.marketingPost.update({ where: { id }, data: { status: 'archived' } })
    await prisma.marketingPublication.updateMany({ where: { postId: id, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Archivada' } })
    return NextResponse.json({ ok: true, archived: true })
  }
  await prisma.marketingPost.delete({ where: { id } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_POST_DELETE', entityType: 'MarketingPost', entityId: id, details: post.title, request })
  return NextResponse.json({ ok: true })
}
