import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, type MarketingPermission } from '@/lib/marketing/permissions'
import { AgentError, MANUAL_LEARN_EVERY_MS, MAX_ACTIVE_AGENTS, applyLearning, cancelPost, decideIdeas, draftIdea, generateStrategy, learn, loadAgent, planIdeas, rejectPost, scheduleApproved, withAgentLock } from '@/lib/marketing/agent'
import { agentDetail, agentFor } from '@/lib/marketing/agent-views'
import { approvePost } from '@/lib/marketing/ops'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

/** Who can do what: spending on the model and deciding on ideas is editing; approving is publishing. */
const PERMISSION: Record<string, MarketingPermission> = {
  strategy: 'marketing.edit',
  approve_strategy: 'marketing.publish',
  plan: 'marketing.edit',
  ideas: 'marketing.edit',
  draft: 'marketing.edit',
  redraft: 'marketing.edit',
  approve_post: 'marketing.publish',
  reject_post: 'marketing.edit',
  cancel_post: 'marketing.edit',
  learn: 'marketing.edit',
  apply_learning: 'marketing.publish',
}

/** Actions that call the model: one at a time per agent (the budget checks must see the previous cost). */
const PAID = ['strategy', 'plan', 'draft', 'redraft', 'learn']

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  const perm = PERMISSION[action]
  if (!perm) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  const found = await agentFor(auth.access, (await context.params).id, perm)
  if ('response' in found) return found.response
  const agent = found.agent
  // Posts and ideas must belong to this agent (the IDs come from the browser)
  const ownPost = async (id: unknown) => (typeof id === 'string' ? prisma.marketingPost.findFirst({ where: { id, agentId: agent.id }, select: { id: true, status: true, ideaId: true, title: true } }) : null)

  let message: string | null = null
  const run = async () => {
    switch (action) {
      case 'strategy': {
        const r = await generateStrategy(agent, text(body.instruction, 1000) || null)
        if (!r.ok) throw new AgentError(r.error)
        message = 'Estrategia lista para revisar'
        break
      }
      case 'approve_strategy': {
        if (!agent.strategy) throw new AgentError('No hay estrategia que aprobar')
        const activate = body.activate === true
        if (activate && agent.mode !== 'copilot' && !mkCan(auth.access, agent.workspaceId, 'marketing.publish')) throw new AgentError('Solo quien puede publicar activa este agente')
        if (activate && agent.status !== 'active' && (await prisma.marketingAgent.count({ where: { workspaceId: agent.workspaceId, status: 'active' } })) >= MAX_ACTIVE_AGENTS) throw new AgentError(`Ya hay ${MAX_ACTIVE_AGENTS} agentes trabajando en este workspace: pausa uno antes`)
        await prisma.marketingAgent.update({ where: { id: agent.id }, data: { strategyApprovedAt: new Date(), strategyApprovedById: auth.admin.id, ...(activate ? { status: 'active' } : {}) } })
        await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_STRATEGY_APPROVE', entityType: 'MarketingAgent', entityId: agent.id, details: activate ? 'aprobada y activado' : 'aprobada', request })
        message = activate ? 'Estrategia aprobada: el agente ya está trabajando' : 'Estrategia aprobada'
        break
      }
      case 'plan': {
        const r = await planIdeas((await loadAgent(agent.id))!)
        if (!r.ok) throw new AgentError(r.error)
        message = r.summary
        break
      }
      case 'ideas': {
        const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : []
        const decision = body.decision === 'accept' ? 'accept' : body.decision === 'reject' ? 'reject' : null
        if (!ids.length || !decision) throw new AgentError('Elige ideas y una decisión')
        const n = await decideIdeas(agent, ids, decision, auth.admin.id, text(body.reason, 500) || null)
        message = `${n} ${n === 1 ? 'idea' : 'ideas'} ${decision === 'accept' ? 'aceptada(s)' : 'rechazada(s)'}`
        break
      }
      case 'draft': {
        const idea = typeof body.ideaId === 'string' ? await prisma.marketingIdea.findFirst({ where: { id: body.ideaId, agentId: agent.id }, select: { id: true } }) : null
        if (!idea) throw new AgentError('Idea no encontrada')
        const r = await draftIdea(agent, idea.id)
        if (!r.ok) throw new AgentError(r.error)
        message = r.summary
        break
      }
      case 'redraft': {
        const post = await ownPost(body.postId)
        if (!post?.ideaId) throw new AgentError('Publicación no encontrada')
        if (['publishing', 'published', 'partial', 'archived'].includes(post.status)) throw new AgentError('Ya salió o está archivada: no se puede rehacer')
        const r = await draftIdea(agent, post.ideaId, { postId: post.id, instruction: text(body.instruction, 1000) || null })
        if (!r.ok) throw new AgentError(r.error)
        message = r.summary
        break
      }
      case 'approve_post': {
        const post = await ownPost(body.postId)
        if (!post) throw new AgentError('Publicación no encontrada')
        if (post.status !== 'review') throw new AgentError('Solo se aprueba lo que está esperando aprobación')
        const r = await approvePost(post.id, auth.admin.id)
        await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_POST_APPROVE', entityType: 'MarketingPost', entityId: post.id, details: post.title, request })
        message = r?.ok ? `Aprobada y programada: ${r.message}` : `Aprobada, pero no se pudo programar: ${r?.message ?? '—'}`
        break
      }
      case 'reject_post': {
        const post = await ownPost(body.postId)
        if (!post) throw new AgentError('Publicación no encontrada')
        const reason = text(body.reason, 500)
        if (!reason) throw new AgentError('Cuéntale al agente por qué (así aprende)')
        await rejectPost(agent, post.id, reason)
        message = 'Rechazada: el agente lo tendrá en cuenta'
        break
      }
      case 'cancel_post': {
        const post = await ownPost(body.postId)
        if (!post) throw new AgentError('Publicación no encontrada')
        await cancelPost(agent, post.id, body.discard === true, text(body.reason, 500) || null)
        await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_POST_CANCEL', entityType: 'MarketingPost', entityId: post.id, details: `${post.title}${body.discard === true ? ' (descartada)' : ''}`, request })
        message = body.discard === true ? 'Descartada' : 'Sacada de la cola: no saldrá hasta que la programes'
        break
      }
      case 'learn': {
        if (agent.lastLearnedAt && Date.now() - agent.lastLearnedAt.getTime() < MANUAL_LEARN_EVERY_MS) throw new AgentError('El agente ya analizó los resultados en las últimas 24 horas')
        const r = await learn(agent)
        if (!r.ok) throw new AgentError(r.error)
        message = r.summary
        break
      }
      case 'apply_learning': {
        const r = await applyLearning(agent, text(body.learningId, 40), auth.admin.id)
        await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_AGENT_LEARNING_APPLY', entityType: 'MarketingAgent', entityId: agent.id, details: r.applied.join('; ') || 'sin cambios', request })
        message = r.applied.length ? `Aplicado: ${r.applied.join('; ')}` : 'No había nada que cambiar'
        break
      }
    }
    return true
  }
  try {
    const done = PAID.includes(action) ? await withAgentLock(agent.id, run) : await run()
    if (done === null) return NextResponse.json({ error: 'El agente está trabajando en otra tarea; inténtalo en un momento' }, { status: 409 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo completar' }, { status: err instanceof AgentError ? 422 : 500 })
  }
  const fresh = await loadAgent(agent.id)
  return NextResponse.json({ message, ...(fresh ? await agentDetail(fresh, auth.access) : {}) })
}
