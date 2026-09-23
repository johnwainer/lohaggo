export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { takeThreadControl } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, isMetaChannel, requireMetaApp } from '@/lib/messaging/meta-channels'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { connection: true } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  if (!isMetaChannel(conversation.channel) || !conversation.connection) {
    return NextResponse.json({ error: 'Solo aplica a Messenger / Instagram' }, { status: 400 })
  }
  const creds = getConnectionCredentials(conversation.connection)
  if (!creds?.pageAccessToken) return NextResponse.json({ error: 'Token de la página no disponible' }, { status: 500 })

  try {
    const app = await requireMetaApp()
    await takeThreadControl(app, creds.pageAccessToken, conversation.contactPhone)
    await prisma.conversation.update({ where: { id }, data: { threadOwner: null } })
    emitInboxEvent({ type: 'status-update', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: describeGraphError(err) }, { status: 502 })
  }
}
