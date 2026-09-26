import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function load(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return { response: auth.response }
  const { id } = await context.params
  const draft = await prisma.marketingAdDraft.findUnique({ where: { id } })
  if (!draft || !mkCan(auth.access, draft.workspaceId, 'marketing.view')) return { response: NextResponse.json({ error: 'No encontrada' }, { status: 404 }) }
  return { auth, draft }
}

export async function GET(request: NextRequest, context: Ctx) {
  const r = await load(request, context)
  if ('response' in r) return r.response
  return NextResponse.json({ draft: r.draft })
}

/** status: "used" (already uploaded to Meta Ads), "ready" (back to pending) or "archived". */
export async function PATCH(request: NextRequest, context: Ctx) {
  const r = await load(request, context)
  if ('response' in r) return r.response
  if (!mkCan(r.auth.access, r.draft.workspaceId, 'marketing.edit')) return forbidden()
  const b = await request.json().catch(() => ({}))
  const status = b.status
  if (!['used', 'ready', 'archived'].includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  if (r.draft.status === 'generating' || (r.draft.status === 'failed' && status !== 'archived')) return NextResponse.json({ error: 'Esta pauta no está lista' }, { status: 409 })
  const draft = await prisma.marketingAdDraft.update({ where: { id: r.draft.id }, data: { status, usedAt: status === 'used' ? new Date() : status === 'ready' ? null : r.draft.usedAt } })
  await auditAdminAction({ actorId: r.auth.admin.id, actorEmail: r.auth.admin.email, action: 'MARKETING_AD_DRAFT_STATUS', entityType: 'MarketingAdDraft', entityId: draft.id, details: `${draft.title} → ${status}`.slice(0, 500), request })
  return NextResponse.json({ draft })
}
