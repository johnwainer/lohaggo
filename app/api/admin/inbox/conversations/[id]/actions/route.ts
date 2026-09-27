import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { listActions, settleAction } from '@/lib/ai/actions'
import { executeApprovedAction } from '@/lib/ai/platform-tools'
import { TOOL_CATALOG } from '@/lib/ai/tools'
import type { CatalogEntry } from '@/lib/ai/tools'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

const CATALOG = TOOL_CATALOG as Record<string, CatalogEntry | undefined>

function entityHref(entityType: string | null, userId: string | null): string | null {
  switch (entityType) {
    case 'Booking': return '/admin?section=bookings'
    case 'Payment': return '/admin?section=payments'
    case 'ServiceRequest':
    case 'Proposal': return '/admin/service-requests'
    case 'Review':
    case 'PartnerService':
    case 'PartnerBankAccount':
    case 'VerificationDocument':
    case 'PartnerProfile':
    case 'User': return userId ? `/admin/users/${userId}` : null
    default: return null
  }
}

async function load(id: string) {
  const admin = await requireAdmin()
  if (!admin) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const conversation = await prisma.conversation.findUnique({ where: { id }, select: { id: true, workspaceId: true, userId: true } })
  if (!conversation) return { error: NextResponse.json({ error: 'No encontrada' }, { status: 404 }) }
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return { error: NextResponse.json({ error: 'No encontrada' }, { status: 404 }) }
  return { admin, conversation, access }
}

/** What the agent did or wants to do on the person's account in this conversation. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const r = await load(id)
  if ('error' in r) return r.error
  const rows = await listActions(id)
  return NextResponse.json({
    // Writing in the inbox (messages, status) is allowed to anyone who can view the workspace; approving follows the same rule.
    canManage: true,
    actions: rows.map((a) => ({
      id: a.id, tool: a.tool, toolLabel: CATALOG[a.tool]?.label ?? a.tool, agentName: a.agentName, summary: a.summary, result: a.result,
      status: a.status, entityType: a.entityType, entityId: a.entityId, entityHref: entityHref(a.entityType, r.conversation.userId),
      createdAt: a.createdAt, resolvedAt: a.resolvedAt,
    })),
  })
}

/** { action: 'approve' | 'reject', actionId } — copilot: a person settles an action the agent left awaiting approval. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const r = await load(id)
  if ('error' in r) return r.error
  const { admin, conversation } = r
  const body = await request.json().catch(() => ({}))
  const verb = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null
  if (!verb || typeof body.actionId !== 'string') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const action = await prisma.aiAgentAction.findFirst({ where: { id: body.actionId, conversationId: id } })
  if (!action) return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
  if (action.status !== 'awaiting_approval') return NextResponse.json({ error: 'La acción ya no está pendiente de aprobación' }, { status: 409 })

  let ok = true
  let text = 'Acción rechazada.'
  if (verb === 'approve') {
    const done = await executeApprovedAction(action.id, admin.id)
    ok = done.ok
    text = done.text
  } else {
    await settleAction(action.id, { status: 'rejected', resolvedById: admin.id })
  }

  const outcome = verb === 'approve' ? (ok ? 'Aprobada y hecha' : 'Aprobada, pero falló') : 'Rechazada'
  await prisma.conversationEvent.create({
    data: { conversationId: id, type: 'agent_action_review', actorType: 'user', actorId: admin.id, actorName: admin.name, detail: `${outcome}: ${action.summary}`.slice(0, 500) },
  })
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: verb === 'approve' ? 'INBOX_AGENT_ACTION_APPROVE' : 'INBOX_AGENT_ACTION_REJECT',
    entityType: 'AiAgentAction', entityId: action.id, request,
    details: JSON.stringify({ conversacion: id, herramienta: action.tool, resumen: action.summary, resultado: text }).slice(0, 2000),
  })
  emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
  return NextResponse.json({ ok, text })
}
