import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { aiWorkspacesWith, canManageAiPermissions, AI_PERMISSION_LABELS } from '@/lib/ai/permissions'
import { AGENT_CHANNELS, AGENT_COMMENT_CHANNELS, AVATARS, LANGUAGES, resolutionRate, sanitizeAgentInput } from '@/lib/ai/agent-input'
import { CRM_MODULES, TOOL_CATALOG, TOOL_NAMES } from '@/lib/ai/tools'
import { getAiSettings } from '@/lib/ai/settings'
import { assertPublicHttpsUrl } from '@/lib/ai/net'
import { checkWorkspaceBudget, workspaceUsage } from '@/lib/ai/limits'
import { commentChannelOf, commentSettingsOf } from '@/lib/ai/comments-core'

/** Agents the caller can see + everything the screens need (real channel accounts, catalogs, permissions). */
export async function GET() {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const scope = aiWorkspacesWith(auth.access, 'ai.view')
  const wsWhere = scope === null ? {} : { id: { in: scope } }

  const [workspaces, agents, connections, settings] = await Promise.all([
    prisma.workspace.findMany({ where: wsWhere, select: { id: true, name: true, isDefault: true, timezone: true, aiMonthlyCostCapUsd: true, aiMonthlyCallCap: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.aiAgent.findMany({ where: scope === null ? {} : { workspaceId: { in: scope } }, orderBy: { createdAt: 'asc' } }),
    prisma.channelConnection.findMany({ where: scope === null ? {} : { workspaceId: { in: scope } }, select: { id: true, name: true, channel: true, workspaceId: true, enabled: true, externalId: true, commentSettings: true } }),
    getAiSettings(),
  ])

  // Copilot usefulness: what people did with each agent's suggestions, per channel
  const suggestionRows = await prisma.aiSuggestion.groupBy({
    by: ['agentId', 'channel', 'status'],
    where: { agentId: { in: agents.map((a) => a.id) } },
    _count: { _all: true },
  })
  const copilotStats: Record<string, { total: number; used: number; edited: number; discarded: number; ignored: number; byChannel: Record<string, { total: number; useful: number }> }> = {}
  for (const r of suggestionRows) {
    const s = (copilotStats[r.agentId] ??= { total: 0, used: 0, edited: 0, discarded: 0, ignored: 0, byChannel: {} })
    const n = r._count._all
    if (r.status === 'pending' || r.status === 'inserted' || r.status === 'expired') continue
    s.total += n
    if (r.status === 'used' || r.status === 'edited' || r.status === 'discarded' || r.status === 'ignored') s[r.status] += n
    const ch = (s.byChannel[r.channel] ??= { total: 0, useful: 0 })
    ch.total += n
    if (r.status === 'used' || r.status === 'edited') ch.useful += n
  }

  const budgets = await Promise.all(workspaces.map(async (w) => ({ workspaceId: w.id, ...(await workspaceUsage(w.id)), ...(await checkWorkspaceBudget(w.id)) })))

  // Channel accounts per workspace. Twilio numbers are platform-level (default workspace), keyed CHANNEL:default.
  const accounts = workspaces.map((w) => ({
    workspaceId: w.id,
    accounts: [
      ...(w.isDefault ? [{ key: 'WHATSAPP:default', channel: 'WHATSAPP', name: 'WhatsApp (número de Twilio)', enabled: true }, { key: 'SMS:default', channel: 'SMS', name: 'SMS (número de Twilio)', enabled: true }] : []),
      // Keyed by the Meta page / IG id so reconnecting the account keeps the agent's setting
      ...connections.filter((c) => c.workspaceId === w.id).map((c) => ({ key: `${c.channel}:${c.externalId}`, legacyKey: c.id, channel: c.channel, name: c.name, enabled: c.enabled })),
      // The same Page / IG account, for its comments (enabled = comments switched on in Admin → Canales)
      ...connections
        .filter((c) => c.workspaceId === w.id && (c.channel === 'MESSENGER' || c.channel === 'INSTAGRAM'))
        .map((c) => {
          const channel = commentChannelOf(c.channel as 'MESSENGER' | 'INSTAGRAM')
          return { key: `${channel}:${c.externalId}`, channel, name: c.name, enabled: c.enabled && commentSettingsOf(c.commentSettings).enabled }
        }),
    ],
  }))

  return NextResponse.json({
    agents: agents.map((a) => ({ ...a, resolution: resolutionRate(a.conversations, a.handoffs), copilotStats: copilotStats[a.id] ?? null })),
    workspaces: workspaces.map((w) => ({
      ...w,
      permissions: (Object.keys(AI_PERMISSION_LABELS) as Array<keyof typeof AI_PERMISSION_LABELS>).filter((p) => can(auth, w.id, p)),
      canManagePermissions: canManageAiPermissions(auth.access, w.id),
    })),
    accounts,
    budgets,
    catalog: {
      channels: AGENT_CHANNELS,
      commentChannels: AGENT_COMMENT_CHANNELS,
      avatars: AVATARS,
      languages: LANGUAGES,
      tools: TOOL_NAMES.map((n) => ({ name: n, label: TOOL_CATALOG[n].label, description: TOOL_CATALOG[n].description, writes: TOOL_CATALOG[n].writes })),
      crmModules: Object.entries(CRM_MODULES).map(([key, label]) => ({ key, label })),
    },
    platform: { allowAgentModelOverride: settings.allowAgentModelOverride, defaultModel: settings.defaultModel, hasAnthropicKey: Boolean(settings.anthropicKey), hasVoyageKey: Boolean(settings.voyageKey) },
    me: { isSuperAdmin: auth.access.isSuperAdmin },
  })
}

export async function POST(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId || !can(auth, workspaceId, 'ai.edit')) return forbidden()

  const settings = await getAiSettings()
  let data: Record<string, unknown>
  try {
    data = sanitizeAgentInput(body, { allowModel: settings.allowAgentModelOverride })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
  if (typeof data.webhookUrl === 'string') {
    try { await assertPublicHttpsUrl(data.webhookUrl) } catch (err) {
      return NextResponse.json({ error: `Webhook: ${err instanceof Error ? err.message : 'no permitido'}` }, { status: 400 })
    }
  }
  if (!data.name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  // Autopilot is born off (messages and comments): it is switched on explicitly from its tab
  const agent = await prisma.aiAgent.create({
    data: { ...(data as { name: string }), autopilot: false, commentChannels: [], workspaceId, createdByEmail: auth.admin.email },
  })
  if (agent.isDefault) await prisma.aiAgent.updateMany({ where: { workspaceId, id: { not: agent.id } }, data: { isDefault: false } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'AI_AGENT_CREATE', entityType: 'AiAgent', entityId: agent.id, details: agent.name, request })
  return NextResponse.json({ agent })
}
