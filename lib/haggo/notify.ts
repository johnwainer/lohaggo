import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { SITE_URL } from '@/lib/marketing/seo'
import { getHaggoConfig } from '@/lib/haggo/store'
import type { Notice } from '@/lib/haggo/config'

const logger = createLogger('haggo-notify')
const H = 3600_000
/** Notice rows live in HaggoMemory with this kind; prompts never read them. */
export const NOTICE_KIND = 'notice'

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Approvals are grouped: at most one email per 2-hour window. */
export const approvalsKey = (now = new Date()) => `approvals:${Math.floor(now.getTime() / (2 * H))}`

/** Body of the email: title, lines (plain text, escaped here), a link to Haggo. */
export function renderNotice(n: { title: string; lines: string[]; path: string }) {
  return [
    `<strong>${escape(n.title)}</strong>`,
    ...n.lines.map((l) => escape(l).replace(/\n/g, '<br>')),
    `<a href="${SITE_URL}${n.path}">Abrir Haggo</a>`,
    '<span style="color:#888">Haggo, el agente maestro de LoHaggo. Puedes elegir qué avisos recibir en Haggo → Ajustes.</span>',
  ].join('<br><br>')
}

/**
 * Emails the platform superadmins once per `dedupeKey` (if that notice is on and SendGrid is active).
 * Never throws: a notice must not break a cycle.
 */
export async function notify(kind: Notice, dedupeKey: string, n: { title: string; lines: string[]; path?: string }) {
  try {
    const cfg = await getHaggoConfig()
    if (!cfg.notify[kind]) return false
    if (await prisma.haggoMemory.findFirst({ where: { kind: NOTICE_KIND, key: dedupeKey }, select: { id: true } })) return false
    const runtime = await getMessagingProviderRuntimeConfig()
    if (!runtime.sendgrid?.active) return false
    // The addresses set in Ajustes, or the platform superadmins when none
    const to = cfg.notifyTo.length ? cfg.notifyTo : Array.from(new Set((await prisma.user.findMany({ where: { isSuperAdmin: true, isActive: true }, select: { email: true }, take: 5 })).map((a) => a.email).filter(Boolean)))
    if (!to.length) return false
    // Recorded before sending: two servers cannot both send the same notice
    await prisma.haggoMemory.create({ data: { kind: NOTICE_KIND, key: dedupeKey, content: n.title.slice(0, 300) } })
    const body = renderNotice({ title: n.title, lines: n.lines, path: n.path ?? '/admin/haggo' })
    const results = await Promise.all(to.map((email) => sendMessageViaProvider({ channel: 'EMAIL', to: email, subject: `Haggo: ${n.title}`.slice(0, 150), body }, runtime).catch(() => ({ ok: false }))))
    // Old notices go after 30 days
    if (Math.random() < 0.05) await prisma.haggoMemory.deleteMany({ where: { kind: NOTICE_KIND, createdAt: { lt: new Date(Date.now() - 30 * 24 * H) } } }).catch(() => null)
    return results.some((r) => r.ok)
  } catch (err) {
    logger.warn('Notice failed', { kind, err: err instanceof Error ? err.message : err })
    return false
  }
}

/** New proposals waiting for the superadmin, grouped in one email per window. */
export async function notifyApprovals(now = new Date()) {
  const pending = await prisma.haggoAction.findMany({ where: { status: 'proposed' }, orderBy: { createdAt: 'desc' }, take: 10, select: { expectedImpact: true, risk: true, createdAt: true } })
  const fresh = pending.filter((p) => now.getTime() - p.createdAt.getTime() < 2 * H)
  if (!fresh.length) return false
  const total = await prisma.haggoAction.count({ where: { status: 'proposed' } })
  return notify('approvals', approvalsKey(now), {
    title: `${total} ${total === 1 ? 'propuesta espera' : 'propuestas esperan'} tu aprobación`,
    lines: [pending.slice(0, 5).map((p) => `• ${p.expectedImpact ?? 'Acción'} (riesgo ${({ low: 'bajo', medium: 'medio', high: 'alto', max: 'máximo' } as Record<string, string>)[p.risk] ?? p.risk})`).join('\n')],
    path: '/admin/haggo?tab=proposals',
  })
}
