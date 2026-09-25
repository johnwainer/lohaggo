import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'
import { DEFAULT_EMBEDDING_MODEL, DEFAULT_MODEL, DEFAULT_OPENAI_FALLBACK_MODEL, DEFAULT_OPENAI_MODEL, FALLBACK_MODEL } from '@/lib/ai/models'
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers/types'

const SETTINGS_ID = 'platform'

export type AiRuntimeSettings = {
  anthropicKey: string | null
  voyageKey: string | null
  defaultModel: string
  fallbackModel: string
  embeddingModel: string
  allowAgentModelOverride: boolean
  auxDailyBudgetUsd: number
  openaiKey: string | null
  openaiModel: string
  openaiFallbackModel: string
  providerOrder: ProviderId[]
  failoverEnabled: boolean
}

/** "anthropic,openai" → both providers once each, unknown names dropped, missing ones appended. */
export function parseProviderOrder(raw: string | null | undefined): ProviderId[] {
  const listed = (raw || '').split(',').map((s) => s.trim()).filter((s): s is ProviderId => PROVIDERS.includes(s as ProviderId))
  const order = Array.from(new Set(listed))
  for (const p of PROVIDERS) if (!order.includes(p)) order.push(p)
  return order
}

let cache: { at: number; value: AiRuntimeSettings } | null = null
const CACHE_MS = 30_000

function decryptKey(blob: string | null | undefined): string | null {
  if (!blob) return null
  try {
    return decryptConfig<{ key: string }>(blob).key || null
  } catch {
    return null
  }
}

export async function getAiSettingsRow() {
  return prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} })
}

export async function getAiSettings(force = false): Promise<AiRuntimeSettings> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  const row = await getAiSettingsRow()
  const value: AiRuntimeSettings = {
    anthropicKey: decryptKey(row.anthropicKeyEncrypted),
    voyageKey: decryptKey(row.voyageKeyEncrypted),
    defaultModel: row.defaultModel || DEFAULT_MODEL,
    fallbackModel: row.fallbackModel || FALLBACK_MODEL,
    embeddingModel: row.embeddingModel || DEFAULT_EMBEDDING_MODEL,
    allowAgentModelOverride: row.allowAgentModelOverride,
    auxDailyBudgetUsd: row.auxDailyBudgetUsd,
    openaiKey: decryptKey(row.openaiKeyEncrypted),
    openaiModel: row.openaiModel || DEFAULT_OPENAI_MODEL,
    openaiFallbackModel: row.openaiFallbackModel || DEFAULT_OPENAI_FALLBACK_MODEL,
    providerOrder: parseProviderOrder(row.providerOrder),
    failoverEnabled: row.failoverEnabled,
  }
  cache = { at: Date.now(), value }
  return value
}

export function invalidateAiSettings() {
  cache = null
  clientCache = null
  openaiClientCache = null
}

export function maskKey(key: string | null) {
  if (!key) return null
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

export async function saveAiSettings(input: {
  anthropicKey?: string | null
  voyageKey?: string | null
  defaultModel?: string
  fallbackModel?: string
  embeddingModel?: string
  allowAgentModelOverride?: boolean
  auxDailyBudgetUsd?: number
  openaiKey?: string | null
  openaiModel?: string
  openaiFallbackModel?: string
  providerOrder?: ProviderId[]
  failoverEnabled?: boolean
  updatedByEmail?: string | null
}) {
  const data: Record<string, unknown> = { updatedByEmail: input.updatedByEmail ?? null }
  // undefined = keep; null/'' = remove
  if (input.anthropicKey !== undefined) data.anthropicKeyEncrypted = input.anthropicKey ? encryptConfig({ key: input.anthropicKey.trim() }) : null
  if (input.voyageKey !== undefined) data.voyageKeyEncrypted = input.voyageKey ? encryptConfig({ key: input.voyageKey.trim() }) : null
  if (input.defaultModel) data.defaultModel = input.defaultModel
  if (input.fallbackModel) data.fallbackModel = input.fallbackModel
  if (input.embeddingModel) data.embeddingModel = input.embeddingModel
  if (input.allowAgentModelOverride !== undefined) data.allowAgentModelOverride = input.allowAgentModelOverride
  if (input.auxDailyBudgetUsd !== undefined) data.auxDailyBudgetUsd = input.auxDailyBudgetUsd
  if (input.openaiKey !== undefined) data.openaiKeyEncrypted = input.openaiKey ? encryptConfig({ key: input.openaiKey.trim() }) : null
  if (input.openaiModel) data.openaiModel = input.openaiModel
  if (input.openaiFallbackModel) data.openaiFallbackModel = input.openaiFallbackModel
  if (input.providerOrder) data.providerOrder = parseProviderOrder(input.providerOrder.join(',')).join(',')
  if (input.failoverEnabled !== undefined) data.failoverEnabled = input.failoverEnabled
  await prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data })
  invalidateAiSettings()
}

let clientCache: { key: string; client: Anthropic } | null = null

/** maxRetries 0: retries and model fallback on 529 are handled by lib/ai/retry so we know which model answered. */
export function anthropicClient(key: string) {
  if (clientCache?.key === key) return clientCache.client
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 60_000 })
  clientCache = { key, client }
  return client
}

let openaiClientCache: { key: string; client: OpenAI } | null = null

/** Same policy as Anthropic: no SDK retries, lib/ai/retry and the failover decide. */
export function openaiClient(key: string) {
  if (openaiClientCache?.key === key) return openaiClientCache.client
  const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 60_000 })
  openaiClientCache = { key, client }
  return client
}

export class AiNotConfiguredError extends Error {
  constructor(what = 'Anthropic ni de OpenAI') {
    super(`La clave de ${what} no está configurada en IA · Plataforma`)
  }
}

/** Some text provider has a key: the agents can answer. */
export const hasTextProvider = (s: Pick<AiRuntimeSettings, 'anthropicKey' | 'openaiKey'>) => Boolean(s.anthropicKey || s.openaiKey)

export async function requireAnthropic() {
  const settings = await getAiSettings()
  if (!settings.anthropicKey) throw new AiNotConfiguredError()
  return { settings, client: anthropicClient(settings.anthropicKey) }
}
