import type Anthropic from '@anthropic-ai/sdk'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { callAI, describeApiError, type CallResult, type Effort } from '@/lib/ai/anthropic'
import { getAiSettings } from '@/lib/ai/settings'
import type { AiCallKind } from '@/lib/ai/calls'
import type { HaggoConfig } from '@/lib/haggo/config'
import { detect, novelDetections, type Detection, type Snapshot } from '@/lib/haggo/detect'
import { dueJobs, type LastRuns } from '@/lib/haggo/schedule'
import { takeSnapshot } from '@/lib/haggo/snapshot'
import { getHaggoConfig, haggoSpend, withHaggoLock } from '@/lib/haggo/store'
import { READ_TOOL_DEFS, runReadTool } from '@/lib/haggo/tools/read'
import { ANALYSIS_TOOL, REPORT_TOOL, buildSystem, cycleTask, parseAnalysis, parseReport, reportTask } from '@/lib/haggo/prompt'

const logger = createLogger('haggo')
const H = 3600_000
const MAX_ROUNDS = 8
const CALL_TIMEOUT_MS = 150_000

export type RunType = 'cycle' | 'daily' | 'weekly'
export class HaggoError extends Error {}

const json = (v: unknown) => (v == null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue))
const nowText = (d: Date, tz: string) => d.toLocaleString('es-CO', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

class Meter {
  cost = 0
  tokensIn = 0
  tokensOut = 0
  model: string | null = null
  add(r: CallResult) {
    this.cost += r.costUsd
    this.tokensIn += r.usage.inputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens
    this.tokensOut += r.usage.outputTokens
    this.model = r.model
  }
  get data() {
    return { costUsd: Math.round(this.cost * 1e6) / 1e6, tokensIn: this.tokensIn, tokensOut: this.tokensOut, model: this.model }
  }
}

async function context() {
  const [directives, memory] = await Promise.all([
    prisma.haggoDirective.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' }, take: 50, select: { text: true } }),
    prisma.haggoMemory.findMany({ orderBy: { updatedAt: 'desc' }, take: 20, select: { content: true } }),
  ])
  return buildSystem({ directives, memory })
}

/**
 * The investigation loop: read tools as many rounds as needed, then the final tool. An answer without
 * the final tool gets one reminder; results never come from free text.
 */
async function think(p: { kind: AiCallKind; model: string; system: Anthropic.TextBlockParam[]; task: string; finalTool: Anthropic.Tool; maxTokens: number; effort: Effort }, meter: Meter) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: p.task }]
  const tools = [...READ_TOOL_DEFS, p.finalTool]
  let reminded = false
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let r: CallResult
    try {
      r = await callAI({ model: p.model, system: p.system, messages, tools, maxTokens: p.maxTokens, effort: p.effort, timeoutMs: CALL_TIMEOUT_MS }, { kind: p.kind })
    } catch (err) {
      throw new HaggoError(describeApiError(err))
    }
    meter.add(r)
    if (r.message.stop_reason === 'refusal') throw new HaggoError('El modelo no quiso hacer esta tarea')
    const uses = r.message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const final = uses.find((u) => u.name === p.finalTool.name)
    if (final) return final.input
    if (!uses.length) {
      if (reminded || r.message.stop_reason === 'max_tokens') throw new HaggoError('El modelo no entregó el resultado en el formato pedido')
      reminded = true
      messages.push({ role: 'assistant', content: r.message.content })
      messages.push({ role: 'user', content: `Entrega el resultado ahora con la herramienta ${p.finalTool.name}.` })
      continue
    }
    const results = await Promise.all(uses.map((u) => runReadTool(u.name, u.input)))
    messages.push({ role: 'assistant', content: r.message.content })
    const blocks: Anthropic.ContentBlockParam[] = uses.map((u, i) => ({ type: 'tool_result', tool_use_id: u.id, content: results[i].output, ...(results[i].isError ? { is_error: true } : {}) }))
    if (round >= MAX_ROUNDS - 2) blocks.push({ type: 'text', text: `No hay más consultas: entrega el resultado ahora con ${p.finalTool.name}.` })
    messages.push({ role: 'user', content: blocks })
  }
  throw new HaggoError('El análisis no terminó en el número de vueltas permitido')
}

/** Rule findings follow their detection: created or refreshed while it lasts, resolved when it goes away. */
async function syncRuleFindings(runId: string, detections: Detection[]) {
  const keys = detections.map((d) => `rule:${d.key}`)
  for (const d of detections) {
    const fingerprint = `rule:${d.key}`
    const existing = await prisma.haggoFinding.findFirst({ where: { fingerprint, status: { in: ['new', 'seen'] } }, select: { id: true } })
    if (existing) {
      await prisma.haggoFinding.update({ where: { id: existing.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date(), severity: d.severity, title: d.title } })
      continue
    }
    // Dismissed by the superadmin: stays quiet for 7 days even if the condition goes on
    const dismissed = await prisma.haggoFinding.findFirst({ where: { fingerprint, status: 'dismissed', updatedAt: { gte: new Date(Date.now() - 7 * 24 * H) } }, select: { id: true } })
    if (dismissed) continue
    await prisma.haggoFinding.create({ data: { runId, fingerprint, domain: d.domain, severity: d.severity, title: d.title, body: d.detail, entityType: d.entityType ?? null, entityId: d.entityId ?? null } })
  }
  await prisma.haggoFinding.updateMany({ where: { fingerprint: { startsWith: 'rule:', notIn: keys }, status: { in: ['new', 'seen'] } }, data: { status: 'resolved' } })
}

async function lastRuns(): Promise<LastRuns> {
  const last = (type: RunType) => prisma.haggoRun.findFirst({ where: { type }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }).then((r) => r?.startedAt ?? null)
  const [cycle, daily, weekly] = await Promise.all([last('cycle'), last('daily'), last('weekly')])
  return { cycle, daily, weekly }
}

async function modelFor(cfg: HaggoConfig) {
  return cfg.model || (await getAiSettings()).defaultModel
}

// ─── Cycle ──────────────────────────────────────────────────────────────────

/** `force` (manual "Revisar ahora") calls the model even without anything new. */
export async function runCycle(cfg: HaggoConfig, trigger: string, now = new Date(), force = false) {
  const run = await prisma.haggoRun.create({ data: { type: 'cycle', trigger } })
  const meter = new Meter()
  try {
    const snapshot = await takeSnapshot(now)
    const detections = detect(snapshot)
    const prev = await prisma.haggoRun.findFirst({ where: { type: 'cycle', id: { not: run.id }, detections: { not: Prisma.DbNull } }, orderBy: { startedAt: 'desc' }, select: { detections: true } })
    const novel = force ? detections : novelDetections(detections, (prev?.detections as Array<Pick<Detection, 'key' | 'severity'>> | null) ?? [])
    await syncRuleFindings(run.id, detections)
    await prisma.haggoSettings.update({ where: { id: 'platform' }, data: { lastSnapshot: json(snapshot), lastSnapshotAt: now } })

    let status = 'ok'
    let summary: string
    let output: unknown = null
    const spend = await haggoSpend(cfg, now)
    if (!novel.length && !force) {
      status = 'skipped'
      summary = detections.length ? `Sin novedades: ${detections.length} situaciones ya conocidas.` : 'Sin novedades: todo en orden.'
    } else if (spend.blocked) {
      summary = `Presupuesto de Haggo agotado (${spend.blocked === 'month' ? 'mes' : 'día'}): solo reglas. Nuevo: ${novel.map((d) => d.title).join(' · ')}`
    } else {
      const openFindings = await prisma.haggoFinding.findMany({ where: { status: { in: ['new', 'seen'] }, fingerprint: { not: { startsWith: 'rule:' } } }, orderBy: { lastSeenAt: 'desc' }, take: 20, select: { title: true, severity: true } })
      const input = await think({ kind: 'haggo_cycle', model: await modelFor(cfg), system: await context(), task: cycleTask({ snapshot, detections, novel, openFindings, nowText: nowText(now, cfg.timezone) }), finalTool: ANALYSIS_TOOL, maxTokens: 4000, effort: 'medium' }, meter)
      const analysis = parseAnalysis(input)
      if (!analysis) throw new HaggoError('El análisis no es válido')
      await saveAnalysis(run.id, analysis, detections)
      await prisma.haggoSettings.update({ where: { id: 'platform' }, data: { focus: analysis.focus } })
      summary = analysis.summary
      output = analysis
    }
    await prisma.haggoRun.update({ where: { id: run.id }, data: { status, summary: summary.slice(0, 1000), detections: json(detections.map((d) => ({ key: d.key, severity: d.severity, title: d.title }))), output: json(output), ...meter.data, finishedAt: new Date() } })
    return { status, summary, novel: novel.length, costUsd: meter.cost }
  } catch (err) {
    const message = err instanceof HaggoError ? err.message : err instanceof Error ? err.message : 'Error'
    logger.warn('Cycle failed', { message })
    await prisma.haggoRun.update({ where: { id: run.id }, data: { status: 'error', error: message.slice(0, 1000), ...meter.data, finishedAt: new Date() } }).catch(() => null)
    return { status: 'error', summary: message, novel: 0, costUsd: meter.cost }
  }
}

/** AI findings enrich the rule finding they explain; the rest are new findings of their own. */
async function saveAnalysis(runId: string, analysis: NonNullable<ReturnType<typeof parseAnalysis>>, detections: Detection[]) {
  const ruleKeys = new Set(detections.map((d) => d.key))
  for (const f of analysis.findings) {
    if (f.ruleKey && ruleKeys.has(f.ruleKey)) {
      await prisma.haggoFinding.updateMany({ where: { fingerprint: `rule:${f.ruleKey}`, status: { in: ['new', 'seen'] } }, data: { body: f.body, severity: f.severity, runId } })
      continue
    }
    const fingerprint = `ai:${f.domain}:${f.title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '-').slice(0, 80)}`
    const existing = await prisma.haggoFinding.findFirst({ where: { fingerprint, status: { in: ['new', 'seen'] } }, select: { id: true } })
    if (existing) await prisma.haggoFinding.update({ where: { id: existing.id }, data: { body: f.body, severity: f.severity, occurrences: { increment: 1 }, lastSeenAt: new Date(), runId } })
    else await prisma.haggoFinding.create({ data: { runId, fingerprint, domain: f.domain, severity: f.severity, title: f.title, body: f.body } })
  }
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function runReport(cfg: HaggoConfig, kind: 'daily' | 'weekly', now = new Date()) {
  const run = await prisma.haggoRun.create({ data: { type: kind, trigger: 'schedule' } })
  const meter = new Meter()
  try {
    const since = new Date(now.getTime() - (kind === 'daily' ? 24 : 7 * 24) * H)
    const [snapshot, runs, findings, spend] = await Promise.all([
      takeSnapshot(now),
      prisma.haggoRun.findMany({ where: { startedAt: { gte: since }, status: 'ok', type: 'cycle' }, orderBy: { startedAt: 'asc' }, take: 60, select: { type: true, summary: true, startedAt: true } }),
      prisma.haggoFinding.findMany({ where: { lastSeenAt: { gte: since } }, orderBy: { lastSeenAt: 'desc' }, take: 60, select: { title: true, severity: true, status: true, domain: true } }),
      haggoSpend(cfg, now),
    ])
    if (spend.blocked) {
      const body = `Presupuesto de Haggo agotado: este informe se armó solo con reglas.\n\nSituaciones de ${kind === 'daily' ? 'las últimas 24 horas' : 'la semana'}:\n${findings.map((f) => `- ${f.title} (${f.status})`).join('\n') || '- ninguna'}`
      await prisma.haggoRun.update({ where: { id: run.id }, data: { status: 'ok', summary: 'Informe solo con reglas (presupuesto agotado)', report: body, finishedAt: new Date() } })
      return { status: 'ok', summary: 'Informe solo con reglas', costUsd: 0 }
    }
    const input = await think({ kind: 'haggo_report', model: await modelFor(cfg), system: await context(), task: reportTask({ kind, snapshot, runs, findings, nowText: nowText(now, cfg.timezone) }), finalTool: REPORT_TOOL, maxTokens: 8000, effort: 'high' }, meter)
    const report = parseReport(input)
    if (!report) throw new HaggoError('El informe no es válido')
    await prisma.haggoSettings.update({ where: { id: 'platform' }, data: { focus: report.focus || undefined } })
    await prisma.haggoRun.update({ where: { id: run.id }, data: { status: 'ok', summary: `${report.title}: ${report.summary}`.slice(0, 1000), report: report.body, output: json(report), ...meter.data, finishedAt: new Date() } })
    return { status: 'ok', summary: report.title, costUsd: meter.cost }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    logger.warn('Report failed', { kind, message })
    await prisma.haggoRun.update({ where: { id: run.id }, data: { status: 'error', error: message.slice(0, 1000), ...meter.data, finishedAt: new Date() } }).catch(() => null)
    return { status: 'error', summary: message, costUsd: meter.cost }
  }
}

// ─── Tick ───────────────────────────────────────────────────────────────────

/** Something urgent since the last cycle that should not wait for the schedule. */
export async function checkTriggers(cfg: HaggoConfig, since: Date | null): Promise<string | null> {
  if (!since) return null
  if (cfg.triggers.critical_incident && (await prisma.adminIncident.count({ where: { severity: 'CRITICAL', createdAt: { gt: since } } }))) return 'critical_incident'
  if (cfg.triggers.ai_down && (await prisma.aiProviderState.count({ where: { status: 'down', updatedAt: { gt: since } } }))) return 'ai_down'
  if (cfg.triggers.error_spike && (await prisma.appErrorGroup.count({ where: { resolvedAt: null, lastSeenAt: { gt: since } } })) >= 5) return 'error_spike'
  return null
}

/** Called every 5 minutes: runs what the schedule (or a trigger) says is due, one job set at a time. */
export async function tick(now = new Date()) {
  const cfg = await getHaggoConfig()
  if (!cfg.enabled) return { skipped: 'Haggo está detenido' }
  const out = await withHaggoLock(async () => {
    const last = await lastRuns()
    const due = dueJobs(cfg, last, now)
    const trigger = due.cycle ? 'schedule' : await checkTriggers(cfg, last.cycle ?? null)
    const res: Record<string, unknown> = { due, trigger }
    if (trigger) res.cycle = await runCycle(cfg, trigger, now)
    if (due.daily) res.daily = await runReport(cfg, 'daily', now)
    if (due.weekly) res.weekly = await runReport(cfg, 'weekly', now)
    // Quiet cycles are kept 30 days; reports and cycles with findings stay
    if (Math.random() < 0.02) await prisma.haggoRun.deleteMany({ where: { type: 'cycle', status: 'skipped', startedAt: { lt: new Date(now.getTime() - 30 * 24 * H) } } }).catch(() => null)
    return res
  })
  return out ?? { skipped: 'Otra ejecución de Haggo está en curso' }
}

/** Manual run from the admin ("Revisar ahora", "Generar informe"). */
export async function runNow(type: RunType) {
  const cfg = await getHaggoConfig()
  const out = await withHaggoLock(() => (type === 'cycle' ? runCycle(cfg, 'manual', new Date(), true) : runReport(cfg, type)))
  if (!out) throw new HaggoError('Haggo ya está trabajando; inténtalo en un momento')
  return out
}

export type { Snapshot }
