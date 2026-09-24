import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { ensureWhatsAppConversation, getContactDetail, updateContact } from '@/lib/inbox/contacts'

type RouteContext = { params: Promise<{ id: string }> }

async function authorized(id: string) {
  const admin = await requireAdmin()
  if (!admin) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const contact = await prisma.contact.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!contact) return { error: NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 }) }
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, contact.workspaceId)) return { error: NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 }) }
  return { admin }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorized(id)
  if ('error' in auth) return auth.error
  return NextResponse.json({ contact: await getContactDetail(id) })
}

/** { name?, phone?, email?, notes?, userId? } — undefined keeps, null/'' clears. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorized(id)
  if ('error' in auth) return auth.error
  const body = await request.json().catch(() => ({}))
  const str = (k: string) => (body[k] === undefined ? undefined : body[k] === null ? null : String(body[k]))
  try {
    const updated = await updateContact(id, { name: str('name'), phone: str('phone'), email: str('email'), notes: str('notes'), userId: str('userId') })
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'INBOX_CONTACT_UPDATE', entityType: 'Contact', entityId: updated.id, details: JSON.stringify(Object.keys(body)), request })
    return NextResponse.json({ contact: await getContactDetail(updated.id) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo guardar' }, { status: 400 })
  }
}

/** { action: 'whatsapp' } → opens (or returns) the WhatsApp conversation for this contact. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorized(id)
  if ('error' in auth) return auth.error
  const body = await request.json().catch(() => ({}))
  if (body.action !== 'whatsapp') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  try {
    const conversation = await ensureWhatsAppConversation(id)
    return NextResponse.json({ conversationId: conversation.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo abrir WhatsApp' }, { status: 400 })
  }
}
