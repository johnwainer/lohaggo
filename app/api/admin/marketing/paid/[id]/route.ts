import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { parseMetaAdIds } from '@/lib/marketing/ads-core'

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

/**
 * status: "used" (already uploaded to Meta Ads), "ready" (back to pending) or "archived".
 * metaAdIds: the ids of the ads created in Meta from this package (credits chats whose ad id matches).
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const r = await load(request, context)
  if ('response' in r) return r.response
  if (!mkCan(r.auth.access, r.draft.workspaceId, 'marketing.edit')) return forbidden()
  const b = await request.json().catch(() => ({}))
  const status = b.status
  const hasIds = b.metaAdIds !== undefined
  if (status === undefined && !hasIds) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
  if (status !== undefined && !['used', 'ready', 'archived'].includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  if (r.draft.status === 'generating' || (r.draft.status === 'failed' && status !== 'archived')) return NextResponse.json({ error: 'Esta pauta no está lista' }, { status: 409 })
  const data: Prisma.MarketingAdDraftUpdateInput = {}
  if (status !== undefined) Object.assign(data, { status, usedAt: status === 'used' ? new Date() : status === 'ready' ? null : r.draft.usedAt })
  let ids: string[] = []
  if (hasIds) {
    const output = r.draft.output && typeof r.draft.output === 'object' && !Array.isArray(r.draft.output) ? (r.draft.output as Prisma.JsonObject) : null
    if (!output) return NextResponse.json({ error: 'Esta pauta no tiene contenido' }, { status: 409 })
    ids = parseMetaAdIds(b.metaAdIds)
    const taken = ids.length
      ? await prisma.marketingAdDraft.findFirst({ where: { id: { not: r.draft.id }, OR: ids.map((id) => ({ output: { path: ['metaAdIds'], array_contains: [id] } })) }, select: { title: true } })
      : null
    if (taken) return NextResponse.json({ error: `Uno de esos IDs ya está en la pauta «${taken.title}»` }, { status: 409 })
    data.output = { ...output, metaAdIds: ids }
  }
  const draft = await prisma.marketingAdDraft.update({ where: { id: r.draft.id }, data })
  await auditAdminAction({
    actorId: r.auth.admin.id, actorEmail: r.auth.admin.email, action: status !== undefined ? 'MARKETING_AD_DRAFT_STATUS' : 'MARKETING_AD_DRAFT_META_IDS', entityType: 'MarketingAdDraft', entityId: draft.id,
    details: `${draft.title} → ${status !== undefined ? status : `IDs de Meta: ${ids.join(', ') || '—'}`}`.slice(0, 500), request,
  })
  return NextResponse.json({ draft })
}
