import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { getDefaultWorkspaceId } from '@/lib/workspaces'
import { withInboxState } from '@/lib/inbox/state'

/**
 * An automatic notice (template, automation, campaign) in the person's conversation. It stays in the thread
 * as a message, but it is not activity to attend: it never reorders the inbox (lastMessageAt / preview untouched),
 * never reopens, and never changes «Por responder».
 *
 * New conversations:
 * - WhatsApp: created CLOSED and flagged automatedOnly (the AI needs the template context when the person
 *   answers; their reply reopens it).
 * - SMS: created the same way (CLOSED, automatedOnly): out of every tab until the person answers, and then
 *   the agent has the notice as context.
 */
export async function recordAutomatedOutbound(p: {
  channel: 'WHATSAPP' | 'SMS'
  contactPhone: string
  userId: string | null
  contactName: string | null
  body: string
  providerMessageId?: string | null
  sentAt?: Date
  /** Bulk senders (campaigns) skip the live event: nothing in the lists changes */
  emit?: boolean
}) {
  const now = p.sentAt ?? new Date()
  const existing = await prisma.conversation.findUnique({
    where: { channel_contactPhone: { channel: p.channel, contactPhone: p.contactPhone } },
    select: { id: true, workspaceId: true, userId: true, contactName: true, customFields: true },
  })

  const conversation = existing
    ? (existing.userId || !p.userId) && (existing.contactName || !p.contactName)
      ? existing
      : await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          ...(existing.userId || !p.userId ? {} : { userId: p.userId }),
          ...(existing.contactName || !p.contactName ? {} : { contactName: p.contactName }),
        },
        select: { id: true, workspaceId: true, userId: true, contactName: true, customFields: true },
      })
    : await prisma.conversation.create({
      data: {
        channel: p.channel,
        workspaceId: await getDefaultWorkspaceId(),
        contactPhone: p.contactPhone,
        contactName: p.contactName,
        userId: p.userId,
        status: 'CLOSED',
        lastMessageAt: now,
        lastMessageBody: p.body.slice(0, 200),
        unreadCount: 0,
        customFields: withInboxState(null, { automatedOnly: true, awaitingReply: false }) as Prisma.InputJsonValue,
      },
      select: { id: true, workspaceId: true, userId: true, contactName: true, customFields: true },
    })

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      body: p.body,
      status: 'SENT',
      senderType: 'AUTOMATION',
      providerMessageId: p.providerMessageId || null,
      sentAt: now,
    },
  })
  // The open thread refreshes; other lists only update in place (the row does not move)
  if (p.emit !== false) emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  return conversation
}
