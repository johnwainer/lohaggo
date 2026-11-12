import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import vercelConfig from '@/vercel.json'
import { cronInterval, jobKey, shouldOpenIncident } from '@/lib/system/core'

const logger = createLogger('cron-run')

/** Scheduled jobs as Vercel runs them (vercel.json is the source of truth). */
export const CRON_JOBS = (vercelConfig.crons ?? []).map((c) => ({ key: jobKey(c.path), path: c.path, schedule: c.schedule, everyMs: cronInterval(c.schedule) }))

export const JOB_LABEL: Record<string, string> = {
  'pwa-adoption-alerts': 'Alertas de adopción de la app',
  automations: 'Automatizaciones de mensajes',
  'admin-messaging-run-scheduled': 'Campañas de mensajería programadas',
  'payment-reminders': 'Recordatorios de pago',
  'notification-reminders': 'Recordatorios de reservas y calificaciones',
  'meta-pending': 'Mensajes pendientes de Meta',
  'ai-maintenance': 'Mantenimiento de IA (conocimiento y reenganche)',
  copilot: 'Copiloto de la bandeja',
  publisher: 'Publicador de redes y blog',
  'marketing-metrics': 'Métricas de publicaciones',
  'channel-health': 'Salud de tokens de canales',
  'marketing-agent': 'Agente de marketing',
  haggo: 'Haggo (agente maestro)',
  'request-lifecycle': 'Solicitudes: reenvío sin propuestas y vencimiento',
  'wa-daily': 'Plantillas de WhatsApp por tiempo y bienvenida a clientes',
}

async function trackIncident(job: string, ok: boolean, error: string | null) {
  const type = `cron:${job}`
  const open = await prisma.adminIncident.findFirst({ where: { type, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, orderBy: { createdAt: 'desc' } })
  if (ok) {
    if (open) await prisma.adminIncident.update({ where: { id: open.id }, data: { status: 'RESOLVED', resolvedBy: 'sistema', resolvedAt: new Date() } })
    return
  }
  const recent = await prisma.cronRun.findMany({ where: { job }, orderBy: { startedAt: 'desc' }, take: 3, select: { status: true } })
  if (!shouldOpenIncident(recent)) return
  if (open) {
    await prisma.adminIncident.update({ where: { id: open.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date(), description: error?.slice(0, 1000) ?? open.description } })
    return
  }
  await prisma.adminIncident.create({
    data: { type, severity: 'HIGH', status: 'OPEN', title: `Falla la tarea automática: ${JOB_LABEL[job] ?? job}`, description: error?.slice(0, 1000) ?? null, source: 'system', route: CRON_JOBS.find((j) => j.key === job)?.path ?? null },
  })
}

export const DEFAULT_MAX_DURATION_S = 300

/** A run still «running» after the route's maxDuration + 60 s was killed by the platform. */
export const staleAfterMs = (maxDurationS = DEFAULT_MAX_DURATION_S) => (maxDurationS + 60) * 1000

const timeoutType = (job: string) => `cron:timeout:${job}`

/**
 * Marks the runs killed by the platform as errors and opens one incident per job. A run counts only if its own row is
 * still «running» past ITS route's maxDuration + 60 s and was never finished (no finishedAt/durationMs). Candidates are
 * read first and flipped by id with the «still running» condition repeated, so a run that finishes between the read and
 * the write (or another reaper that got there first) is never reported: the incident uses the rows really changed.
 */
export async function reapStaleRuns(job: string, maxDurationS = DEFAULT_MAX_DURATION_S, now = Date.now()) {
  const cutoff = new Date(now - staleAfterMs(maxDurationS))
  const candidates = await prisma.cronRun.findMany({
    where: { job, status: 'running', finishedAt: null, durationMs: null, startedAt: { lt: cutoff } },
    select: { id: true, startedAt: true },
    orderBy: { startedAt: 'asc' },
    take: 50,
  })
  if (!candidates.length) return 0
  const { count } = await prisma.cronRun.updateMany({
    where: { id: { in: candidates.map((c) => c.id) }, job, status: 'running', finishedAt: null, durationMs: null, startedAt: { lt: cutoff } },
    data: { status: 'error', finishedAt: new Date(now), error: 'timeout' },
  })
  if (!count) return 0
  const type = timeoutType(job)
  const detail = `Ejecución(es) ${candidates.slice(0, 5).map((c) => `${c.id} (inició ${c.startedAt.toISOString()})`).join(', ')}; maxDuration de la ruta: ${maxDurationS} s (límite de corte ${maxDurationS + 60} s); detectada ${new Date(now).toISOString()}.`
  const open = await prisma.adminIncident.findFirst({ where: { type, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) {
    await prisma.adminIncident.update({ where: { id: open.id }, data: { occurrences: { increment: count }, lastSeenAt: new Date(now), description: detail.slice(0, 1000) } })
  } else {
    const { openIncident } = await import('@/lib/ops/platform-ops')
    await openIncident({
      type, severity: 'HIGH', source: 'system', route: CRON_JOBS.find((j) => j.key === job)?.path ?? null,
      title: `La tarea automática se cortó por tiempo: ${JOB_LABEL[job] ?? job}`,
      description: `La ejecución superó ${maxDurationS} s y la plataforma la cortó antes de terminar. El trabajo pendiente sigue en la próxima ejecución; si se repite, hay que dividir la tarea. ${detail}`,
    })
  }
  return count
}

/**
 * Closes our row. A transient DB failure here used to leave a finished run «running» until the reaper reported it as a
 * platform timeout, so the write is retried before giving up.
 */
async function finishRun(id: string, f: { status: 'ok' | 'error'; durationMs: number; summary: unknown; error: string | null }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.cronRun.update({ where: { id }, data: { status: f.status, finishedAt: new Date(), durationMs: f.durationMs, summary: (f.summary ?? undefined) as never, error: f.error } })
      return true
    } catch (err) {
      logger.warn(`Cron run ${id} could not be closed (attempt ${attempt + 1})`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
    }
  }
  return false
}

async function resolveTimeoutIncident(job: string) {
  const open = await prisma.adminIncident.findFirst({ where: { type: timeoutType(job), status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) await prisma.adminIncident.update({ where: { id: open.id }, data: { status: 'RESOLVED', resolvedBy: 'sistema', resolvedAt: new Date() } })
}

/**
 * Overlap lock on CronRun rows: another run of the same job still «running» and younger than the stale
 * window means this one skips. After creating our row we re-check that no older live run exists, so two
 * runs that start together do not both proceed (the later one gives up). Only a live run that sorts BEFORE ours counts, so two simultaneous invocations cannot both back off.
 */
export async function acquireCronRun(job: string, maxDurationS = DEFAULT_MAX_DURATION_S, now = Date.now()): Promise<{ run: { id: string } | null; skipped: boolean }> {
  const since = new Date(now - staleAfterMs(maxDurationS))
  const live = await prisma.cronRun.findFirst({ where: { job, status: 'running', startedAt: { gte: since } }, select: { id: true } })
  if (live) return { run: null, skipped: true }
  const run = await prisma.cronRun.create({ data: { job } }).catch(() => null)
  if (!run) return { run: null, skipped: false }
  const older = await prisma.cronRun.findFirst({ where: { job, status: 'running', startedAt: { gte: since }, id: { not: run.id }, OR: [{ startedAt: { lt: run.startedAt } }, { startedAt: run.startedAt, id: { lt: run.id } }] }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  if (older) {
    await prisma.cronRun.delete({ where: { id: run.id } }).catch(() => null)
    return { run: null, skipped: true }
  }
  return { run, skipped: false }
}

/**
 * Wraps a cron handler: authorizes with CRON_SECRET (fails closed), refuses to overlap a run of the same job
 * that is still alive, records the run with its duration and summary, makes killed runs visible (error
 * «timeout» + incident) and opens an incident after two failures in a row (closed by the next success).
 */
export function cronRoute(job: string, handler: (request: NextRequest) => Promise<Response>, opts: { maxDuration?: number } = {}) {
  const maxDuration = opts.maxDuration ?? DEFAULT_MAX_DURATION_S
  return async (request: NextRequest) => {
    const secret = process.env.CRON_SECRET
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 503 })
    if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const started = Date.now()
    await reapStaleRuns(job, maxDuration).catch(() => null)
    const { run, skipped } = await acquireCronRun(job, maxDuration).catch(() => ({ run: null, skipped: false }))
    if (skipped) {
      logger.warn(`Cron ${job} skipped: the previous run is still going`)
      return NextResponse.json({ ok: true, skipped: 'overlap' })
    }
    let res: Response
    try {
      res = await handler(request)
    } catch (err) {
      logger.error(`Cron ${job} crashed`, err)
      res = NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 500 })
    }
    const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null
    const ok = res.status < 400 && body?.ok !== false
    const error = ok ? null : String(body?.error ?? `HTTP ${res.status}`).slice(0, 1000)
    if (run) {
      const text = body ? JSON.stringify(body, (_k, v) => (typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}…` : v)) : null
      const summary = text ? (text.length <= 4000 ? JSON.parse(text) : { truncated: true, preview: text.slice(0, 1000) }) : null
      await finishRun(run.id, { status: ok ? 'ok' : 'error', durationMs: Date.now() - started, summary, error })
      await trackIncident(job, ok, error).catch(() => null)
      if (ok) await resolveTimeoutIncident(job).catch(() => null)
      // Keep 14 days of history
      if (Math.random() < 0.02) await prisma.cronRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 14 * 24 * 3600_000) } } }).catch(() => null)
    }
    return res
  }
}
