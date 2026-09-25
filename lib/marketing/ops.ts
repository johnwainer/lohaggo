import { prisma } from '@/lib/prisma'
import { MAX_ACTIVE_AGENTS, configOf, scheduleApproved } from '@/lib/marketing/agent'
import { bogota, inQuiet } from '@/lib/marketing/agent-core'
import { refreshPostStatus, schedulePost } from '@/lib/marketing/publisher'
import type { MarketingAgent, MarketingChannel } from '@prisma/client'

/**
 * Marketing operations shared by the admin routes and Haggo. They do not check permissions nor write the
 * audit log: the caller (a route with the person's session, or Haggo's approved action) does both.
 */

export class OpsError extends Error {}

/** A failed publication goes back to the queue now; the publisher (every minute) takes it again. */
export async function retryPublication(publicationId: string) {
  const pub = await prisma.marketingPublication.findUnique({ where: { id: publicationId }, select: { id: true, postId: true, status: true } })
  if (!pub) throw new OpsError('Publicación no encontrada')
  if (pub.status !== 'failed') throw new OpsError('Solo se reintenta una publicación fallida')
  await prisma.marketingPublication.update({ where: { id: pub.id }, data: { status: 'scheduled', scheduledAt: new Date(), attempts: 0, lastError: null, claimToken: null } })
  await refreshPostStatus(pub.postId)
  return pub
}

/** Approves a post waiting for review; agent posts get their slot right away. */
export async function approvePost(postId: string, approverId: string | null) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { id: true, status: true } })
  if (!post) throw new OpsError('Publicación no encontrada')
  if (post.status !== 'review') throw new OpsError('Solo se aprueba lo que está esperando aprobación')
  await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'approved', approvedById: approverId, approvedAt: new Date() } })
  return scheduleApproved(postId)
}

/** Back to review before it goes out: scheduled publications are cancelled. */
export async function returnToReview(postId: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { status: true } })
  if (!post || !['approved', 'scheduled'].includes(post.status)) throw new OpsError('Solo vuelve a revisión lo aprobado que aún no sale')
  await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Devuelta a revisión' } })
  await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'review', approvedById: null, approvedAt: null, scheduledAt: null } })
  await refreshPostStatus(postId)
}

/** Why an agent cannot be activated now (null = it can). The same rules as the agent screen. */
export async function activationError(agent: Pick<MarketingAgent, 'id' | 'workspaceId' | 'status' | 'strategyApprovedAt'>) {
  if (!agent.strategyApprovedAt) return 'Primero hay que aprobar la estrategia del agente'
  if (agent.status !== 'active' && (await prisma.marketingAgent.count({ where: { workspaceId: agent.workspaceId, status: 'active' } })) >= MAX_ACTIVE_AGENTS) return `Ya hay ${MAX_ACTIVE_AGENTS} agentes trabajando en este workspace`
  return null
}

export async function activateAgent(agentId: string) {
  const agent = await prisma.marketingAgent.findUnique({ where: { id: agentId } })
  if (!agent) throw new OpsError('Agente no encontrado')
  const error = await activationError(agent)
  if (error) throw new OpsError(error)
  await prisma.marketingAgent.update({ where: { id: agentId }, data: { status: 'active' } })
}

/** Does a moment fall inside an agent's schedule (days, windows, quiet hours)? Bogotá time. */
export function fitsAgentSchedule(agent: Pick<MarketingAgent, 'config'>, when: Date) {
  const s = configOf(agent as MarketingAgent).schedule
  const b = bogota(when)
  if (!s.days.includes(b.weekday)) return { ok: false as const, reason: 'ese día no está entre los días de publicación del agente' }
  if (inQuiet(b.hour, s.quietFrom, s.quietTo)) return { ok: false as const, reason: 'cae en las horas de silencio del agente' }
  if (!s.windows.some((w) => b.hour >= w.from && b.hour < w.to)) return { ok: false as const, reason: 'está fuera de las franjas horarias del agente' }
  return { ok: true as const }
}

/**
 * Moves every pending publication of a post to `when` (same channels and accounts). Returns the previous
 * time so it can be undone.
 */
export async function reschedulePost(postId: string, when: Date) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { id: true, status: true, scheduledAt: true } })
  if (!post) throw new OpsError('Publicación no encontrada')
  if (['published', 'partial', 'publishing', 'archived'].includes(post.status)) throw new OpsError('Ya salió o está archivada: no se puede reprogramar')
  if (when.getTime() < Date.now() + 60_000) throw new OpsError('La nueva hora debe ser al menos en un minuto')
  const pending = await prisma.marketingPublication.findMany({ where: { postId, status: 'scheduled' }, select: { channel: true, connectionId: true, scheduledAt: true } })
  if (!pending.length) throw new OpsError('No tiene nada programado que mover')
  await schedulePost(postId, pending.map((p) => ({ channel: p.channel as MarketingChannel, connectionId: p.connectionId })), when)
  return { previous: pending[0].scheduledAt }
}
