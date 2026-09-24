import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { indexDoc } from '@/lib/ai/knowledge'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

async function load(id: string) {
  return prisma.aiKnowledgeDoc.findUnique({ where: { id } })
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const doc = await load((await context.params).id)
  if (!doc || !can(auth, doc.workspaceId, 'ai.view')) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ doc })
}

/** Edit title/content/agents (re-indexes) or {action:'reindex'} (re-reads Google docs). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const doc = await load((await context.params).id)
  if (!doc || !can(auth, doc.workspaceId, 'ai.knowledge')) return forbidden()
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = { status: 'pending' }
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
  if (typeof body.content === 'string' && doc.kind !== 'gdoc') data.content = body.content.slice(0, 2_000_000)
  if (Array.isArray(body.agentIds)) {
    data.agentIds = (await prisma.aiAgent.findMany({ where: { workspaceId: doc.workspaceId, id: { in: body.agentIds.map(String) } }, select: { id: true } })).map((a) => a.id)
  }
  await prisma.aiKnowledgeDoc.update({ where: { id: doc.id }, data })
  after(() => indexDoc(doc.id))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const doc = await load((await context.params).id)
  if (!doc || !can(auth, doc.workspaceId, 'ai.knowledge')) return forbidden()
  await prisma.aiKnowledgeDoc.delete({ where: { id: doc.id } })
  return NextResponse.json({ ok: true })
}
