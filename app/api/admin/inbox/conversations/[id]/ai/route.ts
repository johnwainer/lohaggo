import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { shouldTakeOverCore } from '@/lib/ai/runtime-core'
import { handleInbound } from '@/lib/ai/autopilot'

export const maxDuration = 60

/** A pending client message older than this can't be answered anyway (24h channel window). */
const PENDING_MAX_AGE_MS = 23 * 60 * 60 * 1000

type RouteContext = { params: Promise<{ id: string }> }

/**
 * intervene: a person takes the conversation (AI off, assigned to me).
 * return: hand it back to the AI (no human owner) — only if an autopilot agent covers this channel/account.
 * pause / resume: automations (AI included) paused on this conversation.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const actor = { actorType: 'user', actorId: admin.id, actorName: admin.name }
  let data: Record<string, unknown> = {}
  const events: Array<{ type: string; detail?: string }> = []

  switch (body.action) {
    case 'intervene':
      data = { aiHandled: false, assignedToId: admin.id, aiTurns: 0 }
      events.push({ type: 'assigned', detail: admin.name })
      break
    case 'return': {
      const agents = await prisma.aiAgent.findMany({ where: { workspaceId: conversation.workspaceId, status: 'active' } })
      // Same rules as the autopilot, minus the ones this action itself resolves (owner, recent human)
      // A specific agent chosen in the inbox wins if it can take this channel/account
      const preferred = typeof body.agentId === 'string' ? body.agentId : conversation.aiAgentId
      const decision = shouldTakeOverCore({ ...conversation, aiAgentId: preferred, assignedToId: null, automationsPaused: false, aiSpam: false, aiHandoffAt: null }, { agents, recentHumanActivity: false })
      if (!decision.take) {
        const why: Record<string, string> = {
          test: 'Es una conversación de prueba',
          thread_elsewhere: 'El hilo está en la bandeja nativa de Meta',
          skip_tag: 'La conversación tiene una etiqueta excluida del piloto automático',
          no_agent: 'Ningún agente con piloto automático atiende este canal',
          account_not_enabled: 'Ningún agente con piloto automático atiende esta cuenta',
        }
        return NextResponse.json({ error: why[decision.reason] || 'No se puede devolver a la IA' }, { status: 409 })
      }
      data = { aiHandled: true, aiAgentId: decision.agent.id, aiAgentName: decision.agent.name, assignedToId: null, automationsPaused: false, aiSpam: false, aiTurns: 0, priority: 'normal', aiHandoffAt: null }
      events.push({ type: 'ai_started', detail: `Devuelta por ${admin.name}` })
      break
    }
    case 'pause':
      data = { automationsPaused: true }
      events.push({ type: 'status', detail: 'Automatizaciones pausadas' })
      break
    case 'resume':
      data = { automationsPaused: false }
      events.push({ type: 'status', detail: 'Automatizaciones reanudadas' })
      break
    default:
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }

  const updated = await prisma.conversation.update({ where: { id }, data, include: { assignedTo: { select: { id: true, name: true, email: true } } } })
  for (const e of events) {
    if (e.type === 'ai_started' && data.aiAgentId) {
      await prisma.conversationEvent.create({ data: { conversationId: id, type: 'ai_started', actorType: 'ai', actorId: String(data.aiAgentId), actorName: String(data.aiAgentName), detail: e.detail } })
    } else {
      await prisma.conversationEvent.create({ data: { conversationId: id, type: e.type, ...actor, detail: e.detail } })
    }
  }
  emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })

  // Handed back while the client is waiting: the agent answers that message now, not only the next one
  if (body.action === 'return') {
    const last = await prisma.conversationMessage.findFirst({ where: { conversationId: id, isInternal: false }, orderBy: { sentAt: 'desc' }, select: { id: true, direction: true } })
    if (last?.direction === 'INBOUND') after(() => handleInbound(id, last.id, { debounceMs: 0, maxAgeMs: PENDING_MAX_AGE_MS }).then(() => undefined))
  }
  return NextResponse.json({ conversation: updated })
}
