/**
 * Reads and saves the inbox settings (InboxSettings, one row). Reads are cached 30 s per instance and never
 * fail: without the table (SQL not applied yet) or the row, the defaults apply.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { DEFAULT_INBOX_CONFIG, sanitizeInboxConfig, type InboxConfig } from '@/lib/inbox/settings-core'

const logger = createLogger('inbox-settings')
const TTL_MS = 30_000
let cache: { at: number; value: InboxConfig } | null = null

export async function getInboxSettings(): Promise<InboxConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  try {
    const row = await prisma.inboxSettings.findUnique({ where: { id: 'platform' }, select: { config: true } })
    const value = sanitizeInboxConfig(row?.config ?? null)
    cache = { at: Date.now(), value }
    return value
  } catch (err) {
    logger.warn('Inbox settings unavailable, using defaults', { err: err instanceof Error ? err.message : String(err) })
    const value = sanitizeInboxConfig(null)
    cache = { at: Date.now(), value }
    return value
  }
}

export async function saveInboxSettings(raw: unknown, byEmail: string | null): Promise<InboxConfig> {
  const config = sanitizeInboxConfig(raw)
  await prisma.inboxSettings.upsert({
    where: { id: 'platform' },
    create: { id: 'platform', config: config as object, updatedByEmail: byEmail },
    update: { config: config as object, updatedByEmail: byEmail },
  })
  cache = { at: Date.now(), value: config }
  return config
}

export { DEFAULT_INBOX_CONFIG }
