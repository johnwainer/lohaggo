import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { sendToConversation } from '@/lib/inbox/send'
import { getContactDetail } from '@/lib/inbox/contacts'
import { MAX_PARTNER_SERVICES, accessLinkMessage, createAccessLink, createAccountFromContact } from '@/lib/accounts/from-contact'

type RouteContext = { params: Promise<{ id: string }> }

async function authorize(id: string) {
  const admin = await requireAdmin()
  if (!admin) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const contact = await prisma.contact.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!contact) return { error: NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 }) }
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, contact.workspaceId)) return { error: NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 }) }
  return { admin }
}

/** Options for the "create account" form: cities and services. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await authorize((await context.params).id)
  if ('error' in auth) return auth.error
  const [cities, categories] = await Promise.all([
    prisma.cityConfig.findMany({ where: { status: { in: ['ACTIVE', 'COMING_SOON'] } }, orderBy: { order: 'asc' }, select: { slug: true, name: true, status: true } }),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { name: true, services: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } }),
  ])
  return NextResponse.json({ cities, categories, maxServices: MAX_PARTNER_SERVICES })
}

/**
 * { role, name, email, phone?, citySlug?, serviceIds?, sendToConversationId? } — creates the account.
 * { action: 'resend', sendToConversationId? } — new access link for the linked account.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorize(id)
  if ('error' in auth) return auth.error
  const { admin } = auth
  const body = await request.json().catch(() => ({}))

  let accessUrl: string
  let role: 'CLIENT' | 'PARTNER'
  let name: string

  if (body.action === 'resend') {
    const contact = await prisma.contact.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, role: true } } } })
    if (!contact?.user || (contact.user.role !== 'CLIENT' && contact.user.role !== 'PARTNER')) {
      return NextResponse.json({ error: 'El contacto no tiene una cuenta de cliente o socio' }, { status: 400 })
    }
    role = contact.user.role
    name = contact.user.name
    accessUrl = (await createAccessLink(contact.user.id, role)).url
  } else {
    const result = await createAccountFromContact({
      contactId: id,
      role: body.role === 'PARTNER' ? 'PARTNER' : 'CLIENT',
      name: String(body.name || ''),
      email: String(body.email || ''),
      phone: body.phone ? String(body.phone) : null,
      citySlug: body.citySlug ? String(body.citySlug) : null,
      serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [],
      createdBy: { type: 'user', id: admin.id, name: admin.name },
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'already_linked' || result.code === 'email_taken' ? 409 : 400 })
    role = result.role
    name = String(body.name || '')
    accessUrl = result.accessUrl
    await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'INBOX_ACCOUNT_CREATE', entityType: 'User', entityId: result.userId, details: JSON.stringify({ role, contactId: id }), request })
  }

  // Optionally send the link through the conversation the team is looking at
  let sent = false
  let sendError: string | null = null
  if (typeof body.sendToConversationId === 'string') {
    const conversation = await prisma.conversation.findFirst({ where: { id: body.sendToConversationId, contactId: id } })
    if (conversation) {
      const res = await sendToConversation({ conversation, message: accessLinkMessage(name, role, accessUrl), sender: { type: 'HUMAN', userId: admin.id } })
      sent = res.ok
      if (!res.ok) sendError = res.error
    }
  }
  return NextResponse.json({ contact: await getContactDetail(id), accessUrl, sent, sendError })
}
