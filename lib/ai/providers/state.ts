import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { SITE_URL } from '@/lib/marketing/seo'
import { afterError, afterOk, EMPTY_STATE, isDown, type BreakerState, type ProviderStatus } from '@/lib/ai/providers/breaker'
import { REASON_LABEL, type Classification, type FailReason } from '@/lib/ai/providers/classify'
import { PROVIDER_LABEL, PROVIDERS, type ProviderId } from '@/lib/ai/providers/types'

const logger = createLogger('ai-providers')

export type ProviderState = BreakerState & { provider: ProviderId; notifiedAt: Date | null }

const CACHE_MS = 15_000
let cache: { at: number; states: Record<ProviderId, ProviderState> } | null = null

const blank = (provider: ProviderId): ProviderState => ({ ...EMPTY_STATE, provider, notifiedAt: null })

/** One row per provider, cached 15 s so a call does not read the database each time. */
export async function getProviderStates(force = false): Promise<Record<ProviderId, ProviderState>> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.states
  const states = Object.fromEntries(PROVIDERS.map((p) => [p, blank(p)])) as Record<ProviderId, ProviderState>
  try {
    const rows = await prisma.aiProviderState.findMany()
    for (const r of rows) {
      if (!PROVIDERS.includes(r.provider as ProviderId)) continue
      states[r.provider as ProviderId] = { ...r, provider: r.provider as ProviderId, status: r.status as ProviderStatus }
    }
  } catch (err) {
    // Without the table (SQL not run yet) every provider counts as up
    logger.warn('Provider state unavailable', { err: err instanceof Error ? err.message : err })
  }
  cache = { at: Date.now(), states }
  return states
}

export function providerIsDown(states: Record<ProviderId, ProviderState>, provider: ProviderId, now = new Date()) {
  return isDown(states[provider], now)
}

async function save(provider: ProviderId, s: BreakerState, extra: { notifiedAt?: Date | null } = {}) {
  const data = { status: s.status, reason: s.reason, detail: s.detail, downUntil: s.downUntil, failures: s.failures, lastErrorAt: s.lastErrorAt, lastOkAt: s.lastOkAt, ...extra }
  await prisma.aiProviderState.upsert({ where: { provider }, create: { provider, ...data }, update: data })
  if (cache) cache.states[provider] = { ...cache.states[provider], ...s, ...(extra.notifiedAt !== undefined ? { notifiedAt: extra.notifiedAt } : {}) }
}

/** Records a failed plan; on the way to `down` opens an incident and, for credit or key, emails the superadmins once. */
export async function recordProviderError(provider: ProviderId, c: Classification, detail: string) {
  try {
    const states = await getProviderStates()
    const prev = states[provider]
    const { next, transition } = afterError(prev, c, detail)
    if (next === prev) return
    await save(provider, next)
    if (transition === 'down') {
      await openIncident(provider, next)
      if ((c.reason === 'sin_credito' || c.reason === 'clave_invalida') && !prev.notifiedAt) {
        const sent = await emailSuperadmins(provider, c.reason)
        if (sent) await save(provider, next, { notifiedAt: new Date() })
      }
    } else if (next.status === 'down') {
      await touchIncident(provider, next)
    }
  } catch (err) {
    logger.warn('Could not record provider error', { provider, err: err instanceof Error ? err.message : err })
  }
}

export async function recordProviderOk(provider: ProviderId) {
  try {
    const states = await getProviderStates()
    const prev = states[provider]
    const { next, transition, write } = afterOk(prev)
    if (!write) return
    await save(provider, next, transition === 'recovered' || prev.notifiedAt ? { notifiedAt: null } : {})
    if (transition === 'recovered') await resolveIncident(provider)
  } catch (err) {
    logger.warn('Could not record provider ok', { provider, err: err instanceof Error ? err.message : err })
  }
}

/** «Forzar reintento»: the next call tries the provider again. */
export async function resetProvider(provider: ProviderId) {
  await save(provider, { ...(await getProviderStates(true))[provider], status: 'ok', reason: null, detail: null, downUntil: null, failures: 0 })
  await resolveIncident(provider)
}

/** Test only: marks the provider down for a few minutes, so the next calls go to the other one. */
export async function forceProviderDown(provider: ProviderId, minutes: number, by: string) {
  const prev = (await getProviderStates(true))[provider]
  await save(provider, { ...prev, status: 'down', reason: 'caido', detail: `Caída simulada por ${by} (prueba)`, downUntil: new Date(Date.now() + minutes * 60_000), lastErrorAt: new Date() })
}

export function reasonLabel(reason: string | null) {
  return reason ? REASON_LABEL[reason as FailReason] ?? reason : null
}

const incidentType = (provider: ProviderId) => `ai:${provider}`

/**
 * Incidents are visible to every admin: a fixed text with the reason, never the provider's raw error
 * (it stays in IA · Plataforma, superadmin only).
 */
const incidentText = (provider: ProviderId, s: BreakerState) =>
  `${PROVIDER_LABEL[provider]}: ${reasonLabel(s.reason) ?? 'no responde'}. Se salta hasta ${s.downUntil?.toISOString() ?? '—'} y las llamadas van al otro proveedor si está configurado. Detalle en IA · Plataforma.`

async function openIncident(provider: ProviderId, s: BreakerState) {
  const type = incidentType(provider)
  const open = await prisma.adminIncident.findFirst({ where: { type, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) return touchIncident(provider, s)
  await prisma.adminIncident.create({
    data: {
      type, severity: s.reason === 'sin_credito' || s.reason === 'clave_invalida' ? 'CRITICAL' : 'HIGH', status: 'OPEN', source: 'system', route: '/admin/ai-settings',
      title: `IA: ${PROVIDER_LABEL[provider]} ${reasonLabel(s.reason)}`,
      description: incidentText(provider, s),
    },
  })
}

async function touchIncident(provider: ProviderId, s: BreakerState) {
  const open = await prisma.adminIncident.findFirst({ where: { type: incidentType(provider), status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) await prisma.adminIncident.update({ where: { id: open.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date(), description: incidentText(provider, s) } })
}

async function resolveIncident(provider: ProviderId) {
  await prisma.adminIncident.updateMany({ where: { type: incidentType(provider), status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, data: { status: 'RESOLVED', resolvedBy: 'sistema', resolvedAt: new Date() } })
}

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

async function emailSuperadmins(provider: ProviderId, reason: FailReason) {
  const runtime = await getMessagingProviderRuntimeConfig()
  if (!runtime.sendgrid?.active) return false
  const admins = await prisma.user.findMany({ where: { isSuperAdmin: true }, select: { email: true }, take: 5 })
  const to = Array.from(new Set(admins.map((a) => a.email).filter(Boolean)))
  if (!to.length) return false
  const other = provider === 'anthropic' ? 'OpenAI' : 'Claude'
  const title = `${PROVIDER_LABEL[provider]}: ${REASON_LABEL[reason]}`
  const body = [
    `<strong>${escape(title)}</strong>`,
    `Los agentes de IA siguen respondiendo con ${other} si está configurado. Cuando lo resuelvas, la plataforma vuelve sola a ${PROVIDER_LABEL[provider]} en la siguiente llamada, o puedes usar «Forzar reintento».`,
    `<a href="${SITE_URL}/admin/ai-settings">Abrir IA · Plataforma</a>`,
  ].filter(Boolean).join('<br><br>')
  const results = await Promise.all(to.map((email) => sendMessageViaProvider({ channel: 'EMAIL', to: email, subject: `LoHaggo IA: ${title}`.slice(0, 150), body }, runtime).catch(() => ({ ok: false }))))
  return results.some((r) => r.ok)
}
