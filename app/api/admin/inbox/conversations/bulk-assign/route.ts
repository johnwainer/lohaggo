import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { drainAgentTasks, handleInbound } from '@/lib/ai/autopilot'
import { AI_ASSIGN_ERRORS, PENDING_MAX_AGE_MS, assignToAi, assignToPerson } from '@/lib/inbox/ai-assign'

export const maxDuration = 60

const MAX_IDS = 500
/** Pending client messages answered right away per request; the rest get answered on their next message. */
const MAX_IMMEDIATE_REPLIES = 15

/**
 * Bulk assignment from the inbox list.
 * { ids, target: { type: 'ai', agentId? } | { type: 'person', userId } | { type: 'none' } }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((x: unknown) => typeof x === 'string'))).slice(0, MAX_IDS) as string[] : []
  const target = body.target || {}
  if (!ids.length) return NextResponse.json({ error: 'Selecciona al menos una conversación' }, { status: 400 })
  if (!['ai', 'person', 'none'].includes(target.type)) return NextResponse.json({ error: 'Destino no válido' }, { status: 400 })

  const access = await getWorkspaceAccess(admin)
  const conversations = (await prisma.conversation.findMany({ where: { id: { in: ids } } })).filter((c) => canView(access, c.workspaceId))
  const actor = { id: admin.id, name: admin.name }

  let personId: string | null = null
  if (target.type === 'person') {
    personId = typeof target.userId === 'string' ? target.userId : null
    const person = personId ? await prisma.user.findFirst({ where: { id: personId, role: 'ADMIN', isActive: true }, select: { id: true } }) : null
    if (!person) return NextResponse.json({ error: 'Persona no válida' }, { status: 400 })
  }

  let done = 0
  const skipped: Record<string, number> = {}
  const pending: Array<{ conversationId: string; messageId: string }> = []

  for (const conversation of conversations) {
    if (target.type === 'ai') {
      const result = await assignToAi(conversation, actor, typeof target.agentId === 'string' ? target.agentId : null)
      if (!result.ok) {
        const label = AI_ASSIGN_ERRORS[result.reason] || result.reason
        skipped[label] = (skipped[label] || 0) + 1
        continue
      }
      if (result.pendingMessageId) pending.push({ conversationId: conversation.id, messageId: result.pendingMessageId })
    } else {
      if (personId && !access.isSuperAdmin) {
        const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: conversation.workspaceId, userId: personId } } })
        if (!member) {
          skipped['La persona no pertenece al workspace de la conversación'] = (skipped['La persona no pertenece al workspace de la conversación'] || 0) + 1
          continue
        }
      }
      await assignToPerson(conversation, actor, personId)
    }
    done++
  }
  const notFound = ids.length - conversations.length
  if (notFound) skipped['No encontradas o sin acceso'] = notFound

  // Answer the most recent waiting clients now; the others are answered when they write again
  const immediate = pending.slice(0, MAX_IMMEDIATE_REPLIES)
  if (immediate.length) {
    after(async () => {
      await Promise.allSettled(immediate.map((p) => handleInbound(p.conversationId, p.messageId, { debounceMs: 0, maxAgeMs: PENDING_MAX_AGE_MS })))
      await drainAgentTasks()
    })
  }

  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: 'INBOX_BULK_ASSIGN', entityType: 'Conversation',
    details: JSON.stringify({ target, requested: ids.length, done, skipped }), request,
  })
  return NextResponse.json({ done, skipped, answering: immediate.length, pendingLater: pending.length - immediate.length })
}
