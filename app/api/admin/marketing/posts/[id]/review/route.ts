import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { loadPostDetail } from '@/lib/marketing/service'
import { AgentError, withAgentLock } from '@/lib/marketing/agent'
import { reviewsOf } from '@/lib/marketing/editorial'
import { EditorialError, overrideReview, proofreadNow, reviewNow } from '@/lib/marketing/editorial-ops'

export const dynamic = 'force-dynamic'
export const maxDuration = 180
/** A person may ask a paid review of the same post at most this often. */
const COOLDOWN_MS = 30_000

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await prisma.marketingPost.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ reviews: await reviewsOf(id) })
}

/**
 * action "review": the whole editorial review again · "spelling": only the proofreader · "override":
 * approve these exact texts despite the review (publish permission, audited).
 */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await prisma.marketingPost.findUnique({ where: { id }, select: { workspaceId: true, title: true, agentId: true, reviewStatus: true } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const action = body.action
  if (action !== 'review' && action !== 'spelling' && action !== 'override') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  if (action === 'override' && !mkCan(auth.access, post.workspaceId, 'marketing.publish')) return forbidden('Solo quien puede publicar aprueba sin la revisión')
  if (action !== 'override' && !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return forbidden()

  let message: string
  try {
    if (action === 'override') {
      const r = await overrideReview(id)
      message = 'Aprobada por ti para estos textos exactos'
      await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_REVIEW_OVERRIDE', entityType: 'MarketingPost', entityId: id, details: `${post.title} (revisión: ${r.previous ?? 'ninguna'})`.slice(0, 500), request })
    } else {
      const lastManual = await prisma.marketingReview.findFirst({ where: { postId: id, trigger: 'manual' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      if (post.reviewStatus === 'pending' || (lastManual && Date.now() - lastManual.createdAt.getTime() < COOLDOWN_MS)) return NextResponse.json({ error: 'Ya se está revisando o se acaba de revisar; espera unos segundos' }, { status: 429 })
      // Agent posts: one paid action at a time per agent (the review counts in its budget)
      const run = async () => (action === 'review' ? reviewNow(id, auth.admin.id) : proofreadNow(id, auth.admin.id))
      const pass = post.agentId ? await withAgentLock(post.agentId, run) : await run()
      if (!pass) return NextResponse.json({ error: 'El agente está trabajando en otra cosa; intenta en un minuto' }, { status: 409 })
      message = action === 'spelling'
        ? pass.corrections ? `${pass.corrections} corrección(es) de ortografía aplicadas` : 'Sin errores de ortografía'
        : pass.status === 'approved' ? `Aprobada${pass.score != null ? ` con ${pass.score}/10` : ''}` : pass.status === 'failed' ? `No se pudo revisar: ${pass.error}` : pass.status === 'rejected' ? 'El editor la rechazó' : 'El editor pide cambios'
      await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: action === 'review' ? 'MARKETING_REVIEW_RUN' : 'MARKETING_REVIEW_SPELLING', entityType: 'MarketingPost', entityId: id, details: `${post.title}: ${message}`.slice(0, 500), request })
    }
  } catch (err) {
    const known = err instanceof EditorialError || err instanceof AgentError
    return NextResponse.json({ error: known ? err.message : 'No se pudo revisar' }, { status: known ? 400 : 500 })
  }
  return NextResponse.json({ message, post: await loadPostDetail(id), reviews: await reviewsOf(id) })
}
