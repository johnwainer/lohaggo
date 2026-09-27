import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { AdSpendError, listAdSpend, parseAdSpendInput, recordAdSpend } from '@/lib/marketing/ad-spend'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function load(context: Ctx, perm: 'marketing.view' | 'marketing.edit') {
  const auth = await marketingAuth()
  if (!auth.ok) return { response: auth.response }
  const { id } = await context.params
  const draft = await prisma.marketingAdDraft.findUnique({ where: { id }, select: { id: true, workspaceId: true, campaignId: true, title: true } })
  if (!draft || !mkCan(auth.access, draft.workspaceId, 'marketing.view')) return { response: NextResponse.json({ error: 'No encontrada' }, { status: 404 }) }
  if (perm === 'marketing.edit' && !mkCan(auth.access, draft.workspaceId, 'marketing.edit')) return { response: forbidden() }
  return { auth, draft }
}

/** The package's daily spend, as typed from Ads Manager. */
export async function GET(_request: NextRequest, context: Ctx) {
  const r = await load(context, 'marketing.view')
  if ('response' in r) return r.response
  return NextResponse.json({ spend: await listAdSpend(r.draft.id) })
}

/** { day: 'YYYY-MM-DD', amountCop, adSet?, note? }: the same day and ad set again replaces the amount. */
export async function PUT(request: NextRequest, context: Ctx) {
  const r = await load(context, 'marketing.edit')
  if ('response' in r) return r.response
  const b = await request.json().catch(() => ({}))
  try {
    const input = parseAdSpendInput(b)
    await recordAdSpend({ workspaceId: r.draft.workspaceId, adDraftId: r.draft.id, campaignId: r.draft.campaignId, input, userId: r.auth.admin.id })
    await auditAdminAction({ actorId: r.auth.admin.id, actorEmail: r.auth.admin.email, action: 'MARKETING_AD_SPEND', entityType: 'MarketingAdDraft', entityId: r.draft.id, details: `${input.day} · ${input.adSet || 'toda la pauta'} · $${input.amountCop}`, request })
  } catch (err) {
    if (err instanceof AdSpendError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }
  return NextResponse.json({ spend: await listAdSpend(r.draft.id) })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const r = await load(context, 'marketing.edit')
  if ('response' in r) return r.response
  const spendId = request.nextUrl.searchParams.get('spendId') || ''
  const res = await prisma.marketingAdSpend.deleteMany({ where: { id: spendId, adDraftId: r.draft.id } })
  if (res.count) await auditAdminAction({ actorId: r.auth.admin.id, actorEmail: r.auth.admin.email, action: 'MARKETING_AD_SPEND_DELETE', entityType: 'MarketingAdDraft', entityId: r.draft.id, details: spendId, request })
  return NextResponse.json({ spend: await listAdSpend(r.draft.id) })
}
