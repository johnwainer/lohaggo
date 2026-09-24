import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { handleInbound } from '@/lib/ai/autopilot'
import { PENDING_MAX_AGE_MS, assignToAi, assignToPerson } from '@/lib/inbox/ai-assign'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

/**
 * intervene: a person takes the conversation (AI off, assigned to me).
 * return: hand it to an AI agent (optional agentId) — only if an autopilot agent covers this channel/account.
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
  const actor = { id: admin.id, name: admin.name }

  if (body.action === 'intervene') {
    return NextResponse.json({ conversation: await assignToPerson(conversation, actor, admin.id) })
  }

  if (body.action === 'return') {
    const result = await assignToAi(conversation, actor, typeof body.agentId === 'string' ? body.agentId : null)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
    // Handed over while the client is waiting: the agent answers that message now, not only the next one
    const pending = result.pendingMessageId
    if (pending) after(() => handleInbound(id, pending, { debounceMs: 0, maxAgeMs: PENDING_MAX_AGE_MS }).then(() => undefined))
    return NextResponse.json({ conversation: result.conversation })
  }

  if (body.action === 'pause' || body.action === 'resume') {
    const paused = body.action === 'pause'
    const updated = await prisma.conversation.update({ where: { id }, data: { automationsPaused: paused }, include: { assignedTo: { select: { id: true, name: true, email: true } } } })
    await prisma.conversationEvent.create({ data: { conversationId: id, type: 'status', actorType: 'user', actorId: admin.id, actorName: admin.name, detail: paused ? 'Automatizaciones pausadas' : 'Automatizaciones reanudadas' } })
    emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ conversation: updated })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
