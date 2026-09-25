import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { auditAdminAction } from '@/lib/admin-utils'
import { bogotaDayStart } from '@/lib/admin/overview-core'
import { getHaggoConfig, haggoSpend } from '@/lib/haggo/store'
import { inQuietHours } from '@/lib/haggo/schedule'
import { parseRule } from '@/lib/haggo/directives'
import { decide, type Origin } from '@/lib/haggo/policy'
import { getAction } from '@/lib/haggo/actions/registry'
import { validateProposal } from '@/lib/haggo/actions/proposal'
import { nextStatus, OPEN_STATUSES, type ActionStatus } from '@/lib/haggo/actions/state'
import type { Entity, HaggoActionDef } from '@/lib/haggo/actions/types'

const logger = createLogger('haggo-actions')
const H = 3600_000
const json = (v: unknown) => (v == null ? Prisma.DbNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue))

export class ActionError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type ProposeContext = { origin: Origin; runId?: string | null; messageId?: string | null; toolsUsed: string[]; cycleCounter?: { n: number } }
export type ProposeResult = { ok: true; id: string; status: ActionStatus; reasons: string[]; summary: string } | { ok: false; errors: string[] }

// ─── Who touched it last ────────────────────────────────────────────────────

/** When a person (not Haggo, not a job) last changed this entity, within the last `hours`. */
export async function lastHumanChange(entity: Entity | null, hours: number): Promise<Date | null> {
  if (!entity || hours <= 0) return null
  const since = new Date(Date.now() - hours * H)
  if (entity.type === 'Conversation') {
    const ev = await prisma.conversationEvent.findFirst({ where: { conversationId: entity.id, actorType: 'user', actorName: { not: 'Haggo' }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    return ev?.createdAt ?? null
  }
  let target = entity
  if (entity.type === 'MarketingPublication') {
    const pub = await prisma.marketingPublication.findUnique({ where: { id: entity.id }, select: { postId: true } })
    if (!pub) return null
    target = { type: 'MarketingPost', id: pub.postId }
  } else if (entity.type === 'FeatureFlag') {
    const flag = await prisma.featureFlag.findUnique({ where: { key: entity.id }, select: { id: true } })
    if (!flag) return null
    target = { type: 'FeatureFlag', id: flag.id }
  }
  const row = await prisma.adminAuditLog.findFirst({ where: { entityType: target.type, entityId: target.id, createdAt: { gte: since }, NOT: { action: { startsWith: 'HAGGO_' } } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  return row?.createdAt ?? null
}

async function lastSameAction(tool: string, entity: Entity | null) {
  if (!entity) return null
  const a = await prisma.haggoAction.findFirst({ where: { tool, entityType: entity.type, entityId: entity.id, status: { in: ['executed', 'reverted'] } }, orderBy: { executedAt: 'desc' }, select: { executedAt: true } })
  return a?.executedAt ?? null
}

async function activeDirectives() {
  const rows = await prisma.haggoDirective.findMany({ where: { active: true }, select: { id: true, text: true, rule: true } })
  return rows.map((d) => {
    const parsed = parseRule(d.rule)
    return { id: d.id, text: d.text, rule: parsed.ok ? parsed.rule : null }
  })
}

async function policyFor(def: HaggoActionDef, entity: Entity | null, origin: Origin, cycleActions: number) {
  const cfg = await getHaggoConfig()
  const [directives, dayActions, lastHuman, lastSame, spend] = await Promise.all([
    activeDirectives(),
    prisma.haggoAction.count({ where: { createdAt: { gte: bogotaDayStart(new Date()) }, status: { notIn: ['blocked', 'rejected', 'expired'] } } }),
    lastHumanChange(entity, cfg.humanCooldownHours),
    lastSameAction(def.id, entity),
    haggoSpend(cfg),
  ])
  return { cfg, decision: decide({ action: def, origin, now: new Date(), config: cfg, directives, counters: { cycleActions, dayActions }, lastHumanChangeAt: lastHuman, lastSameActionAt: lastSame, budgetBlocked: Boolean(spend.blocked), quietNow: inQuietHours(cfg.quietHours, cfg.timezone) }) }
}

const paramsHash = (tool: string, entity: Entity | null, params: unknown) => createHash('sha256').update(`${tool}|${entity?.type}:${entity?.id}|${JSON.stringify(params)}|${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 40)

// ─── Propose ────────────────────────────────────────────────────────────────

/**
 * From the model's proposal to a HaggoAction row: validate, parse, avoid noise, check it still makes
 * sense, preview it (no writes), let the policy decide. Errors go back to the model so it can correct.
 */
export async function proposeAction(raw: unknown, ctx: ProposeContext): Promise<ProposeResult> {
  const def = getAction(String((raw as Record<string, unknown> | null)?.action_id ?? ''))
  const v = validateProposal(raw, { action: def, toolsUsed: ctx.toolsUsed, origin: ctx.origin })
  if (!v.ok) return { ok: false, errors: v.errors }
  if (!def) return { ok: false, errors: ['Acción desconocida'] }
  const parsed = def.parse(v.proposal.params)
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map((e) => `params.${e}`) }
  const entity = def.entity(parsed.params)

  if (entity) {
    const pending = await prisma.haggoAction.findFirst({ where: { tool: def.id, entityType: entity.type, entityId: entity.id, status: { in: OPEN_STATUSES } }, select: { id: true } })
    if (pending) return { ok: false, errors: ['Ya hay una propuesta igual pendiente de aprobación'] }
    const rejected = await prisma.haggoAction.findFirst({ where: { tool: def.id, entityType: entity.type, entityId: entity.id, status: 'rejected', decidedAt: { gte: new Date(Date.now() - 7 * 24 * H) } }, select: { decisionNote: true } })
    if (rejected && !v.proposal.againBecause) return { ok: false, errors: [`El superadmin rechazó algo igual hace menos de 7 días${rejected.decisionNote ? ` («${rejected.decisionNote}»)` : ''}: solo se vuelve a proponer con evidencia nueva en por_que_de_nuevo`] }
  }

  const pre = await def.preconditions(parsed.params)
  if (!pre.ok) return { ok: false, errors: [`No aplica ahora: ${pre.reason}`] }
  const preview = await def.preview(parsed.params, pre.before)
  const { cfg, decision } = await policyFor(def, entity, ctx.origin, ctx.cycleCounter?.n ?? 0)
  const status: ActionStatus = decision.verdict === 'blocked' ? 'blocked' : 'proposed'
  const p = v.proposal
  try {
    const row = await prisma.haggoAction.create({
      data: {
        runId: ctx.runId ?? null, messageId: ctx.messageId ?? null, origin: ctx.origin, tool: def.id, params: json(parsed.params), domain: def.domain, risk: def.risk, status,
        reason: p.why, expectedImpact: p.what, evidence: json({ items: p.evidence, lowTrust: p.lowTrust, forReview: p.forReview, risks: p.risks, policy: decision.reasons, againBecause: p.againBecause }),
        hypothesis: json(p.hypothesis), alternatives: json(p.alternatives), confidence: p.confidence, preview: json(preview), before: json(pre.before),
        entityType: entity?.type ?? null, entityId: entity?.id ?? null, planId: p.plan?.id ?? null, planOrder: p.plan?.order ?? null,
        idempotencyKey: paramsHash(def.id, entity, parsed.params), expiresAt: status === 'proposed' ? new Date(Date.now() + cfg.proposalTtlHours * H) : null,
      },
    })
    if (status === 'proposed' && ctx.cycleCounter) ctx.cycleCounter.n++
    return { ok: true, id: row.id, status, reasons: decision.reasons, summary: preview.summary }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, errors: ['Ya propusiste exactamente esto hoy'] }
    throw err
  }
}

// ─── Decide ─────────────────────────────────────────────────────────────────

type Admin = { id: string; email: string | null }

async function transition(id: string, from: ActionStatus, event: Parameters<typeof nextStatus>[1], data: Prisma.HaggoActionUpdateManyMutationInput = {}) {
  const to = nextStatus(from, event)
  if (!to) throw new ActionError(`No se puede pasar de «${from}» con «${event}»`, 409)
  const r = await prisma.haggoAction.updateMany({ where: { id, status: from }, data: { ...data, status: to } })
  return r.count === 1
}

async function audit(admin: Admin, action: string, row: { id: string; tool: string; entityType: string | null; entityId: string | null }, details: string) {
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action, entityType: row.entityType ?? 'HaggoAction', entityId: row.entityId ?? row.id, details: `Haggo (aprobado por ${admin.email ?? 'superadmin'}): ${row.tool} · ${details}`.slice(0, 1000) })
}

/**
 * The superadmin approves: claimed atomically (a double click executes once), then parse, preconditions
 * and policy run again (the world may have changed since the proposal), then it executes.
 */
export async function approveAction(id: string, admin: Admin, opts: { confirm?: string } = {}) {
  const row = await prisma.haggoAction.findUnique({ where: { id } })
  if (!row) throw new ActionError('Acción no encontrada', 404)
  const def = getAction(row.tool)
  if (!def) throw new ActionError('Esta acción ya no existe en el catálogo', 409)
  if (row.status !== 'proposed') throw new ActionError('Esta acción ya se decidió', 409)
  if (def.risk === 'max' && opts.confirm !== 'APROBAR') throw new ActionError('Escribe APROBAR para confirmar una acción de riesgo máximo')
  if (row.expiresAt && row.expiresAt < new Date()) {
    await transition(id, 'proposed', 'expire')
    throw new ActionError('La propuesta caducó', 409)
  }
  if (!(await transition(id, 'proposed', 'approve', { decidedById: admin.id, decidedByEmail: admin.email, decidedAt: new Date() }))) throw new ActionError('Esta acción ya se decidió', 409)

  const fail = async (message: string) => {
    await transition(id, 'approved', 'fail', { error: message.slice(0, 1000) }).catch(() => transition(id, 'executing', 'fail', { error: message.slice(0, 1000) }))
    await audit(admin, 'HAGGO_ACTION_FAILED', row, message)
    return prisma.haggoAction.findUnique({ where: { id } })
  }
  const parsed = def.parse(row.params)
  if (!parsed.ok) return fail(`Parámetros inválidos: ${parsed.errors.join('; ')}`)
  const pre = await def.preconditions(parsed.params)
  if (!pre.ok) return fail(`Ya no aplica: ${pre.reason}`)
  // The approver is a person: a recent human change warns instead of blocking (origin «chat»)
  const { decision } = await policyFor(def, def.entity(parsed.params), 'chat', 0)
  if (decision.verdict === 'blocked') return fail(`La política la bloquea ahora: ${decision.reasons.join('; ')}`)

  await transition(id, 'approved', 'start')
  try {
    const out = await def.execute(parsed.params, { actionId: id, approverId: admin.id, approverEmail: admin.email }, pre.before)
    await transition(id, 'executing', 'succeed', { before: json(pre.before), after: json(out.after), result: json({ message: out.result }), executedAt: new Date() })
    await audit(admin, 'HAGGO_ACTION_EXECUTE', row, out.result)
    return prisma.haggoAction.findUnique({ where: { id } })
  } catch (err) {
    logger.warn('Action failed', { id, tool: row.tool, err: err instanceof Error ? err.message : err })
    return fail(err instanceof Error ? err.message : 'Error al ejecutar')
  }
}

/** A rejection with a reason becomes something Haggo remembers («the superadmin does not want X because Y»). */
export async function rejectAction(id: string, admin: Admin, reason?: string | null) {
  const row = await prisma.haggoAction.findUnique({ where: { id } })
  if (!row) throw new ActionError('Acción no encontrada', 404)
  const note = reason?.trim().slice(0, 500) || null
  if (!(await transition(id, 'proposed', 'reject', { decidedById: admin.id, decidedByEmail: admin.email, decidedAt: new Date(), decisionNote: note }))) throw new ActionError('Esta acción ya se decidió', 409)
  if (note) await prisma.haggoMemory.create({ data: { kind: 'learning', key: row.tool, content: `El superadmin rechazó «${getAction(row.tool)?.label ?? row.tool}» (${row.expectedImpact ?? ''}) porque: ${note}`.slice(0, 600) } })
  await audit(admin, 'HAGGO_ACTION_REJECT', row, note ?? 'sin motivo')
}

/** Undo only if the action is reversible and the entity is still as Haggo left it. */
export async function undoAction(id: string, admin: Admin) {
  const row = await prisma.haggoAction.findUnique({ where: { id } })
  if (!row) throw new ActionError('Acción no encontrada', 404)
  const def = getAction(row.tool)
  if (!def?.undo) throw new ActionError('Esta acción no se puede deshacer', 409)
  if (row.status !== 'executed') throw new ActionError('Solo se deshace una acción ejecutada', 409)
  const parsed = def.parse(row.params)
  if (!parsed.ok) throw new ActionError('Parámetros guardados inválidos', 409)
  if (def.unchanged && !(await def.unchanged(parsed.params, row.after))) throw new ActionError('Alguien lo cambió después de Haggo: deshacerlo pisaría ese cambio. Revísalo a mano.', 409)
  // Claimed first so a double click undoes once; back to executed if the undo fails
  if (!(await transition(id, 'executed', 'revert', { revertedAt: new Date() }))) throw new ActionError('Ya se deshizo', 409)
  try {
    await def.undo(parsed.params, row.before, row.after)
    await audit(admin, 'HAGGO_ACTION_UNDO', row, 'deshecha')
  } catch (err) {
    await prisma.haggoAction.update({ where: { id }, data: { status: 'executed', revertedAt: null, error: `No se pudo deshacer: ${err instanceof Error ? err.message : 'error'}`.slice(0, 1000) } })
    throw new ActionError(`No se pudo deshacer: ${err instanceof Error ? err.message : 'error'}`, 409)
  }
}

/** Approves the pending steps of a plan in order; stops at the first one that fails. */
export async function approvePlan(planId: string, admin: Admin) {
  const steps = await prisma.haggoAction.findMany({ where: { planId, status: 'proposed' }, orderBy: [{ planOrder: 'asc' }, { createdAt: 'asc' }] })
  if (!steps.length) throw new ActionError('No hay pasos pendientes en ese plan', 404)
  const results = []
  for (const s of steps) {
    const r = await approveAction(s.id, admin)
    results.push(r)
    if (r?.status !== 'executed') break
  }
  return results
}

/** Proposals nobody decided in time. Called on every tick. */
export async function expireActions() {
  const r = await prisma.haggoAction.updateMany({ where: { status: 'proposed', expiresAt: { lt: new Date() } }, data: { status: 'expired' } })
  return r.count
}
