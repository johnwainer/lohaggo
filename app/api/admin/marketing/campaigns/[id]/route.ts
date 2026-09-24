import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { sanitizeCampaignInput } from '@/lib/marketing/input'
import { campaignStats } from '@/lib/marketing/stats'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id } })
  if (!campaign || !mkCan(auth.access, campaign.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ campaign, stats: await campaignStats(id) })
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!campaign || !mkCan(auth.access, campaign.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  try {
    const data = sanitizeCampaignInput(await request.json().catch(() => ({})))
    return NextResponse.json({ campaign: await prisma.marketingCampaign.update({ where: { id }, data }) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
}

/** Deleting a campaign keeps its posts (they become "sin campaña"). */
export async function DELETE(_request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!campaign || !mkCan(auth.access, campaign.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await prisma.marketingCampaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
