import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { getContactDetail, updateContact } from '@/lib/inbox/contacts'
import { assertLinkableUser } from '@/lib/inbox/link'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'

type RouteContext = { params: Promise<{ id: string }> }

const userSelect = { id: true, name: true, email: true, role: true, image: true, phone: true, excludedFromMarketing: true } as const

/**
 * { userId: string } links the conversation (and its contact, so every channel of the person) to a client or
 * partner account; { userId: null } unlinks it. Admin accounts and phones shared by several accounts are refused.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const conversation = await prisma.conversation.findUnique({ where: { id }, select: { id: true, workspaceId: true, channel: true, contactPhone: true, contactId: true, userId: true } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null
  if (body.userId !== null && !userId) return NextResponse.json({ error: 'Elige una cuenta' }, { status: 400 })

  try {
    const phoneChannel = conversation.channel === 'WHATSAPP' || conversation.channel === 'SMS'
    if (userId) await assertLinkableUser(userId, phoneChannel ? conversation.contactPhone : null)
    if (conversation.contactId) await updateContact(conversation.contactId, { userId })
    else await prisma.conversation.update({ where: { id }, data: { userId } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo vincular' }, { status: 400 })
  }

  const fresh = await prisma.conversation.findUnique({ where: { id }, select: { contactId: true, user: { select: userSelect } } })
  await prisma.conversationEvent.create({
    data: { conversationId: id, type: userId ? 'account_linked' : 'account_unlinked', actorType: 'user', actorId: admin.id, actorName: admin.name, detail: userId ? fresh?.user?.name ?? null : null },
  }).catch(() => null)
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: userId ? 'INBOX_CONVERSATION_LINK' : 'INBOX_CONVERSATION_UNLINK', entityType: 'Conversation', entityId: id,
    details: JSON.stringify({ userId, previousUserId: conversation.userId }), request,
  })
  emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
  return NextResponse.json({ user: fresh?.user ?? null, contact: fresh?.contactId ? await getContactDetail(fresh.contactId) : null })
}
