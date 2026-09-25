import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { chunkText, estimateTokens, rankLexical } from '@/lib/ai/knowledge-core'
import { getVoyage, voyageEmbed } from '@/lib/ai/voyage'
import { voyageDim } from '@/lib/ai/models'

const logger = createLogger('ai-knowledge')

/** Below this size the whole knowledge base goes into the (cached) system prompt instead of retrieval. */
export const FULL_KB_TOKENS = 6000
export const RETRIEVE_K = 8
export const SIMILARITY_THRESHOLD = 0.3

export type KnowledgeChunk = { docId: string; title: string; text: string; score: number }
export type Retrieval = { mode: 'none' | 'full' | 'semantic' | 'lexical'; chunks: KnowledgeChunk[] }

// ─── Sources ────────────────────────────────────────────────────────────────

const GOOGLE_RE = /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/

export function googleExportUrl(url: string): string | null {
  const m = url.match(GOOGLE_RE)
  if (!m) return null
  const [, kind, id] = m
  if (kind === 'document') return `https://docs.google.com/document/d/${id}/export?format=txt`
  if (kind === 'spreadsheets') return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
  return `https://docs.google.com/presentation/d/${id}/export/txt`
}

/** Only Google Docs/Sheets/Slides shared as "anyone with the link" (no arbitrary URLs: SSRF). */
export async function fetchGoogleDoc(url: string) {
  const exportUrl = googleExportUrl(url)
  if (!exportUrl) throw new Error('Solo se admiten enlaces de Google Docs, Sheets o Slides')
  const res = await fetch(exportUrl, { redirect: 'follow' })
  const type = res.headers.get('content-type') || ''
  if (!res.ok || type.includes('text/html')) throw new Error('No se pudo leer el documento: compártelo como "Cualquier persona con el enlace"')
  return (await res.text()).slice(0, 2_000_000)
}

export async function extractFileText(name: string, mime: string, data: Buffer) {
  const lower = name.toLowerCase()
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(data))
    const { text } = await extractText(pdf, { mergePages: true })
    return String(text)
  }
  if (/\.(txt|md|markdown|csv)$/.test(lower) || mime.startsWith('text/')) return data.toString('utf8')
  throw new Error('Formato no soportado (txt, md, csv o pdf)')
}

// ─── Indexing ───────────────────────────────────────────────────────────────

function vectorLiteral(v: number[]) {
  return `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`
}

export async function indexDoc(docId: string) {
  const doc = await prisma.aiKnowledgeDoc.findUnique({ where: { id: docId } })
  if (!doc) return
  await prisma.aiKnowledgeDoc.update({ where: { id: docId }, data: { status: 'indexing', error: null } })
  try {
    let content = doc.content
    if (doc.kind === 'gdoc' && doc.sourceUrl) {
      content = await fetchGoogleDoc(doc.sourceUrl)
    }
    const chunks = chunkText(content)
    await prisma.aiKnowledgeChunk.deleteMany({ where: { docId } })
    const created = chunks.length
      ? await prisma.aiKnowledgeChunk.createManyAndReturn({
          data: chunks.map((c, idx) => ({ docId, workspaceId: doc.workspaceId, idx, text: c.text, tokens: c.tokens })),
          select: { id: true, idx: true, text: true },
        })
      : []

    const voyage = await getVoyage()
    let embeddingModel: string | null = null
    let embedError: string | null = null
    // Voyage failing (credit, key, outage) must not lose the document: it stays usable by word search
    if (voyage && created.length) try {
      const dim = voyageDim(voyage.model)
      const ordered = [...created].sort((a, b) => a.idx - b.idx)
      for (let i = 0; i < ordered.length; i += 64) {
        const batch = ordered.slice(i, i + 64)
        const out = await voyageEmbed({
          key: voyage.key,
          model: voyage.model,
          input: batch.map((c) => `${doc.title}\n\n${c.text}`),
          inputType: 'document',
          workspaceId: doc.workspaceId,
        })
        for (let j = 0; j < batch.length; j++) {
          const vec = out.vectors[j]
          if (!vec) continue
          await prisma.$executeRaw`UPDATE "AiKnowledgeChunk" SET "embedding" = ${vectorLiteral(vec)}::vector, "embeddingDim" = ${vec.length || dim} WHERE "id" = ${batch[j].id}`
        }
      }
      embeddingModel = voyage.model
    } catch (err) {
      embedError = `Sin embeddings (Voyage: ${err instanceof Error ? err.message : 'error'}); se usa la búsqueda por palabras. Reindexa cuando Voyage responda.`.slice(0, 500)
      logger.warn('Embedding failed, document kept for lexical search', { docId, err: err instanceof Error ? err.message : err })
    }

    await prisma.aiKnowledgeDoc.update({
      where: { id: docId },
      data: { content, status: 'indexed', chunkCount: created.length, embeddingModel, indexedAt: new Date(), error: embedError },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error indexando'
    logger.warn('Index failed', { docId, message })
    await prisma.aiKnowledgeDoc.update({ where: { id: docId }, data: { status: 'error', error: message.slice(0, 500) } })
  }
}

export async function indexPending(limit = 5) {
  const docs = await prisma.aiKnowledgeDoc.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: limit, select: { id: true } })
  for (const d of docs) await indexDoc(d.id)
  return docs.length
}

// ─── Retrieval ──────────────────────────────────────────────────────────────

function docScope(workspaceId: string, agentId: string | null) {
  return {
    workspaceId,
    status: 'indexed',
    ...(agentId ? { OR: [{ agentIds: { isEmpty: true } }, { agentIds: { has: agentId } }] } : {}),
  }
}

export async function retrieve(params: { workspaceId: string; agentId: string | null; query: string; k?: number }): Promise<Retrieval> {
  const k = params.k ?? RETRIEVE_K
  const docs = await prisma.aiKnowledgeDoc.findMany({
    where: docScope(params.workspaceId, params.agentId),
    select: { id: true, title: true, content: true, embeddingModel: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!docs.length) return { mode: 'none', chunks: [] }

  const total = docs.reduce((acc, d) => acc + estimateTokens(d.content), 0)
  if (total <= FULL_KB_TOKENS) {
    return { mode: 'full', chunks: docs.map((d) => ({ docId: d.id, title: d.title, text: d.content, score: 1 })) }
  }

  const titles = new Map(docs.map((d) => [d.id, d.title]))
  const voyage = await getVoyage()
  if (voyage && params.query.trim()) {
    try {
      const { vectors } = await voyageEmbed({ key: voyage.key, model: voyage.model, input: [params.query.slice(0, 4000)], inputType: 'query', workspaceId: params.workspaceId })
      const q = vectors[0]
      if (q?.length) {
        const docIds = docs.map((d) => d.id)
        const rows = await prisma.$queryRaw<Array<{ docId: string; text: string; sim: number }>>`
          SELECT c."docId", c."text", 1 - (c."embedding" <=> ${vectorLiteral(q)}::vector) AS sim
          FROM "AiKnowledgeChunk" c
          WHERE c."docId" = ANY(${docIds}) AND c."embeddingDim" = ${q.length} AND c."embedding" IS NOT NULL
          ORDER BY c."embedding" <=> ${vectorLiteral(q)}::vector
          LIMIT ${k}`
        const hits = rows.filter((r) => Number(r.sim) >= SIMILARITY_THRESHOLD)
        if (hits.length) {
          return { mode: 'semantic', chunks: hits.map((r) => ({ docId: r.docId, title: titles.get(r.docId) || '', text: r.text, score: Number(r.sim) })) }
        }
      }
    } catch (err) {
      logger.warn('Semantic retrieval failed, falling back to lexical', { err: err instanceof Error ? err.message : err })
    }
  }

  const chunks = await prisma.aiKnowledgeChunk.findMany({
    where: { docId: { in: docs.map((d) => d.id) } },
    select: { docId: true, text: true },
    take: 4000,
  })
  const ranked = rankLexical(params.query, chunks.map((c) => ({ ...c, title: titles.get(c.docId) || '' })), k)
  return { mode: 'lexical', chunks: ranked.map((r) => ({ docId: r.docId, title: r.title, text: r.text, score: r.score })) }
}

// ─── Knowledge gaps ─────────────────────────────────────────────────────────

export async function recordGap(params: { workspaceId: string; agentId: string | null; conversationId: string | null; question: string }) {
  const question = params.question.trim().slice(0, 1000)
  if (!question) return
  const dup = await prisma.aiKnowledgeGap.findFirst({ where: { workspaceId: params.workspaceId, status: 'open', question } })
  if (dup) return
  await prisma.aiKnowledgeGap.create({ data: { ...params, question } })
}

/** Answering a gap creates a knowledge document and closes the gap: the base improves with use. */
export async function answerGap(params: { gapId: string; answer: string; title?: string; createdByEmail?: string | null }) {
  const gap = await prisma.aiKnowledgeGap.findUnique({ where: { id: params.gapId } })
  if (!gap) throw new Error('Hueco no encontrado')
  const doc = await prisma.aiKnowledgeDoc.create({
    data: {
      workspaceId: gap.workspaceId,
      title: params.title?.trim() || gap.question.slice(0, 120),
      kind: 'text',
      content: `Pregunta: ${gap.question}\n\nRespuesta: ${params.answer.trim()}`,
      createdByEmail: params.createdByEmail ?? null,
    },
  })
  await prisma.aiKnowledgeGap.update({ where: { id: gap.id }, data: { status: 'answered', answerDocId: doc.id, answeredAt: new Date() } })
  return doc
}
