import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, mkWorkspacesWith } from '@/lib/marketing/permissions'

export const dynamic = 'force-dynamic'

/**
 * Posts in [from, to]: by the date they go out (publication scheduledAt / publishedAt) or, for drafts,
 * the planned date. One entry per post with its channels and each channel's state.
 */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const sp = request.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId')
  if (workspaceId && !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const from = new Date(sp.get('from') || '')
  const to = new Date(sp.get('to') || '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() - from.getTime() > 100 * 24 * 3600_000) return NextResponse.json({ error: 'Rango inválido' }, { status: 400 })
  const scope = workspaceId ? [workspaceId] : mkWorkspacesWith(auth.access, 'marketing.view')
  const campaignId = sp.get('campaignId')
  const posts = await prisma.marketingPost.findMany({
    where: {
      ...(scope ? { workspaceId: { in: scope } } : {}),
      ...(campaignId ? { campaignId } : {}),
      status: { not: 'archived' },
      OR: [
        { scheduledAt: { gte: from, lte: to } },
        { publishedAt: { gte: from, lte: to } },
        { publications: { some: { status: { not: 'cancelled' }, OR: [{ scheduledAt: { gte: from, lte: to } }, { publishedAt: { gte: from, lte: to } }] } } },
      ],
    },
    select: {
      id: true, title: true, status: true, scheduledAt: true, publishedAt: true, origin: true, agentMeta: true,
      campaign: { select: { id: true, name: true, color: true } },
      variants: { select: { channel: true } },
      media: { select: { url: true, kind: true }, orderBy: { position: 'asc' }, take: 1 },
      publications: { where: { status: { not: 'cancelled' } }, select: { channel: true, status: true, scheduledAt: true, publishedAt: true, connection: { select: { name: true } } } },
    },
    take: 500,
  })
  const items = posts.map(({ agentMeta, ...p }) => {
    const dates = p.publications.map((x) => x.publishedAt ?? x.scheduledAt).filter(Boolean) as Date[]
    const at = dates.sort((a, b) => a.getTime() - b.getTime())[0] ?? p.publishedAt ?? p.scheduledAt
    // Why the agent chose this time, per channel (shown on the card)
    const slots = ((agentMeta as { slots?: Array<{ channel: string; reason: string }> } | null)?.slots ?? []).map((s) => ({ channel: s.channel, reason: s.reason }))
    return { ...p, at, slots }
  }).filter((p) => p.at)
  // The agent's open ideas: dotted cards on their target day
  const ideas = await prisma.marketingIdea.findMany({
    where: {
      status: { in: ['proposed', 'accepted'] }, targetDate: { gte: from, lte: to },
      agent: { ...(scope ? { workspaceId: { in: scope } } : {}), ...(campaignId ? { campaignId } : {}) },
    },
    select: { id: true, angle: true, pillar: true, channels: true, targetDate: true, status: true, agentId: true, agent: { select: { campaign: { select: { color: true, name: true } } } } },
    take: 200,
  })
  return NextResponse.json({ items, ideas })
}

/** Drag & drop in the calendar: move a post (and what is still scheduled of it) to another date. */
export async function PATCH(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const post = typeof body.postId === 'string' ? await prisma.marketingPost.findUnique({ where: { id: body.postId }, select: { id: true, workspaceId: true, status: true } }) : null
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const when = typeof body.when === 'string' ? new Date(body.when) : null
  if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  if (['published', 'partial', 'publishing'].includes(post.status)) return NextResponse.json({ error: 'Ya se publicó: no se puede mover' }, { status: 409 })
  const scheduled = await prisma.marketingPublication.count({ where: { postId: post.id, status: 'scheduled' } })
  if (scheduled) {
    if (!mkCan(auth.access, post.workspaceId, 'marketing.publish')) return NextResponse.json({ error: 'Mover algo programado requiere permiso de publicar' }, { status: 403 })
    if (when.getTime() <= Date.now() + 60_000) return NextResponse.json({ error: 'Solo se puede mover a una fecha futura' }, { status: 400 })
    await prisma.marketingPublication.updateMany({ where: { postId: post.id, status: 'scheduled' }, data: { scheduledAt: when } })
  }
  await prisma.marketingPost.update({ where: { id: post.id }, data: { scheduledAt: when } })
  return NextResponse.json({ ok: true })
}
