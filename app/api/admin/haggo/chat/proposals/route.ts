import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { ChatError, decideProposal } from '@/lib/haggo/chat'

/** «Guardar directiva» / «Descartar» on a card Haggo proposed in the conversation. */
export async function POST(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  if (typeof body.runId !== 'string' || typeof body.proposalId !== 'string' || !['save', 'discard'].includes(body.decision)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  try {
    const proposal = await decideProposal({ runId: body.runId, proposalId: body.proposalId, decision: body.decision, userId: auth.admin.id, email: auth.admin.email, text: body.text })
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: body.decision === 'save' ? 'HAGGO_DIRECTIVE_CREATE' : 'HAGGO_DIRECTIVE_DISCARD', entityType: 'HaggoDirective', entityId: proposal.directiveId ?? body.runId, details: JSON.stringify({ text: proposal.text, from: 'chat' }), request })
    return NextResponse.json({ ok: true, proposal })
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
