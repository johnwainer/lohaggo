/**
 * Editorial review started by people (editor buttons, approval and publishing routes). Agent posts run
 * as the agent's review (its budget and activity); posts written by people use the workspace's cap.
 * No permission checks or audit here: the routes do both.
 */
import { prisma } from '@/lib/prisma'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { agentReviewPass, ensureAgentReview, loadAgent, reviewContextFor, type Agent } from '@/lib/marketing/agent'
import { defaultAgentConfig } from '@/lib/marketing/agent-input'
import { brandName, catalogFor } from '@/lib/marketing/agent-data'
import { getEditorialSettings, hashOf, loadReviewPost, reviewPass, saveReviewState, type PassResult, type ReviewEnv } from '@/lib/marketing/editorial'
import { gateReason } from '@/lib/marketing/editorial-core'
import { PASSING, type EditorialSettings, type ReviewStatus } from '@/lib/marketing/editorial-rubric'

export class EditorialError extends Error {}

type Trigger = ReviewEnv['trigger']
type Base = Omit<ReviewEnv, 'canSpend' | 'onCost' | 'agentId' | 'workspaceId'>

async function workspaceBlock(workspaceId: string) {
  const settings = await getAiSettings()
  if (!hasTextProvider(settings)) return 'La IA no está configurada'
  const ws = await checkWorkspaceBudget(workspaceId)
  return ws.state === 'blocked' ? `Tope mensual de IA del workspace alcanzado (${ws.pct} %)` : null
}

/** Context for a post written by a person: its campaign's agent if it has one, otherwise the catalog. */
async function humanBase(post: { workspaceId: string; campaignId: string | null }, s: EditorialSettings, trigger: Trigger, userId: string | null): Promise<Base> {
  const campaignAgent = post.campaignId ? await prisma.marketingAgent.findUnique({ where: { campaignId: post.campaignId }, include: { campaign: true } }) : null
  if (campaignAgent) return { ...(await reviewContextFor(campaignAgent, s)), trigger, createdById: userId }
  const [brand, catalog] = await Promise.all([brandName(post.workspaceId), catalogFor(defaultAgentConfig())])
  const context = [
    `Catálogo de servicios (nombre · precio base en COP):\n${catalog.services.map((x) => `- ${x.name}${x.basePrice ? ` · desde $${Math.round(x.basePrice).toLocaleString('es-CO')}` : ''}`).join('\n') || '- (sin datos)'}`,
    `Ciudades: ${catalog.cities.join(', ') || 'sin datos'}`,
    'No hay configuración de campaña: juzga voz y promociones con criterio general de la marca; cualquier precio o promoción que no esté en el catálogo es dudoso.',
  ].join('\n\n')
  const treatment = s.treatment === 'usted' ? 'usted' as const : 'tú' as const
  return { brand: brand || 'la marca', treatment, context, protectedWords: [...catalog.services.map((x) => x.name), ...catalog.cities], trigger, createdById: userId }
}

async function runPass(postId: string, s: EditorialSettings, trigger: Trigger, userId: string | null, opts: { spellingOnly?: boolean } = {}): Promise<PassResult> {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { workspaceId: true, campaignId: true, agentId: true } })
  if (!post) throw new EditorialError('Publicación no encontrada')
  const agent: Agent | null = post.agentId ? await loadAgent(post.agentId) : null
  if (agent) return agentReviewPass(agent, postId, s, { ...(await reviewContextFor(agent, s)), trigger, createdById: userId }, { round: 0, spellingOnly: opts.spellingOnly })
  const base = await humanBase(post, s, trigger, userId)
  return reviewPass(postId, s, { ...base, workspaceId: post.workspaceId, agentId: null, canSpend: () => workspaceBlock(post.workspaceId) }, { round: 0, spellingOnly: opts.spellingOnly })
}

/**
 * «Volver a revisar»: the whole review again on what is saved now. If it does not pass, a post that was
 * approved or queued goes back to review (a mandatory review would hold it anyway at publishing time).
 */
export async function reviewNow(postId: string, userId: string | null) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { workspaceId: true, status: true } })
  if (!post) throw new EditorialError('Publicación no encontrada')
  if (['publishing', 'published', 'partial', 'archived'].includes(post.status)) throw new EditorialError('Ya salió o está archivada: no se revisa')
  const s = await getEditorialSettings(post.workspaceId)
  if (!s.spellingEnabled && !s.editorEnabled) throw new EditorialError('Los dos revisores están apagados en Ajustes → Revisión editorial')
  await prisma.marketingPost.update({ where: { id: postId }, data: { reviewStatus: 'pending' } })
  const pass = await runPass(postId, s, 'manual', userId)
  await saveReviewState(postId, pass.status, { score: pass.score, rounds: 0 })
  if (pass.status !== 'approved' && s.required && ['approved', 'scheduled'].includes(post.status)) {
    await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'La revisión editorial no la aprobó' } })
    await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'review', approvedAt: null, approvedById: null, scheduledAt: null } })
  }
  return pass
}

/**
 * «Revisar ortografía»: only the proofreader, available whatever the settings. Form-only corrections
 * of a text whose review was current keep that review (with the new fingerprint); otherwise nothing
 * about the review changes.
 */
export async function proofreadNow(postId: string, userId: string | null) {
  const before = await loadReviewPost(postId)
  if (!before) throw new EditorialError('Publicación no encontrada')
  if (['publishing', 'published', 'partial', 'archived'].includes(before.status)) throw new EditorialError('Ya salió o está archivada: no se corrige')
  const s = await getEditorialSettings(before.workspaceId)
  const wasCurrent = PASSING.includes(before.reviewStatus as ReviewStatus) && before.reviewHash === hashOf(before)
  const pass = await runPass(postId, s, 'manual', userId, { spellingOnly: true })
  if (pass.status === 'failed') throw new EditorialError(pass.error || 'No se pudo revisar la ortografía')
  if (pass.corrections) {
    const after = await loadReviewPost(postId)
    if (after && wasCurrent) await prisma.marketingPost.update({ where: { id: postId }, data: { reviewHash: hashOf(after) } })
    else if (after?.reviewHash && after.reviewStatus !== 'pending') await prisma.marketingPost.update({ where: { id: postId }, data: { reviewStatus: 'stale' } })
  }
  return pass
}

/**
 * Before a person's approval or publication: the mandatory review must cover these texts. Runs it when
 * it never ran, failed or the texts changed; what the editor held and nobody changed stays held.
 */
export async function ensureReviewed(postId: string, userId: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const post = await loadReviewPost(postId)
  if (!post) return { ok: false, message: 'Publicación no encontrada' }
  if (post.agentId) {
    const agent = await loadAgent(post.agentId)
    if (agent) return ensureAgentReview(agent, postId, userId)
  }
  const s = await getEditorialSettings(post.workspaceId)
  const hash = hashOf(post)
  const reason = gateReason(s, post, hash)
  if (!reason) return { ok: true }
  if ((post.reviewStatus === 'changes' || post.reviewStatus === 'rejected') && post.reviewHash === hash) return { ok: false, message: `${reason}. Edítala o usa «Aprobar de todos modos».` }
  await prisma.marketingPost.update({ where: { id: postId }, data: { reviewStatus: 'pending' } })
  const pass = await runPass(postId, s, 'publish', userId)
  await saveReviewState(postId, pass.status, { score: pass.score, rounds: 0 })
  if (pass.status === 'approved') return { ok: true }
  return { ok: false, message: pass.status === 'failed' ? `La revisión no se pudo hacer: ${pass.error}` : pass.status === 'rejected' ? `El editor la rechazó: ${pass.summary}` : `El editor pide cambios: ${pass.instructions.slice(0, 3).map((i) => i.change).join(' · ') || pass.summary}` }
}

/** «Aprobar de todos modos»: a person with publish permission takes responsibility for these exact texts. */
export async function overrideReview(postId: string) {
  const post = await loadReviewPost(postId)
  if (!post) throw new EditorialError('Publicación no encontrada')
  if (['publishing', 'published', 'partial', 'archived'].includes(post.status)) throw new EditorialError('Ya salió o está archivada')
  await prisma.marketingPost.update({ where: { id: postId }, data: { reviewStatus: 'overridden', reviewHash: hashOf(post), reviewedAt: new Date() } })
  return { previous: post.reviewStatus }
}
