import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { attachmentLabel } from '@/lib/messaging/attachments'
import { parseAttachment, sendToConversation } from '@/lib/inbox/send'
import { resolveSuggestionOnSend } from '@/lib/ai/copilot'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json()

  const { isInternal, waContentSid, waVariables } = body
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''

  // Optional attachment previously uploaded via /attachments (Cloudinary URL only)
  const attachment = parseAttachment(body.attachment)
  if (body.attachment && !attachment) return NextResponse.json({ error: 'Adjunto inválido' }, { status: 400 })
  if (!message && !attachment) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  // Internal notes: save to DB only, no Twilio
  if (isInternal) {
    const saved = await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        body: message || (attachment ? attachmentLabel(attachment.kind, attachment.mediaName) : ''),
        ...(attachment ? { mediaUrl: attachment.url, mediaType: attachment.mediaType, mediaName: attachment.mediaName } : {}),
        isInternal: true,
        sentById: admin.id,
        senderType: 'HUMAN',
        status: 'SENT',
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ message: saved })
  }

  // Human agents write only after taking the conversation over from the AI
  if (conversation.aiHandled) {
    return NextResponse.json({ error: `${conversation.aiAgentName || 'El agente de IA'} lleva esta conversación. Pulsa "Intervenir" para escribir.` }, { status: 409 })
  }

  const result = await sendToConversation({
    conversation,
    message,
    attachment,
    sender: { type: 'HUMAN', userId: admin.id },
    waTemplate: waContentSid ? { contentSid: String(waContentSid), variables: waVariables || {} } : null,
    visibility: body.visibility === 'private' ? 'private' : 'public',
    replyToCommentId: typeof body.replyToCommentId === 'string' ? body.replyToCommentId : null,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  // Copilot metrics (suggestion used / edited / ignored) and the "no answer" alert is over
  await resolveSuggestionOnSend(id, message, typeof body.suggestionId === 'string' ? body.suggestionId : null, admin.id).catch(() => null)
  return NextResponse.json({ message: result.saved, messages: result.savedList })
}
