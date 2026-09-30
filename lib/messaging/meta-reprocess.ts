/**
 * Meta does not retry a webhook once it got a 200, and we answer 200 before processing (in after()). So every
 * payload is stored first as «pendiente de procesar» (status ERROR until it is done) and this sweep, run by the
 * meta-pending cron, processes again what failed or was cut off. Processing is idempotent: messages are keyed by
 * their Meta id, so a second pass never duplicates them.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import type { MetaChannel } from '@/lib/messaging/meta-graph'
import { processMetaWebhookPayload, type MetaWebhookPayload } from '@/lib/messaging/meta-inbound'

const logger = createLogger('meta-reprocess')

export const PENDING_DETAIL = 'Recibido; pendiente de procesar'
export const MAX_REPROCESS = 3
const RETRY_PREFIX = /^Reintento (\d+)\/3 · /

/** Stored before processing; deleted when processing finishes (the per-entry rows tell what happened). */
export async function storePendingWebhook(channel: MetaChannel, payload: MetaWebhookPayload) {
  return prisma.webhookEvent.create({ data: { channel, status: 'ERROR', detail: PENDING_DETAIL, payload: payload as unknown as Prisma.InputJsonValue } }).catch(() => null)
}

export async function settlePendingWebhook(id: string | null | undefined, error?: string | null) {
  if (!id) return
  if (!error) await prisma.webhookEvent.delete({ where: { id } }).catch(() => null)
  else await prisma.webhookEvent.update({ where: { id }, data: { detail: `Falló: ${error}`.slice(0, 500) } }).catch(() => null)
}

const attemptsOf = (detail: string | null) => Number(RETRY_PREFIX.exec(detail ?? '')?.[1] ?? 0)

/** A stored payload back to a full webhook payload (failed entries were stored alone). */
export function asPayload(channel: MetaChannel, stored: unknown): MetaWebhookPayload | null {
  if (!stored || typeof stored !== 'object') return null
  const o = stored as Record<string, unknown>
  if (Array.isArray(o.entry)) return o as unknown as MetaWebhookPayload
  if (typeof o.id === 'string' || Array.isArray(o.messaging) || Array.isArray(o.changes) || Array.isArray(o.standby)) {
    return { object: channel === 'INSTAGRAM' ? 'instagram' : 'page', entry: [o] } as unknown as MetaWebhookPayload
  }
  return null
}

/** Payloads that failed (or never finished) between 2 minutes and 24 hours ago, at most MAX_REPROCESS tries each. */
export async function reprocessFailedMetaWebhooks(now = new Date()) {
  const rows = await prisma.webhookEvent.findMany({
    where: {
      channel: { in: ['MESSENGER', 'INSTAGRAM'] },
      status: 'ERROR',
      payload: { not: undefined },
      createdAt: { gte: new Date(now.getTime() - 24 * 3600_000), lte: new Date(now.getTime() - 2 * 60_000) },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  let done = 0
  let failed = 0
  for (const row of rows) {
    const tries = attemptsOf(row.detail)
    if (tries >= MAX_REPROCESS) continue
    const channel = row.channel as MetaChannel
    const payload = asPayload(channel, row.payload)
    if (!payload) continue
    const base = (row.detail ?? '').replace(RETRY_PREFIX, '')
    try {
      await processMetaWebhookPayload(channel, payload)
      // The new pass logged its own rows: this one is closed
      await prisma.webhookEvent.update({ where: { id: row.id }, data: { status: 'IGNORED', detail: `Reprocesado (intento ${tries + 1}) · ${base}`.slice(0, 500) } })
      done++
    } catch (err) {
      failed++
      await prisma.webhookEvent.update({ where: { id: row.id }, data: { detail: `Reintento ${tries + 1}/3 · ${err instanceof Error ? err.message : 'error'} · ${base}`.slice(0, 500) } }).catch(() => null)
      logger.warn('Meta webhook reprocess failed', { id: row.id, tries: tries + 1 })
    }
  }
  return { candidates: rows.length, done, failed }
}
