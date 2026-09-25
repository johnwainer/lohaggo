import { prisma } from '@/lib/prisma'
import { getAiSettings } from '@/lib/ai/settings'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { getImageSettings } from '@/lib/marketing/images'
import { getGa4Settings } from '@/lib/analytics/ga4'
import { CRON_JOBS, JOB_LABEL } from '@/lib/system/cron'
import { cronHealth, type CronHealth } from '@/lib/system/core'

const H = 3600_000
export type Level = 'ok' | 'warning' | 'error' | 'off'
export type Integration = { key: string; name: string; level: Level; detail: string }

/** Scheduled jobs: last run, health, failures and duration over 24 h. */
export async function cronStatus(now = new Date()) {
  const since = new Date(now.getTime() - 24 * H)
  const [recent, stats] = await Promise.all([
    Promise.all(CRON_JOBS.map((j) => prisma.cronRun.findMany({ where: { job: j.key }, orderBy: { startedAt: 'desc' }, take: 3, select: { status: true, startedAt: true, durationMs: true, error: true, summary: true } }))),
    prisma.cronRun.groupBy({ by: ['job', 'status'], where: { startedAt: { gte: since } }, _count: { _all: true }, _avg: { durationMs: true } }),
  ])
  return CRON_JOBS.map((j, i) => {
    const runs = recent[i]
    const mine = stats.filter((s) => s.job === j.key)
    const count = (status: string) => mine.find((s) => s.status === status)?._count._all ?? 0
    const lastError = runs.find((r) => r.status === 'error')
    return {
      key: j.key, label: JOB_LABEL[j.key] ?? j.key, path: j.path, schedule: j.schedule, everyMs: j.everyMs,
      health: cronHealth(runs, j.everyMs, now) as CronHealth,
      lastRunAt: runs[0]?.startedAt ?? null, lastDurationMs: runs.find((r) => r.durationMs != null)?.durationMs ?? null, lastSummary: runs.find((r) => r.status === 'ok')?.summary ?? null,
      lastError: lastError?.error ?? null, lastErrorAt: lastError?.startedAt ?? null,
      runs24h: count('ok') + count('error'), failures24h: count('error'),
      avgMs: Math.round(mine.reduce((a, s) => a + (s._avg.durationMs ?? 0) * s._count._all, 0) / Math.max(1, mine.reduce((a, s) => a + s._count._all, 0))) || null,
    }
  })
}

/** Each external service the platform depends on: configured, and working lately. */
export async function integrations(now = new Date()): Promise<Integration[]> {
  const since = new Date(now.getTime() - 24 * H)
  const t0 = Date.now()
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  const dbMs = Date.now() - t0
  const [ai, msg, img, ga4, channels, lastAi, deliveries, lastPayment, webhookErrors] = await Promise.all([
    getAiSettings().catch(() => null),
    getMessagingProviderRuntimeConfig().catch(() => null),
    getImageSettings().catch(() => null),
    getGa4Settings().catch(() => null),
    prisma.channelConnection.findMany({ where: { enabled: true }, select: { name: true, channel: true, status: true, lastError: true, capabilities: true } }),
    prisma.aiCall.findFirst({ where: { provider: 'anthropic' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.messagingDelivery.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    prisma.payment.findFirst({ where: { status: 'APPROVED', mercadopagoId: { not: null } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    prisma.webhookEvent.count({ where: { createdAt: { gte: since }, status: { not: 'OK' } } }).catch(() => 0),
  ])
  const ago = (d?: Date | null) => (d ? `${Math.max(1, Math.round((now.getTime() - d.getTime()) / 60_000))} min` : null)
  const agoLabel = (d?: Date | null) => {
    if (!d) return 'sin uso registrado'
    const m = Math.round((now.getTime() - d.getTime()) / 60_000)
    return m < 60 ? `último uso hace ${m} min` : m < 1440 ? `último uso hace ${Math.round(m / 60)} h` : `último uso hace ${Math.round(m / 1440)} d`
  }
  const brokenChannels = channels.filter((c) => c.status === 'ERROR' || (c.capabilities as { tokenHealth?: { valid?: boolean } } | null)?.tokenHealth?.valid === false)
  const failed = deliveries.find((d) => d.status === 'FAILED')?._count._all ?? 0
  const sent = deliveries.reduce((a, d) => a + d._count._all, 0)
  const out: Integration[] = [
    { key: 'db', name: 'Base de datos', level: !dbOk ? 'error' : dbMs > 1500 ? 'warning' : 'ok', detail: dbOk ? `responde en ${dbMs} ms` : 'no responde' },
    { key: 'anthropic', name: 'IA (Anthropic)', level: !ai?.anthropicKey ? 'error' : 'ok', detail: ai?.anthropicKey ? `${ai.defaultModel} · ${agoLabel(lastAi?.createdAt)}` : 'falta la clave en IA · Plataforma' },
    { key: 'meta', name: 'Canales de Meta (FB, IG, Messenger)', level: !channels.length ? 'off' : brokenChannels.length ? 'error' : 'ok', detail: !channels.length ? 'sin cuentas conectadas' : brokenChannels.length ? `${brokenChannels.map((c) => c.name).join(', ')}: reconectar` : `${channels.length} cuentas activas` },
    { key: 'whatsapp', name: 'WhatsApp (Meta / Twilio)', level: msg?.metaWhatsApp.active || msg?.twilio.active ? 'ok' : 'off', detail: msg?.metaWhatsApp.active ? 'API de WhatsApp de Meta activa' : msg?.twilio.active ? 'Twilio activo' : 'sin proveedor activo' },
    { key: 'email', name: 'Correo (SendGrid)', level: msg?.sendgrid.active ? 'ok' : 'off', detail: msg?.sendgrid.active ? 'activo' : 'no configurado: los avisos solo llegan dentro de la app' },
    { key: 'deliveries', name: 'Envíos de mensajes (24 h)', level: !sent ? 'off' : failed / sent > 0.2 ? 'error' : failed ? 'warning' : 'ok', detail: sent ? `${sent} envíos, ${failed} fallidos` : 'sin envíos en 24 h' },
    { key: 'mercadopago', name: 'Pagos (MercadoPago)', level: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'ok' : 'error', detail: process.env.MERCADOPAGO_ACCESS_TOKEN ? `configurado · último pago aprobado ${lastPayment ? `hace ${ago(lastPayment.updatedAt)}` : 'sin registros'}` : 'falta MERCADOPAGO_ACCESS_TOKEN' },
    { key: 'cloudinary', name: 'Imágenes (Cloudinary)', level: process.env.CLOUDINARY_API_KEY && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? 'ok' : 'error', detail: process.env.CLOUDINARY_API_KEY ? 'configurado' : 'faltan las claves de Cloudinary' },
    { key: 'pexels', name: 'Fotos (Pexels) e IA de imágenes', level: img?.keys.pexels ? 'ok' : 'warning', detail: `${img?.keys.pexels ? 'Pexels activo' : 'sin clave de Pexels'} · IA: ${img?.provider && img.provider !== 'none' ? img.provider : 'no configurada'}` },
    { key: 'push', name: 'Notificaciones push', level: process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'ok' : 'warning', detail: process.env.VAPID_PRIVATE_KEY ? 'configuradas' : 'faltan las claves VAPID' },
    { key: 'ga4', name: 'Google Analytics en el admin', level: ga4?.propertyId && ga4.account ? 'ok' : 'off', detail: ga4?.propertyId && ga4.account ? `propiedad ${ga4.propertyId}` : 'no conectado (Analítica → Tráfico web)' },
    { key: 'webhooks', name: 'Webhooks de Meta y Twilio (24 h)', level: webhookErrors > 20 ? 'error' : webhookErrors ? 'warning' : 'ok', detail: webhookErrors ? `${webhookErrors} eventos con error o ignorados` : 'sin errores' },
    { key: 'cron-secret', name: 'Tareas automáticas autorizadas', level: process.env.CRON_SECRET ? 'ok' : 'error', detail: process.env.CRON_SECRET ? 'CRON_SECRET configurado' : 'falta CRON_SECRET: ninguna tarea automática corre' },
  ]
  return out
}

/** Everything Salud del sistema shows. */
export async function systemOverview(now = new Date()) {
  const since = new Date(now.getTime() - 24 * H)
  const [crons, services, errors, errors24h, webhooks, webhookErrors, security, blocked] = await Promise.all([
    cronStatus(now),
    integrations(now),
    prisma.appErrorGroup.findMany({ where: { resolvedAt: null }, orderBy: { lastSeenAt: 'desc' }, take: 40 }),
    prisma.appErrorGroup.count({ where: { resolvedAt: null, lastSeenAt: { gte: since } } }),
    prisma.webhookEvent.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    prisma.webhookEvent.findMany({ where: { status: { not: 'OK' } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, channel: true, status: true, detail: true, createdAt: true } }).catch(() => []),
    prisma.securityEvent.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.blockedIp.count({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }).catch(() => 0),
  ])
  const cronProblems = crons.filter((c) => c.health === 'failing' || c.health === 'late' || c.health === 'stuck')
  const serviceProblems = services.filter((s) => s.level === 'error')
  const status: 'ok' | 'warning' | 'error' = serviceProblems.some((s) => s.key === 'db') || cronProblems.some((c) => c.health === 'failing') ? 'error' : cronProblems.length || serviceProblems.length || errors24h ? 'warning' : 'ok'
  return {
    generatedAt: now.toISOString(),
    status,
    crons,
    services,
    errors: errors.map((e) => ({ id: e.id, source: e.source, context: e.context, message: e.message, route: e.route, count: e.count, firstSeenAt: e.firstSeenAt, lastSeenAt: e.lastSeenAt, sample: e.sample })),
    errors24h,
    webhooks: { byChannel: webhooks.map((w) => ({ channel: w.channel, status: w.status, n: w._count._all })), recentErrors: webhookErrors },
    security: { events24h: security, blockedIps: blocked },
    problems: { crons: cronProblems.length, services: serviceProblems.length },
  }
}

/** For the dashboard: jobs failing or late, and integrations down. Light: no external calls. */
export async function systemAlerts(now = new Date()) {
  const crons = await cronStatus(now).catch(() => [])
  const noHistory = crons.every((c) => c.health === 'never')
  return {
    // Before the first recorded run (right after deploying) nothing is "late" yet
    cronsFailing: noHistory ? 0 : crons.filter((c) => c.health === 'failing' || c.health === 'stuck').length,
    cronsLate: noHistory ? 0 : crons.filter((c) => c.health === 'late').length,
    errorsLastHour: await prisma.appErrorGroup.count({ where: { resolvedAt: null, lastSeenAt: { gte: new Date(now.getTime() - H) } } }).catch(() => 0),
  }
}
