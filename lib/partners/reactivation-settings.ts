/**
 * Reads and saves the partner reactivation config (PartnerReactivationSettings, one row). Reads are cached
 * 30 s per instance and never fail: without the table (SQL not applied yet) or the row, the defaults apply,
 * so the campaign runs with them from the first deploy.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { DEFAULT_REACTIVATION_CONFIG, sanitizeReactivationConfig, type ReactivationConfig } from '@/lib/partners/reactivation-core'

const logger = createLogger('partner-reactivation-settings')
const TTL_MS = 30_000
let cache: { at: number; value: ReactivationConfig; updatedAt: Date | null; updatedByEmail: string | null } | null = null

type Row = { config: unknown; updatedAt: Date; updatedByEmail: string | null }
type Table = {
  findUnique: (args: unknown) => Promise<Row | null>
  upsert: (args: unknown) => Promise<Row>
}
/** The model may be missing from an older generated client: treated like a missing table. */
const table = (): Table | null => (prisma as unknown as { partnerReactivationSettings?: Table }).partnerReactivationSettings ?? null

export async function getReactivationSettingsMeta() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache
  try {
    const t = table()
    const row = t ? await t.findUnique({ where: { id: 'platform' }, select: { config: true, updatedAt: true, updatedByEmail: true } }) : null
    cache = { at: Date.now(), value: sanitizeReactivationConfig(row?.config ?? null), updatedAt: row?.updatedAt ?? null, updatedByEmail: row?.updatedByEmail ?? null }
  } catch (err) {
    logger.warn('Partner reactivation settings unavailable, using defaults', { err: err instanceof Error ? err.message : String(err) })
    cache = { at: Date.now(), value: sanitizeReactivationConfig(null), updatedAt: null, updatedByEmail: null }
  }
  return cache
}

export async function getReactivationSettings(): Promise<ReactivationConfig> {
  return (await getReactivationSettingsMeta()).value
}

export async function saveReactivationSettings(raw: unknown, byEmail: string | null): Promise<ReactivationConfig> {
  const config = sanitizeReactivationConfig(raw)
  const t = table()
  if (!t) throw new Error('PartnerReactivationSettings no existe en el cliente de Prisma')
  const row = await t.upsert({
    where: { id: 'platform' },
    create: { id: 'platform', config, updatedByEmail: byEmail },
    update: { config, updatedByEmail: byEmail },
    select: { config: true, updatedAt: true, updatedByEmail: true },
  })
  cache = { at: Date.now(), value: config, updatedAt: row.updatedAt, updatedByEmail: row.updatedByEmail }
  return config
}

export { DEFAULT_REACTIVATION_CONFIG }
