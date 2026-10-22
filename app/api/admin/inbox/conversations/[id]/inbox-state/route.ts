import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { inboxView, patchInboxState, readInboxState, snoozeUntil, type InboxState, type SnoozePreset } from '@/lib/inbox/state'

type RouteContext = { params: Promise<{ id: string }> }

const ACTIONS = ['pin', 'unpin', 'mark-unread', 'mark-read', 'snooze', 'unsnooze'] as const
type Action = (typeof ACTIONS)[number]
const PRESETS: SnoozePreset[] = ['1h', '3h', 'tomorrow']

/**
 * Personal and shared list bookkeeping: pin (per person), mark as unread (per person) and snooze (shared:
 * it leaves «Por responder» until the time passes or the contact writes).
 * { action: 'pin' | 'unpin' | 'mark-unread' | 'mark-read' | 'snooze' | 'unsnooze', until?: '1h' | '3h' | 'tomorrow' }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = body?.action as Action
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id }, select: { id: true, workspaceId: true, customFields: true } })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const state = readInboxState(conversation.customFields)
  const without = (list: string[] | undefined) => (list ?? []).filter((x) => x !== admin.id)
  let patch: Partial<InboxState>
  switch (action) {
    case 'pin': patch = { pinnedBy: [...without(state.pinnedBy), admin.id] }; break
    case 'unpin': patch = { pinnedBy: without(state.pinnedBy) }; break
    case 'mark-unread': patch = { unreadFor: [...without(state.unreadFor), admin.id] }; break
    case 'mark-read': patch = { unreadFor: without(state.unreadFor) }; break
    case 'unsnooze': patch = { snoozedUntil: null, snoozedBy: null }; break
    case 'snooze': {
      const preset = body?.until as SnoozePreset
      if (!PRESETS.includes(preset)) return NextResponse.json({ error: 'Elige 1 hora, 3 horas o mañana' }, { status: 400 })
      patch = { snoozedUntil: snoozeUntil(preset).toISOString(), snoozedBy: admin.id }
      break
    }
  }
  if (!(await patchInboxState(id, patch))) return NextResponse.json({ error: 'No se pudo guardar el cambio' }, { status: 500 })

  const fresh = await prisma.conversation.findUnique({ where: { id }, select: { customFields: true } })
  // Snoozing is shared: the other inboxes update their counters (pins and unread marks are personal)
  if (action === 'snooze' || action === 'unsnooze') emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
  return NextResponse.json({ inbox: inboxView(fresh?.customFields, admin.id) })
}
