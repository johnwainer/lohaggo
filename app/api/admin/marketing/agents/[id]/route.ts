import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { sanitizeCampaignInput } from '@/lib/marketing/input'
import { raisesAutonomy, sanitizeAgentConfig, sanitizeAgentSettings } from '@/lib/marketing/agent-input'
import { configOf, pauseAgent, settingsOf } from '@/lib/marketing/agent'
import { activationError } from '@/lib/marketing/ops'
import { agentDetail, agentFor } from '@/lib/marketing/agent-views'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const found = await agentFor(auth.access, (await context.params).id, 'marketing.view')
  if ('response' in found) return found.response
  return NextResponse.json(await agentDetail(found.agent, auth.access))
}

/**
 * Config (wizard steps), autonomy and limits, status and the campaign's own fields. More autonomy,
 * a shorter trial, a bigger budget or a lower confidence bar need publish permission; more autonomy
 * also an explicit confirmation, recorded in the audit log.
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const found = await agentFor(auth.access, (await context.params).id, 'marketing.edit')
  if ('response' in found) return found.response
  const agent = found.agent
  const canPublish = mkCan(auth.access, agent.workspaceId, 'marketing.publish')
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  const audit: string[] = []

  try {
    if (body.config !== undefined) data.config = JSON.parse(JSON.stringify(sanitizeAgentConfig(body.config, configOf(agent))))

    if (body.settings !== undefined) {
      const prev = settingsOf(agent)
      const next = sanitizeAgentSettings(body.settings, prev)
      const raises = raisesAutonomy(prev, next)
      const loosens = raises || next.trialPostsRemaining < prev.trialPostsRemaining || next.monthlyBudgetUsd > prev.monthlyBudgetUsd || next.confidenceThreshold < prev.confidenceThreshold
      if (loosens && !canPublish) return NextResponse.json({ error: 'Más autonomía, menos período de prueba, más presupuesto o menos exigencia de confianza: solo quien puede publicar' }, { status: 403 })
      if (raises && body.confirmAutonomy !== true) return NextResponse.json({ error: 'Confirma que el agente puede publicar sin aprobación de cada pieza', needsConfirmation: true }, { status: 400 })
      Object.assign(data, {
        mode: next.mode, modeByChannel: next.modeByChannel ?? Prisma.DbNull, optOutHours: next.optOutHours, trialPostsRemaining: next.trialPostsRemaining,
        monthlyBudgetUsd: next.monthlyBudgetUsd, confidenceThreshold: next.confidenceThreshold, exploreRatio: next.exploreRatio, horizonDays: next.horizonDays,
        ...(raises ? { autonomyConfirmedAt: new Date(), autonomyConfirmedById: auth.admin.id } : {}),
      })
      if (loosens) audit.push(`ajustes: modo ${prev.mode}→${next.mode}, prueba ${prev.trialPostsRemaining}→${next.trialPostsRemaining}, presupuesto ${prev.monthlyBudgetUsd}→${next.monthlyBudgetUsd}, confianza ${prev.confidenceThreshold}→${next.confidenceThreshold}${next.modeByChannel ? `, por canal ${JSON.stringify(next.modeByChannel)}` : ''}`)
    }

    if (body.campaign && typeof body.campaign === 'object') {
      const c = sanitizeCampaignInput(body.campaign)
      delete c.status
      if (Object.keys(c).length) await prisma.marketingCampaign.update({ where: { id: agent.campaignId }, data: c })
    }

    if (body.status === 'paused' || body.status === 'finished') {
      const cancelled = await pauseAgent(agent.id)
      if (body.status === 'finished') data.status = 'finished'
      audit.push(`${body.status === 'paused' ? 'pausado' : 'terminado'} (${cancelled} piezas sacadas de la cola)`)
    } else if (body.status === 'active') {
      if (!agent.strategyApprovedAt) return NextResponse.json({ error: 'Primero aprueba la estrategia' }, { status: 400 })
      const mode = (data.mode as string | undefined) ?? agent.mode
      if (mode !== 'copilot' && !canPublish) return NextResponse.json({ error: 'Solo quien puede publicar activa un agente que publica solo' }, { status: 403 })
      const blocked = await activationError(agent)
      if (blocked) return NextResponse.json({ error: blocked.startsWith('Ya hay') ? `${blocked}: pausa uno antes` : blocked }, { status: 409 })
      data.status = 'active'
      audit.push('activado')
    }

    if (Object.keys(data).length) await prisma.marketingAgent.update({ where: { id: agent.id }, data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
  if (audit.length) await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_UPDATE', entityType: 'MarketingAgent', entityId: agent.id, details: audit.join(' · '), request })
  const fresh = await agentFor(auth.access, agent.id, 'marketing.view')
  if ('response' in fresh) return fresh.response
  return NextResponse.json(await agentDetail(fresh.agent, auth.access))
}

/** Deletes the agent (its posts stay, as ordinary posts of the campaign); nothing of it stays queued. */
export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const found = await agentFor(auth.access, (await context.params).id, 'marketing.edit')
  if ('response' in found) return found.response
  await pauseAgent(found.agent.id)
  await prisma.marketingAgent.delete({ where: { id: found.agent.id } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_DELETE', entityType: 'MarketingAgent', entityId: found.agent.id, details: found.agent.campaign.name, request })
  return NextResponse.json({ ok: true })
}
