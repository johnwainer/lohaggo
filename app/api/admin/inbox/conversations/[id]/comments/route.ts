import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { hideComment } from '@/lib/ai/comments'
import { isCommentChannel } from '@/lib/ai/comments-core'

type RouteContext = { params: Promise<{ id: string }> }

/** Hide / show a client's comment on Facebook or Instagram: { messageId, hidden }. */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  if (typeof body.messageId !== 'string' || typeof body.hidden !== 'boolean') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  if (!isCommentChannel(conversation.channel)) return NextResponse.json({ error: 'Solo aplica a comentarios' }, { status: 400 })

  const message = await prisma.conversationMessage.findFirst({ where: { id: body.messageId, conversationId: id, direction: 'INBOUND' }, select: { id: true, commentId: true, commentDeletedAt: true } })
  if (!message?.commentId) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 })
  if (message.commentDeletedAt) return NextResponse.json({ error: 'El comentario fue eliminado' }, { status: 409 })

  try {
    await hideComment(conversation, message, body.hidden, { actorType: 'user', actorId: admin.id, actorName: admin.name })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo cambiar el comentario' }, { status: 502 })
  }
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: body.hidden ? 'inbox.comment.hide' : 'inbox.comment.show',
    entityType: 'ConversationMessage', entityId: message.id, route: `/api/admin/inbox/conversations/${id}/comments`, request,
  })
  return NextResponse.json({ ok: true, hidden: body.hidden })
}
