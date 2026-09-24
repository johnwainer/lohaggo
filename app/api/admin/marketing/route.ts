import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { listAccessibleWorkspaces, getWorkspaceAccess } from '@/lib/workspaces'
import { MARKETING_PERMISSION_LABELS, canManageMarketingPermissions, marketingAuth, mkCan, mkWorkspacesWith } from '@/lib/marketing/permissions'
import { workspaceAccounts } from '@/lib/marketing/service'

export const dynamic = 'force-dynamic'

/** Everything the module's home needs: workspaces + permissions, accounts, campaigns and the posts list. */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const scope = mkWorkspacesWith(auth.access, 'marketing.view')
  const sp = request.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId') || null
  if (workspaceId && !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const wsWhere = workspaceId ? { workspaceId } : scope === null ? {} : { workspaceId: { in: scope } }

  const status = sp.get('status')
  const campaignId = sp.get('campaignId')
  const channel = sp.get('channel')
  const q = sp.get('q')?.trim().slice(0, 100)
  const where: Prisma.MarketingPostWhereInput = {
    ...wsWhere,
    ...(status ? { status } : { status: { not: 'archived' } }),
    ...(campaignId ? { campaignId: campaignId === 'none' ? null : campaignId } : {}),
    ...(channel ? { variants: { some: { channel: channel as never } } } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  }

  const access = await getWorkspaceAccess(auth.admin)
  const [workspaces, posts, campaigns, accounts] = await Promise.all([
    listAccessibleWorkspaces(access).catch(() => []),
    prisma.marketingPost.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true, workspaceId: true, title: true, status: true, scheduledAt: true, publishedAt: true, updatedAt: true,
        campaign: { select: { id: true, name: true, color: true } },
        variants: { select: { channel: true } },
        media: { select: { url: true, kind: true }, orderBy: { position: 'asc' }, take: 1 },
        publications: { where: { status: { not: 'cancelled' } }, select: { channel: true, status: true, lastError: true, connection: { select: { name: true } } } },
      },
    }),
    prisma.marketingCampaign.findMany({ where: wsWhere, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: { _count: { select: { posts: true } } } }),
    workspaceAccounts(workspaceId),
  ])

  const visible = workspaces.filter((w) => mkCan(auth.access, w.id, 'marketing.view'))
  return NextResponse.json({
    workspaces: visible.map((w) => ({
      id: w.id, name: w.name,
      permissions: (Object.keys(MARKETING_PERMISSION_LABELS) as Array<keyof typeof MARKETING_PERMISSION_LABELS>).filter((p) => mkCan(auth.access, w.id, p)),
      canManagePermissions: canManageMarketingPermissions(auth.access, w.id),
    })),
    posts,
    campaigns,
    accounts: accounts.filter((a) => scope === null || scope.includes(a.workspaceId)),
  })
}

/** New post (draft). */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No tienes permiso para crear publicaciones aquí' }, { status: 403 })
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : 'Publicación sin título'
  const campaignId = typeof body.campaignId === 'string' && body.campaignId ? body.campaignId : null
  if (campaignId) {
    const c = await prisma.marketingCampaign.findUnique({ where: { id: campaignId }, select: { workspaceId: true } })
    if (c?.workspaceId !== workspaceId) return NextResponse.json({ error: 'Campaña inválida' }, { status: 400 })
  }
  const channels = Array.isArray(body.channels) ? body.channels.filter((c: unknown) => c === 'WEB' || c === 'FACEBOOK' || c === 'INSTAGRAM') : []
  const post = await prisma.marketingPost.create({
    data: {
      workspaceId, title, campaignId, createdById: auth.admin.id,
      brief: typeof body.brief === 'string' ? body.brief.slice(0, 4000) : null,
      scheduledAt: typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt) : null,
      variants: { create: (channels.length ? channels : ['FACEBOOK', 'INSTAGRAM']).map((channel: 'WEB' | 'FACEBOOK' | 'INSTAGRAM') => ({ channel })) },
    },
  })
  return NextResponse.json({ post })
}
