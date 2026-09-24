import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { CopilotError, suggestReply } from '@/lib/ai/copilot'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

/**
 * suggest: draft a reply now ("Sugerir respuesta" / "Otra").
 * resolve { suggestionId, status: 'inserted' | 'discarded' }: the person used or dismissed the card.
 * handle: "Lo atiendo yo" — the AI will not take over for the client's current message.
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

  if (body.action === 'suggest') {
    try {
      const last = await prisma.conversationMessage.findFirst({ where: { conversationId: id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { id: true } })
      const suggestion = await suggestReply(id, { trigger: 'manual', messageId: last?.id ?? null })
      return NextResponse.json({ suggestion })
    } catch (err) {
      const message = err instanceof CopilotError ? err.message : 'No se pudo generar la sugerencia'
      return NextResponse.json({ error: message }, { status: err instanceof CopilotError ? 409 : 500 })
    }
  }

  if (body.action === 'resolve') {
    const status = body.status === 'discarded' ? 'discarded' : body.status === 'inserted' ? 'inserted' : null
    if (!status || typeof body.suggestionId !== 'string') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    await prisma.aiSuggestion.updateMany({
      where: { id: body.suggestionId, conversationId: id, status: { in: ['pending', 'inserted'] } },
      data: { status, ...(status === 'discarded' ? { resolvedAt: new Date(), resolvedById: admin.id } : {}) },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'handle') {
    const last = await prisma.conversationMessage.findFirst({ where: { conversationId: id, isInternal: false }, orderBy: { sentAt: 'desc' }, select: { id: true, direction: true } })
    if (!last || last.direction !== 'INBOUND') return NextResponse.json({ ok: true })
    await prisma.conversation.update({ where: { id }, data: { copilotSkipMessageId: last.id } })
    await prisma.conversationEvent.create({ data: { conversationId: id, type: 'copilot_skip', actorType: 'user', actorId: admin.id, actorName: admin.name, detail: 'Lo atiendo yo' } })
    emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
