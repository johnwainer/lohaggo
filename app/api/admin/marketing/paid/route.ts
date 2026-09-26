import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, mkWorkspacesWith, forbidden } from '@/lib/marketing/permissions'
import { AdError, adBlock, createAdDraft, listAdDrafts } from '@/lib/marketing/ads'
import { sanitizeAdInput } from '@/lib/marketing/ads-core'
import { catalogFor } from '@/lib/marketing/agent-data'
import { defaultAgentConfig } from '@/lib/marketing/agent-input'
import { getImageSettings, providerReady } from '@/lib/marketing/images'

export const dynamic = 'force-dynamic'
/** Writing the package and generating its images can take a couple of minutes */
export const maxDuration = 300

/** The packages, plus what the form needs: catalog services and cities, campaigns, whether AI images are ready. */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (workspaceId && !mkCan(auth.access, workspaceId, 'marketing.view')) return forbidden()
  const scope = workspaceId ? [workspaceId] : mkWorkspacesWith(auth.access, 'marketing.view')
  const [drafts, catalog, campaigns, images] = await Promise.all([
    listAdDrafts(scope),
    catalogFor(defaultAgentConfig()),
    prisma.marketingCampaign.findMany({ where: { ...(scope ? { workspaceId: { in: scope } } : {}), status: { not: 'done' } }, select: { id: true, name: true, workspaceId: true }, orderBy: { createdAt: 'desc' } }),
    getImageSettings().then((s) => providerReady(s)),
  ])
  return NextResponse.json({
    drafts,
    options: { services: catalog.services.map((s) => s.name), cities: catalog.cities, campaigns },
    imagesReady: images.ready, imagesReason: images.reason,
    canEdit: workspaceId ? mkCan(auth.access, workspaceId, 'marketing.edit') : false,
  })
}

export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return forbidden('Necesitas permiso de edición en este workspace')
  const input = sanitizeAdInput(b)
  if (input.campaignId) {
    const c = await prisma.marketingCampaign.findUnique({ where: { id: input.campaignId }, select: { workspaceId: true } })
    if (c?.workspaceId !== workspaceId) return NextResponse.json({ error: 'Campaña inválida' }, { status: 400 })
  }
  const blocked = await adBlock(workspaceId)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 429 })
  try {
    const draft = await createAdDraft(workspaceId, input, auth.admin.id)
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AD_DRAFT_CREATE', entityType: 'MarketingAdDraft', entityId: draft.id, details: `${draft.title} · ${draft.status} · US$${draft.costUsd.toFixed(3)}`.slice(0, 500), request })
    return NextResponse.json({ draft })
  } catch (err) {
    const known = err instanceof AdError
    return NextResponse.json({ error: known ? err.message : 'No se pudo crear la pauta' }, { status: known ? 400 : 500 })
  }
}
