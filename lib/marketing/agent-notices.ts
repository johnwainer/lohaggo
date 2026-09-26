import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { SITE_URL } from '@/lib/marketing/seo'

const logger = createLogger('marketing-agent-notices')

export type NoticeType = 'approval_needed' | 'opt_out_window' | 'published' | 'failed' | 'budget' | 'learning' | 'ideas' | 'degraded' | 'editorial_review'

/** Worth an email; the rest stay in the module's bell. */
const EMAIL_TYPES: NoticeType[] = ['approval_needed', 'opt_out_window', 'failed', 'budget', 'learning', 'ideas', 'degraded', 'editorial_review']

export const agentUrl = (agentId: string) => `/admin/marketing?agente=${agentId}`
export const postUrl = (postId: string) => `/admin/marketing/posts/${postId}`

/** People who approve and publish in the workspace: owners and members with marketing.publish. */
async function recipients(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, OR: [{ role: 'OWNER' }, { permissions: { has: 'marketing.publish' } }] },
    select: { user: { select: { email: true } } },
    take: 10,
  })
  return Array.from(new Set(members.map((m) => m.user.email).filter(Boolean)))
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Tells the team something (in the app, and by email if the agent is set to). A `dedupeKey` makes it
 * once-only: the same key again does nothing. Never throws: a notice must not break the agent's run.
 */
export async function notify(agent: { id: string; workspaceId: string; email: boolean }, n: { type: NoticeType; title: string; body?: string | null; url?: string | null; postId?: string | null; dedupeKey?: string | null }) {
  try {
    if (n.dedupeKey && (await prisma.marketingAgentNotice.findUnique({ where: { dedupeKey: n.dedupeKey }, select: { id: true } }))) return null
    const notice = await prisma.marketingAgentNotice.create({
      data: { agentId: agent.id, workspaceId: agent.workspaceId, postId: n.postId ?? null, type: n.type, title: n.title.slice(0, 200), body: n.body?.slice(0, 1000) ?? null, url: n.url ?? null, dedupeKey: n.dedupeKey ?? null, channelsSent: ['in_app'] },
    })
    if (agent.email && EMAIL_TYPES.includes(n.type)) {
      const sent = await sendEmail(agent.workspaceId, n)
      if (sent) await prisma.marketingAgentNotice.update({ where: { id: notice.id }, data: { channelsSent: ['in_app', 'email'] } })
    }
    return notice
  } catch (err) {
    // A concurrent run created the same once-only notice first
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null
    logger.warn('Notice failed', { agentId: agent.id, type: n.type, err: err instanceof Error ? err.message : err })
    return null
  }
}

async function sendEmail(workspaceId: string, n: { title: string; body?: string | null; url?: string | null }) {
  const runtime = await getMessagingProviderRuntimeConfig()
  if (!runtime.sendgrid?.active) return false
  const to = await recipients(workspaceId)
  if (!to.length) return false
  const link = n.url ? `${SITE_URL}${n.url}` : null
  const body = [
    `<strong>${escape(n.title)}</strong>`,
    n.body ? escape(n.body).replace(/\n/g, '<br>') : '',
    link ? `<a href="${link}">Abrir en LoHaggo</a>` : '',
    '<span style="color:#888">Agente de marketing de LoHaggo. Puedes apagar estos correos en la configuración del agente.</span>',
  ].filter(Boolean).join('<br><br>')
  const results = await Promise.all(to.map((email) => sendMessageViaProvider({ channel: 'EMAIL', to: email, subject: `Agente de marketing: ${n.title}`.slice(0, 150), body }, runtime).catch(() => ({ ok: false }))))
  return results.some((r) => r.ok)
}
