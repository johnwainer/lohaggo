/**
 * Reads and saves the SEO agent settings (SeoSettings, one row). Reads are cached 30 s per instance and never
 * fail: without the table (SQL not applied yet) or the row, the defaults apply.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { DEFAULT_SEO_CONFIG, sanitizeSeoConfig, type SeoConfig } from '@/lib/seo/agent/settings-core'

const logger = createLogger('seo-settings')
const TTL_MS = 30_000
let cache: { at: number; value: SeoConfig } | null = null

export async function getSeoSettings(): Promise<SeoConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  try {
    const row = await prisma.seoSettings.findUnique({ where: { id: 'platform' }, select: { config: true } })
    const value = sanitizeSeoConfig(row?.config ?? null)
    cache = { at: Date.now(), value }
    return value
  } catch (err) {
    logger.warn('SEO settings unavailable, using defaults', { err: err instanceof Error ? err.message : String(err) })
    const value = sanitizeSeoConfig(null)
    cache = { at: Date.now(), value }
    return value
  }
}

export async function saveSeoSettings(raw: unknown, byEmail: string | null): Promise<SeoConfig> {
  const config = sanitizeSeoConfig(raw)
  await prisma.seoSettings.upsert({
    where: { id: 'platform' },
    create: { id: 'platform', config: config as object, updatedByEmail: byEmail },
    update: { config: config as object, updatedByEmail: byEmail },
  })
  cache = { at: Date.now(), value: config }
  return config
}

export { DEFAULT_SEO_CONFIG }
