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
    // Only a missing table (SQL not applied yet) runs on the defaults; any other read error stops the campaign
    const missing = isMissingTable(err)
    logger.warn(missing ? 'Partner reactivation settings table missing, using defaults' : 'Partner reactivation settings unreadable, campaign paused', { err: err instanceof Error ? err.message : String(err) })
    const value = sanitizeReactivationConfig(null)
    cache = { at: Date.now(), value: missing ? value : { ...value, paused: true }, updatedAt: null, updatedByEmail: null }
  }
  return cache
}

const isMissingTable = (err: unknown) => {
  const e = err as { code?: string; message?: string }
  return e?.code === 'P2021' || /does not exist|no existe/i.test(e?.message ?? '')
}

/**
 * Uncached check before every send: the admin's pause applies at once, also in the middle of a run and on other
 * instances. Fails closed (an unreadable row counts as paused).
 */
export async function isReactivationStopped(): Promise<boolean> {
  try {
    const t = table()
    if (!t) return false
    const row = await t.findUnique({ where: { id: 'platform' }, select: { config: true, updatedAt: true, updatedByEmail: true } })
    if (!row) return false
    const c = sanitizeReactivationConfig(row.config)
    return !c.enabled || c.paused
  } catch (err) {
    return !isMissingTable(err)
  }
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
