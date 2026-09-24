import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { answerGap, indexDoc } from '@/lib/ai/knowledge'

type RouteContext = { params: Promise<{ id: string }> }

/** {action:'answer', answer, title?} creates a knowledge document and closes the gap; {action:'dismiss'}. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const gap = await prisma.aiKnowledgeGap.findUnique({ where: { id: (await context.params).id } })
  if (!gap || !can(auth, gap.workspaceId, 'ai.knowledge')) return forbidden()
  const body = await request.json().catch(() => ({}))

  if (body.action === 'dismiss') {
    await prisma.aiKnowledgeGap.update({ where: { id: gap.id }, data: { status: 'dismissed', answeredAt: new Date() } })
    return NextResponse.json({ ok: true })
  }
  const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
  if (!answer) return NextResponse.json({ error: 'Escribe la respuesta' }, { status: 400 })
  const doc = await answerGap({ gapId: gap.id, answer, title: typeof body.title === 'string' ? body.title : undefined, createdByEmail: auth.admin.email })
  after(() => indexDoc(doc.id))
  return NextResponse.json({ ok: true, docId: doc.id })
}
