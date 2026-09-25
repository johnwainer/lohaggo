import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, mkWorkspacesWith } from '@/lib/marketing/permissions'
import { sanitizeCampaignInput } from '@/lib/marketing/input'
import { DEFAULT_SETTINGS, defaultAgentConfig, raisesAutonomy, sanitizeAgentConfig, sanitizeAgentSettings } from '@/lib/marketing/agent-input'
import { agentSummary } from '@/lib/marketing/agent-views'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')
  if (workspaceId && !mkCan(auth.access, workspaceId, 'marketing.view')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const scope = workspaceId ? [workspaceId] : mkWorkspacesWith(auth.access, 'marketing.view')
  const agents = await prisma.marketingAgent.findMany({
    where: scope ? { workspaceId: { in: scope } } : {},
    include: { campaign: true },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 50,
  })
  return NextResponse.json({ agents: await Promise.all(agents.map(agentSummary)) })
}

/**
 * New agent (the wizard's first step): on an existing campaign without agent, or creating the
 * campaign. Starts as a draft; supervised/autopilot need publish permission and explicit confirmation.
 */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No tienes permiso para crear agentes aquí' }, { status: 403 })

  const settings = sanitizeAgentSettings(body.settings, DEFAULT_SETTINGS)
  if (raisesAutonomy(DEFAULT_SETTINGS, settings)) {
    if (!mkCan(auth.access, workspaceId, 'marketing.publish')) return NextResponse.json({ error: 'Solo quien puede publicar activa los modos supervisado o piloto automático' }, { status: 403 })
    if (body.confirmAutonomy !== true) return NextResponse.json({ error: 'Confirma que el agente puede publicar sin aprobación de cada pieza' }, { status: 400 })
  }
  // Loosening limits is a publisher's decision: others get the defaults
  if (!mkCan(auth.access, workspaceId, 'marketing.publish')) {
    settings.trialPostsRemaining = Math.max(settings.trialPostsRemaining, DEFAULT_SETTINGS.trialPostsRemaining)
    settings.monthlyBudgetUsd = Math.min(settings.monthlyBudgetUsd, DEFAULT_SETTINGS.monthlyBudgetUsd)
    settings.confidenceThreshold = Math.max(settings.confidenceThreshold, DEFAULT_SETTINGS.confidenceThreshold)
  }

  let campaignId = typeof body.campaignId === 'string' ? body.campaignId : ''
  try {
    if (campaignId) {
      const c = await prisma.marketingCampaign.findUnique({ where: { id: campaignId }, select: { workspaceId: true, agent: { select: { id: true } } } })
      if (c?.workspaceId !== workspaceId) return NextResponse.json({ error: 'Campaña inválida' }, { status: 400 })
      if (c?.agent) return NextResponse.json({ error: 'Esa campaña ya tiene un agente' }, { status: 409 })
    } else {
      const data = sanitizeCampaignInput(body.campaign && typeof body.campaign === 'object' ? body.campaign : {})
      if (!data.name) return NextResponse.json({ error: 'La campaña necesita un nombre' }, { status: 400 })
      const campaign = await prisma.marketingCampaign.create({ data: { ...(data as { name: string }), status: 'active', workspaceId, createdById: auth.admin.id } })
      campaignId = campaign.id
    }
    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: campaignId }, select: { objective: true } })
    const config = sanitizeAgentConfig(body.config, defaultAgentConfig(campaign.objective))
    const agent = await prisma.marketingAgent.create({
      data: {
        workspaceId, campaignId, config: JSON.parse(JSON.stringify(config)), createdById: auth.admin.id,
        mode: settings.mode, modeByChannel: settings.modeByChannel ?? undefined, optOutHours: settings.optOutHours, trialPostsRemaining: settings.trialPostsRemaining,
        monthlyBudgetUsd: settings.monthlyBudgetUsd, confidenceThreshold: settings.confidenceThreshold, exploreRatio: settings.exploreRatio, horizonDays: settings.horizonDays,
        ...(raisesAutonomy(DEFAULT_SETTINGS, settings) ? { autonomyConfirmedAt: new Date(), autonomyConfirmedById: auth.admin.id } : {}),
      },
    })
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_CREATE', entityType: 'MarketingAgent', entityId: agent.id, details: `modo ${settings.mode}`, request })
    return NextResponse.json({ agent: { id: agent.id, campaignId } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
}
