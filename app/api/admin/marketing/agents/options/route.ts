import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { workspaceAccounts } from '@/lib/marketing/service'

export const dynamic = 'force-dynamic'

/** What the wizard offers: catalog services, cities, the workspace's accounts, campaigns without agent and published texts as examples. */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const [services, cities, accounts, campaigns, examples] = await Promise.all([
    prisma.service.findMany({ select: { id: true, name: true, basePrice: true, category: { select: { name: true } } }, orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }], take: 200 }),
    prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { name: true }, orderBy: { order: 'asc' } }),
    workspaceAccounts(workspaceId),
    prisma.marketingCampaign.findMany({ where: { workspaceId, agent: null, status: { not: 'done' } }, select: { id: true, name: true, objective: true, description: true, startsAt: true, endsAt: true, color: true }, orderBy: { createdAt: 'desc' } }),
    prisma.marketingPostVariant.findMany({
      where: { channel: { in: ['INSTAGRAM', 'FACEBOOK'] }, post: { workspaceId, status: { in: ['published', 'partial'] } }, body: { not: '' } },
      select: { id: true, channel: true, body: true, post: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ])
  return NextResponse.json({
    services: services.map((s) => ({ id: s.id, name: s.name, category: s.category?.name ?? null, basePrice: s.basePrice })),
    cities: cities.map((c) => c.name),
    accounts,
    campaigns,
    examples: examples.map((e) => ({ id: e.id, channel: e.channel, title: e.post.title, body: e.body.slice(0, 2200) })),
  })
}
