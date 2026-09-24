import { NextRequest, NextResponse, after } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { extractFileText, googleExportUrl, indexDoc, indexPending } from '@/lib/ai/knowledge'
import { getAiSettings } from '@/lib/ai/settings'

export const maxDuration = 60

const MAX_FILE_BYTES = 10 * 1024 * 1024

export async function GET(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !can(auth, workspaceId, 'ai.view')) return forbidden()
  const [docs, gaps, settings] = await Promise.all([
    prisma.aiKnowledgeDoc.findMany({
      where: { workspaceId },
      select: { id: true, title: true, kind: true, sourceUrl: true, status: true, error: true, chunkCount: true, embeddingModel: true, indexedAt: true, agentIds: true, createdAt: true, updatedAt: true, createdByEmail: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.aiKnowledgeGap.findMany({ where: { workspaceId, status: 'open' }, orderBy: { createdAt: 'desc' }, take: 200 }),
    getAiSettings(),
  ])
  const pending = docs.filter((d) => d.status === 'pending' || d.status === 'indexing').length
  const stale = settings.voyageKey ? docs.filter((d) => d.status === 'indexed' && d.embeddingModel !== settings.embeddingModel).length : 0
  return NextResponse.json({
    docs,
    gaps,
    pending,
    stale,
    mode: settings.voyageKey ? 'semantic' : 'lexical',
    embeddingModel: settings.embeddingModel,
    canEdit: can(auth, workspaceId, 'ai.knowledge'),
  })
}

/** Create a document: JSON {kind: 'text'|'gdoc'} or multipart with a file (txt, md, csv, pdf). */
export async function POST(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response

  let workspaceId = ''
  let title = ''
  let kind = 'text'
  let content = ''
  let sourceUrl: string | null = null
  let agentIds: string[] = []

  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData()
      workspaceId = String(form.get('workspaceId') || '')
      const file = form.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Máximo 10 MB' }, { status: 400 })
      if (!workspaceId || !can(auth, workspaceId, 'ai.knowledge')) return forbidden()
      kind = 'file'
      title = String(form.get('title') || '').trim() || file.name
      content = await extractFileText(file.name, file.type, Buffer.from(await file.arrayBuffer()))
      agentIds = JSON.parse(String(form.get('agentIds') || '[]'))
    } else {
      const body = await request.json().catch(() => ({}))
      workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
      if (!workspaceId || !can(auth, workspaceId, 'ai.knowledge')) return forbidden()
      kind = body.kind === 'gdoc' ? 'gdoc' : 'text'
      title = typeof body.title === 'string' ? body.title.trim() : ''
      agentIds = Array.isArray(body.agentIds) ? body.agentIds : []
      if (kind === 'gdoc') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!googleExportUrl(url)) return NextResponse.json({ error: 'Pega un enlace de Google Docs, Sheets o Slides' }, { status: 400 })
        sourceUrl = url
        title = title || 'Documento de Google'
      } else {
        content = typeof body.content === 'string' ? body.content : ''
        if (!content.trim()) return NextResponse.json({ error: 'El texto está vacío' }, { status: 400 })
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo leer el documento' }, { status: 400 })
  }

  if (!title) return NextResponse.json({ error: 'Pon un título' }, { status: 400 })
  const validAgents = agentIds.length
    ? (await prisma.aiAgent.findMany({ where: { workspaceId, id: { in: agentIds.map(String) } }, select: { id: true } })).map((a) => a.id)
    : []

  const doc = await prisma.aiKnowledgeDoc.create({
    data: { workspaceId, title: title.slice(0, 200), kind, content: content.slice(0, 2_000_000), sourceUrl, agentIds: validAgents, createdByEmail: auth.admin.email },
  })
  after(() => indexDoc(doc.id))
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'AI_KNOWLEDGE_CREATE', entityType: 'AiKnowledgeDoc', entityId: doc.id, details: doc.title, request })
  return NextResponse.json({ doc: { id: doc.id, status: doc.status } })
}

/** "Reindexar" the whole workspace (after changing the embedding model or re-reading Google docs). */
export async function PUT(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId || !can(auth, workspaceId, 'ai.knowledge')) return forbidden()
  const { count } = await prisma.aiKnowledgeDoc.updateMany({ where: { workspaceId }, data: { status: 'pending' } })
  after(async () => {
    while ((await indexPending(5)) > 0) { /* drain */ }
  })
  return NextResponse.json({ ok: true, queued: count })
}
