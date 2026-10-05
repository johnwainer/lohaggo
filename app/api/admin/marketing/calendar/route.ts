import { NextRequest, NextResponse } from 'next/server'
import { channelLines } from '@/lib/marketing/format-display'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, mkWorkspacesWith } from '@/lib/marketing/permissions'
import { bogota } from '@/lib/marketing/agent-core'
import { fitsAgentSchedule } from '@/lib/marketing/ops'

export const dynamic = 'force-dynamic'

/**
 * Posts in [from, to] on the day each channel goes out: the agent gives each channel its own day, so a
 * post appears once per day it has sends (its channels of that day), or once on its planned date if it
 * has none yet. Plus the agents' open ideas.
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
      id: true, title: true, status: true, scheduledAt: true, publishedAt: true, origin: true, agentMeta: true, reviewStatus: true, reviewScore: true,
      campaign: { select: { id: true, name: true, color: true } },
      variants: { select: { channel: true, format: true, mediaIds: true, linkUrl: true } },
      media: { select: { id: true, url: true, kind: true }, orderBy: { position: 'asc' } },
      publications: { where: { status: { not: 'cancelled' } }, select: { id: true, channel: true, status: true, scheduledAt: true, publishedAt: true, createdAt: true, lastError: true, connection: { select: { name: true } } } },
    },
    take: 500,
  })
  const items = posts.flatMap(({ agentMeta, publications, variants: vs, media: allMedia, ...raw }) => {
    // Format of each network's version (Reel, Historia, Carrusel…), shown on the card
    const formats = Object.fromEntries(channelLines(vs, allMedia, []).map((l) => [l.channel, l.format]))
    const p = { ...raw, variants: vs.map((v) => ({ channel: v.channel })), media: allMedia.slice(0, 1).map((m) => ({ url: m.url, kind: m.kind })), formats }
    // Why the agent chose this time, per channel (shown on the card)
    const slots = ((agentMeta as { slots?: Array<{ channel: string; reason: string }> } | null)?.slots ?? []).map((s) => ({ channel: s.channel, reason: s.reason }))
    if (!publications.length) {
      const at = p.publishedAt ?? p.scheduledAt
      return at ? [{ ...p, key: p.id, at, publications, slots }] : []
    }
    const byDay = new Map<string, typeof publications>()
    for (const x of publications) {
      const k = bogota(x.publishedAt ?? x.scheduledAt).key
      byDay.set(k, [...(byDay.get(k) ?? []), x])
    }
    return Array.from(byDay.entries()).map(([day, pubs]) => {
      // The card's time is what a drag moves: the queued sends when there are any (a published one keeps its hour)
      const queued = pubs.filter((x) => x.status === 'scheduled')
      const at = (queued.length ? queued.map((x) => x.scheduledAt) : pubs.map((x) => x.publishedAt ?? x.scheduledAt)).sort((a, b) => a.getTime() - b.getTime())[0]
      return { ...p, key: `${p.id}:${day}`, at, publications: pubs, slots: slots.filter((s) => pubs.some((x) => x.channel === s.channel)) }
    }).filter((x) => x.at >= from && x.at <= to)
  })
  // The agent's open ideas: dotted cards on their target day
  const ideas = await prisma.marketingIdea.findMany({
    where: {
      status: { in: ['proposed', 'accepted'] }, targetDate: { gte: from, lte: to },
      agent: { ...(scope ? { workspaceId: { in: scope } } : {}), ...(campaignId ? { campaignId } : {}) },
    },
    select: { id: true, angle: true, pillar: true, channels: true, formats: true, targetDate: true, status: true, agentId: true, agent: { select: { campaign: { select: { color: true, name: true } } } } },
    take: 200,
  })
  return NextResponse.json({ items, ideas })
}

/**
 * Drag & drop in the calendar. A post: its sends of that day (`publicationIds`, or all that are still
 * queued) move by the same number of days, each keeping its hour. A draft without sends: its planned
 * date. An idea of an agent (`ideaId`): its target day. Agents see it at once (their calendar and slots
 * come from these dates) and the post keeps a note that a person moved it.
 */
export async function PATCH(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const when = typeof body.when === 'string' ? new Date(body.when) : null
  if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })

  if (typeof body.ideaId === 'string') {
    const idea = await prisma.marketingIdea.findUnique({ where: { id: body.ideaId }, select: { id: true, status: true, targetDate: true, agent: { select: { workspaceId: true, campaign: { select: { endsAt: true } } } } } })
    if (!idea || !mkCan(auth.access, idea.agent.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'Idea no encontrada' }, { status: 404 })
    if (!['proposed', 'accepted'].includes(idea.status)) return NextResponse.json({ error: 'Esa idea ya se redactó o se descartó: mueve la publicación' }, { status: 409 })
    const day = bogota(when).key
    if (day < bogota(new Date()).key) return NextResponse.json({ error: 'Solo se puede mover a hoy o después' }, { status: 400 })
    const target = new Date(`${day}T12:00:00-05:00`)
    if (idea.agent.campaign.endsAt && target > idea.agent.campaign.endsAt) return NextResponse.json({ error: 'Esa fecha es después del fin de la campaña' }, { status: 400 })
    await prisma.marketingIdea.update({ where: { id: idea.id }, data: { targetDate: target } })
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_IDEA_MOVE', entityType: 'MarketingIdea', entityId: idea.id, details: `${idea.targetDate.toISOString()} → ${target.toISOString()}`, request })
    return NextResponse.json({ ok: true })
  }

  const post = typeof body.postId === 'string' ? await prisma.marketingPost.findUnique({ where: { id: body.postId }, select: { id: true, workspaceId: true, status: true, agentId: true, agentMeta: true, features: true, optOutDeadline: true, agent: { select: { config: true, optOutHours: true } } } }) : null
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (['published', 'publishing', 'archived'].includes(post.status)) return NextResponse.json({ error: 'Ya se publicó: no se puede mover' }, { status: 409 })
  const ids = Array.isArray(body.publicationIds) ? body.publicationIds.filter((x: unknown): x is string => typeof x === 'string') : null
  const queued = await prisma.marketingPublication.findMany({ where: { postId: post.id, status: 'scheduled', ...(ids?.length ? { id: { in: ids } } : {}) }, select: { id: true, channel: true, scheduledAt: true } })
  let warning: string | null = null
  if (queued.length) {
    if (!mkCan(auth.access, post.workspaceId, 'marketing.publish')) return NextResponse.json({ error: 'Mover algo programado requiere permiso de publicar' }, { status: 403 })
    const first = Math.min(...queued.map((q) => q.scheduledAt.getTime()))
    const delta = when.getTime() - first
    if (first + delta <= Date.now() + 60_000) return NextResponse.json({ error: 'Solo se puede mover a una fecha futura' }, { status: 400 })
    await prisma.$transaction(queued.map((q) => prisma.marketingPublication.update({ where: { id: q.id }, data: { scheduledAt: new Date(q.scheduledAt.getTime() + delta) } })))
    const all = await prisma.marketingPublication.findMany({ where: { postId: post.id, status: 'scheduled' }, select: { channel: true, scheduledAt: true } })
    const earliest = new Date(Math.min(...all.map((q) => q.scheduledAt.getTime())))
    const data: Record<string, unknown> = { scheduledAt: earliest }
    if (post.agentId && post.agent) {
      // The agent learns from the real hour and weekday, keeps its opt-out window, and knows a person chose it
      const b = bogota(earliest)
      const moved = queued.map((q) => q.channel)
      const meta = (post.agentMeta as Record<string, unknown> | null) ?? {}
      const slots = ((meta.slots as Array<{ channel: string; at: string; reason: string; kind: string }> | undefined) ?? [])
        .map((s) => (moved.includes(s.channel as never) ? { ...s, at: all.find((a) => a.channel === s.channel)?.scheduledAt.toISOString() ?? s.at, reason: `Movida a mano por ${auth.admin.email}`, kind: 'person' } : s))
      data.agentMeta = { ...meta, slots, movedByPerson: { at: new Date().toISOString(), by: auth.admin.email, channels: moved } }
      data.features = { ...((post.features as Record<string, unknown> | null) ?? {}), weekday: b.weekday, hour: b.hour }
      if (post.optOutDeadline) data.optOutDeadline = new Date(Math.max(Date.now() + 5 * 60_000, earliest.getTime() - post.agent.optOutHours * 3600_000))
      const fit = fitsAgentSchedule({ config: post.agent.config } as never, new Date(first + delta))
      if (!fit.ok) warning = `Movida, pero la hora ${fit.reason}`
    }
    await prisma.marketingPost.update({ where: { id: post.id }, data })
  } else {
    if (!['draft', 'review', 'approved'].includes(post.status)) return NextResponse.json({ error: 'No hay nada programado que mover' }, { status: 409 })
    await prisma.marketingPost.update({ where: { id: post.id }, data: { scheduledAt: when } })
  }
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_POST_RESCHEDULE', entityType: 'MarketingPost', entityId: post.id, details: `${when.toISOString()}${queued.length ? ` (${queued.map((q) => q.channel).join(', ')})` : ''}`, request })
  return NextResponse.json({ ok: true, warning })
}
