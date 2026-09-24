import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { PublishValidationError, cancelScheduled, publishNow, schedulePost, type Target } from '@/lib/marketing/publisher'
import { canSchedule } from '@/lib/marketing/publisher-core'
import { loadPostDetail } from '@/lib/marketing/service'
import { unpublishArticle } from '@/lib/marketing/blog'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

/**
 * mode "now": publish on the chosen targets inside this request. "schedule": at `when`.
 * "cancel": drop what is still scheduled. "unpublish": take the web article offline.
 */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await prisma.marketingPost.findUnique({ where: { id }, select: { workspaceId: true, title: true, status: true } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (!mkCan(auth.access, post.workspaceId, 'marketing.publish')) return forbidden('No tienes permiso para publicar')
  const body = await request.json().catch(() => ({}))
  const mode = body.mode
  const targets: Target[] = Array.isArray(body.targets)
    ? body.targets
        .filter((t: Record<string, unknown>) => t && (t.channel === 'WEB' || t.channel === 'FACEBOOK' || t.channel === 'INSTAGRAM'))
        .map((t: Record<string, unknown>) => ({ channel: t.channel, connectionId: t.channel === 'WEB' ? null : typeof t.connectionId === 'string' ? t.connectionId : null }))
    : []

  try {
    if (mode === 'cancel') await cancelScheduled(id)
    else if (mode === 'unpublish') await unpublishArticle(id)
    else if (mode === 'schedule') {
      const when = typeof body.when === 'string' ? new Date(body.when) : null
      if (!when || Number.isNaN(when.getTime()) || !canSchedule(when, new Date())) return NextResponse.json({ error: 'Elige una fecha y hora futuras' }, { status: 400 })
      await schedulePost(id, targets, when)
    } else if (mode === 'now') await publishNow(id, targets)
    else return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err) {
    if (err instanceof PublishValidationError) return NextResponse.json({ error: 'Hay problemas que impiden publicar', issues: err.issues }, { status: 422 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo publicar' }, { status: 500 })
  }
  await auditAdminAction({
    actorId: auth.admin.id, actorEmail: auth.admin.email, action: `MARKETING_${String(mode).toUpperCase()}`, entityType: 'MarketingPost', entityId: id,
    details: `${post.title} → ${targets.map((t) => `${t.channel}${t.connectionId ? `:${t.connectionId}` : ''}`).join(', ')}`, request,
  })
  return NextResponse.json({ post: await loadPostDetail(id) })
}
