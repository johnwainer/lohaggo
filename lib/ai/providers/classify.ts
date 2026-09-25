import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { ProviderResponseError } from '@/lib/ai/providers/translate'
import type { ProviderId } from '@/lib/ai/providers/types'

export type FailReason = 'sin_credito' | 'clave_invalida' | 'limite' | 'sobrecarga' | 'caido' | 'sin_clave' | 'modelo_no_disponible'

export const REASON_LABEL: Record<FailReason, string> = {
  sin_credito: 'sin crédito',
  clave_invalida: 'clave inválida o revocada',
  limite: 'límite de la cuenta',
  sobrecarga: 'sobrecargado',
  caido: 'no responde',
  sin_clave: 'sin clave configurada',
  modelo_no_disponible: 'modelo no disponible',
}

export type Classification = {
  /** Worth trying the next provider: the same request can work there */
  failover: boolean
  reason: FailReason | null
  /** How long to skip the provider once it is marked down */
  cooldownMs: number
  /** Down at the first error (credit, key, rate limit); otherwise after 3 in a row */
  tripNow: boolean
}

const MIN = 60_000
export const FAILURES_TO_TRIP = 3
const OPENAI_BILLING_CODES = new Set(['credit_balance_exhausted', 'insufficient_quota', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'])
const NO: Classification = { failover: false, reason: null, cooldownMs: 0, tripNow: false }

/** The provider has no key: the next one answers, nothing is marked down (it is configuration). */
export class ProviderNotConfiguredError extends Error {
  constructor(public provider: ProviderId) {
    super(`Falta la clave de ${provider === 'openai' ? 'OpenAI' : 'Anthropic'}`)
    this.name = 'ProviderNotConfiguredError'
  }
}

type AnyApiError = { status?: number; type?: string | null; code?: string | null; message?: string; headers?: Headers }

function retryAfterMs(headers: Headers | undefined) {
  const raw = headers?.get?.('retry-after')
  const s = raw ? Number(raw) : NaN
  return Number.isFinite(s) && s > 0 ? Math.min(30 * MIN, s * 1000) : MIN
}

const isConnection = (err: unknown) => err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError
const isAbort = (err: unknown) => err instanceof Anthropic.APIUserAbortError || err instanceof OpenAI.APIUserAbortError
const isApiError = (err: unknown): err is AnyApiError => err instanceof Anthropic.APIError || err instanceof OpenAI.APIError

/**
 * Should this error move the call to the other provider, and for how long should this one be skipped?
 * Only what the other provider can fix fails over: no credit, bad key, rate limit, outage. A request
 * that is wrong (400), a refusal or our own monthly cap would fail there too, so they are thrown.
 */
export function classifyProviderError(_provider: ProviderId, err: unknown): Classification {
  if (err instanceof ProviderNotConfiguredError) return { failover: true, reason: 'sin_clave', cooldownMs: 0, tripNow: false }
  if (err instanceof ProviderResponseError || isAbort(err)) return NO
  if (isConnection(err)) return { failover: true, reason: 'caido', cooldownMs: 5 * MIN, tripNow: false }
  if (!isApiError(err)) return NO
  const status = err.status ?? 0
  const text = `${err.type ?? ''} ${err.code ?? ''} ${err.message ?? ''}`.toLowerCase()
  // Anthropic: 402 billing_error, or a 400 "Your credit balance is too low…" / a spend limit set in its console.
  // OpenAI: 429 with credit_balance_exhausted, insufficient_quota or a spend/usage limit code.
  if (err.type === 'billing_error' || status === 402 || OPENAI_BILLING_CODES.has(err.code ?? '') || OPENAI_BILLING_CODES.has(err.type ?? '') || /credit balance|usage limits|spend limit/.test(text)) {
    return { failover: true, reason: 'sin_credito', cooldownMs: 30 * MIN, tripNow: true }
  }
  if (status === 401 || status === 403) return { failover: true, reason: 'clave_invalida', cooldownMs: 30 * MIN, tripNow: true }
  if (status === 429) return { failover: true, reason: 'limite', cooldownMs: retryAfterMs(err.headers), tripNow: true }
  if (status === 404) return { failover: true, reason: 'modelo_no_disponible', cooldownMs: 0, tripNow: false }
  if (status === 529 || status === 503) return { failover: true, reason: 'sobrecarga', cooldownMs: 5 * MIN, tripNow: false }
  if (status >= 500) return { failover: true, reason: 'caido', cooldownMs: 5 * MIN, tripNow: false }
  return NO
}
