/**
 * Disconnecting a Facebook / Instagram account leaves its publications without account (the relation is
 * SET NULL) and the marketing agents pointing at an id that no longer exists. When the account is
 * connected again (or diagnosed), this ties everything back: Facebook posts by the Page id in their
 * external id, Instagram ones to the workspace's only Instagram account. Idempotent.
 */
import { graphFetch } from '@/lib/messaging/meta-graph'
import type { ChannelConnection, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('marketing-reconnect')

const LOST = 'La cuenta ya no está conectada'
const DAY = 24 * 3600_000

/** Pure: the agent's chosen ids for one channel, without the ones that no longer exist (and the only account when none is left). */
export function healAccountIds(chosen: string[], existing: string[]) {
  const kept = chosen.filter((id) => existing.includes(id))
  if (!chosen.length || kept.length === chosen.length) return { ids: chosen, stale: false, healed: false }
  if (kept.length) return { ids: kept, stale: true, healed: true }
  return existing.length === 1 ? { ids: existing, stale: true, healed: true } : { ids: chosen, stale: true, healed: false }
}

/** Asks Meta who owns the latest orphaned Instagram post: it must be this account. */
async function sameInstagramAccount(conn: Pick<ChannelConnection, 'id' | 'workspaceId' | 'externalId'>) {
  const sample = await prisma.marketingPublication.findFirst({ where: { channel: 'INSTAGRAM', connectionId: null, externalId: { not: null }, status: 'published', post: { workspaceId: conn.workspaceId } }, orderBy: { publishedAt: 'desc' }, select: { externalId: true } })
  if (!sample?.externalId) return false
  // Loaded here: meta-channels imports this module when an account connects
  const { getConnectionCredentials, requireMetaApp } = await import('@/lib/messaging/meta-channels')
  const full = await prisma.channelConnection.findUnique({ where: { id: conn.id } })
  const token = full ? getConnectionCredentials(full)?.pageAccessToken : null
  if (!token) return false
  const app = await requireMetaApp()
  const d = await graphFetch<{ owner?: { id?: string }; username?: string }>(sample.externalId, { version: app.graphVersion, token, query: { fields: 'owner,username' } }).catch(() => null)
  return Boolean(d && (d.owner?.id === conn.externalId))
}

export async function adoptOrphans(conn: Pick<ChannelConnection, 'id' | 'workspaceId' | 'channel' | 'externalId' | 'meta'>, now = new Date()) {
  const pageId = ((conn.meta as { pageId?: string } | null)?.pageId) || conn.externalId
  let relinked = 0
  if (conn.channel === 'MESSENGER') {
    // Feed posts carry «<pageId>_<postId>»; reels and stories only their own id (left as they are)
    const r = await prisma.marketingPublication.updateMany({ where: { channel: 'FACEBOOK', connectionId: null, externalId: { startsWith: `${pageId}_` }, post: { workspaceId: conn.workspaceId } }, data: { connectionId: conn.id } })
    relinked += r.count
  } else if (conn.channel === 'INSTAGRAM') {
    const igAccounts = await prisma.channelConnection.count({ where: { workspaceId: conn.workspaceId, channel: 'INSTAGRAM' } })
    // Only when Meta confirms a published orphan belongs to this account (a different account must not inherit them)
    if (igAccounts === 1 && (await sameInstagramAccount(conn))) {
      const r = await prisma.marketingPublication.updateMany({ where: { channel: 'INSTAGRAM', connectionId: null, post: { workspaceId: conn.workspaceId } }, data: { connectionId: conn.id } })
      relinked += r.count
    }
  }

  // What failed only because the account was gone (last 2 days) goes back to the queue
  const channel = conn.channel === 'MESSENGER' ? 'FACEBOOK' : 'INSTAGRAM'
  const requeued = await prisma.marketingPublication.updateMany({
    where: { channel, connectionId: conn.id, status: 'failed', lastError: LOST, updatedAt: { gte: new Date(now.getTime() - 2 * DAY) } },
    data: { status: 'scheduled', scheduledAt: new Date(now.getTime() + 2 * 60_000), attempts: 0, lastError: 'Cuenta reconectada; se reintenta' },
  })

  // Agents that chose an account that no longer exists
  const accounts = await prisma.channelConnection.findMany({ where: { workspaceId: conn.workspaceId, channel: conn.channel }, select: { id: true } })
  const existing = accounts.map((a) => a.id)
  const agents = await prisma.marketingAgent.findMany({ where: { workspaceId: conn.workspaceId, status: { not: 'archived' } }, select: { id: true, config: true } })
  let healedAgents = 0
  for (const a of agents) {
    const config = (a.config as Record<string, unknown> | null) ?? {}
    const channels = (config.channels as Record<string, { accountIds?: string[] }> | undefined) ?? {}
    const plan = channels[channel]
    if (!plan?.accountIds) continue
    const h = healAccountIds(plan.accountIds, existing)
    if (!h.healed) continue
    await prisma.marketingAgent.update({ where: { id: a.id }, data: { config: { ...config, channels: { ...channels, [channel]: { ...plan, accountIds: h.ids } } } as Prisma.InputJsonValue } })
    healedAgents++
  }
  if (relinked || requeued.count || healedAgents) logger.info('Reconnected account adopted its publications', { connectionId: conn.id, relinked, requeued: requeued.count, healedAgents })
  return { relinked, requeued: requeued.count, healedAgents }
}
