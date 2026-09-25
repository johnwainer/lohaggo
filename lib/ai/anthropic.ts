import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { logAiCall, type AiCallKind } from '@/lib/ai/calls'
import { AiNotConfiguredError, anthropicClient, getAiSettings, openaiClient, requireAnthropic, type AiRuntimeSettings } from '@/lib/ai/settings'
import { buildRequest, callAnthropic, listAnthropicModels } from '@/lib/ai/providers/anthropic'
import { callOpenAI } from '@/lib/ai/providers/openai'
import { AllProvidersFailedError, runProviders, type ProviderPlan } from '@/lib/ai/providers/failover'
import { ProviderNotConfiguredError } from '@/lib/ai/providers/classify'
import { ProviderResponseError } from '@/lib/ai/providers/translate'
import { getProviderStates, providerIsDown, recordProviderError, recordProviderOk } from '@/lib/ai/providers/state'
import type { CallParams, ProviderId } from '@/lib/ai/providers/types'
import type { UsageTokens } from '@/lib/ai/pricing'

export type { CallParams, Effort } from '@/lib/ai/providers/types'
export { buildRequest, listAnthropicModels }

export type CallContext = {
  kind: AiCallKind
  workspaceId?: string | null
  agentId?: string | null
  conversationId?: string | null
  /** false for the platform's own diagnostics that should not fall back to the cheaper model */
  allowFallback?: boolean
  /** false to stay on the first provider even when failover is on */
  allowFailover?: boolean
}

export type CallResult = {
  message: Anthropic.Message
  model: string
  /** Who answered: the same call may have started on the other one */
  provider: ProviderId
  usage: UsageTokens
  costUsd: number
  latencyMs: number
}

export const isOpenAIModel = (model: string) => /^(gpt-|o\d|chatgpt-)/i.test(model)

/**
 * The OpenAI model that takes a Claude model's place: the platform's cheap model (and Haiku) maps to
 * the OpenAI fallback model, anything else to the main one. An OpenAI id is used as is.
 */
export function openaiEquivalent(model: string, s: Pick<AiRuntimeSettings, 'fallbackModel' | 'openaiModel' | 'openaiFallbackModel'>) {
  if (isOpenAIModel(model)) return model
  return model === s.fallbackModel || /haiku/i.test(model) ? s.openaiFallbackModel : s.openaiModel
}

export function usageOf(message: Anthropic.Message): UsageTokens {
  return {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  }
}

function plansFor(p: CallParams, ctx: CallContext, s: AiRuntimeSettings): ProviderPlan<Anthropic.Message>[] {
  const plans: ProviderPlan<Anthropic.Message>[] = []
  for (const provider of s.providerOrder) {
    if (provider === 'anthropic' && s.anthropicKey) {
      const client = anthropicClient(s.anthropicKey)
      const primary = isOpenAIModel(p.model) ? s.defaultModel : p.model
      plans.push({ provider, primary, fallback: ctx.allowFallback === false ? null : s.fallbackModel, call: (model) => callAnthropic(client, p, model) })
    }
    if (provider === 'openai' && s.openaiKey) {
      const client = openaiClient(s.openaiKey)
      plans.push({ provider, primary: openaiEquivalent(p.model, s), fallback: ctx.allowFallback === false ? null : s.openaiFallbackModel, call: (model) => callOpenAI(client, p, model) })
    }
  }
  return plans
}

/**
 * One text call with the platform policy. Each provider in `providerOrder` gets its plan (primary
 * model ×3 on overload, then its fallback model); when it fails with something the other provider
 * can fix (credit, key, rate limit, outage) the same request goes to the next one. A provider marked
 * down is skipped until its cooldown ends. Logs one ai_calls row with who really answered.
 */
export async function callAI(p: CallParams, ctx: CallContext): Promise<CallResult> {
  const settings = await getAiSettings()
  const plans = plansFor(p, ctx, settings)
  if (!plans.length) throw new AiNotConfiguredError()
  const states = await getProviderStates()
  const started = Date.now()
  const { result: message, provider } = await runProviders(plans, {
    failoverEnabled: settings.failoverEnabled && ctx.allowFailover !== false,
    isDown: (pr) => providerIsDown(states, pr),
    onError: (pr, c, err) => (c.reason ? recordProviderError(pr, c, describeApiError(err)) : undefined),
    onOk: recordProviderOk,
    describe: describeApiError,
  })
  const latencyMs = Date.now() - started
  const usage = usageOf(message)
  const costUsd = await logAiCall({
    provider,
    model: message.model,
    requestedModel: p.model,
    kind: ctx.kind,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    conversationId: ctx.conversationId,
    usage,
    latencyMs,
  })
  return { message, model: message.model, provider, usage, costUsd, latencyMs }
}

/** Kept for the callers written before OpenAI: same call, same result. */
export const callClaude = callAI

export function textOf(message: Anthropic.Message) {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/** Minimal call to one provider: does this model answer on this account, and how fast. No fallback, no failover. */
export async function probeModel(model: string) {
  const provider: ProviderId = isOpenAIModel(model) ? 'openai' : 'anthropic'
  const settings = await getAiSettings()
  const started = Date.now()
  try {
    let message: Anthropic.Message
    if (provider === 'openai') {
      if (!settings.openaiKey) throw new ProviderNotConfiguredError('openai')
      message = await callOpenAI(openaiClient(settings.openaiKey), { model, maxTokens: 16, effort: 'low', messages: [{ role: 'user', content: 'Responde solo: ok' }] }, model)
    } else {
      const { client } = await requireAnthropic()
      message = await client.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Responde solo: ok' }] })
    }
    const latencyMs = Date.now() - started
    await logAiCall({ provider, model: message.model, requestedModel: model, kind: 'model_test', usage: usageOf(message), latencyMs })
    return { ok: true as const, provider, model: message.model, latencyMs, stopReason: message.stop_reason }
  } catch (err) {
    return { ok: false as const, provider, model, latencyMs: Date.now() - started, error: describeApiError(err) }
  }
}

export function describeApiError(err: unknown): string {
  if (err instanceof AllProvidersFailedError || err instanceof ProviderResponseError || err instanceof ProviderNotConfiguredError || err instanceof AiNotConfiguredError) return err.message
  const [sdk, name] = err instanceof OpenAI.APIError ? [OpenAI, 'OpenAI'] as const : [Anthropic, 'Anthropic'] as const
  if (err instanceof sdk.AuthenticationError) return `${name}: clave inválida (401)`
  if (err instanceof sdk.PermissionDeniedError) return `${name}: la clave no tiene permiso para este recurso (403)`
  if (err instanceof sdk.NotFoundError) return `${name}: modelo no disponible en esta cuenta (404)`
  if (err instanceof OpenAI.RateLimitError && /credit_balance|insufficient_quota|spend_limit|usage_limit/.test(`${err.code} ${err.type}`)) return 'OpenAI: sin crédito o tope de gasto de la cuenta (429)'
  if (err instanceof sdk.RateLimitError) return `${name}: límite de peticiones alcanzado (429)`
  if (err instanceof Anthropic.APIError && err.type === 'billing_error') return `Anthropic: sin crédito en la cuenta (${err.status})`
  if (err instanceof sdk.BadRequestError) return /credit balance/i.test(err.message) ? 'Anthropic: sin crédito en la cuenta (400)' : `${name}: petición rechazada (400): ${err.message}`
  if (err instanceof sdk.APIError && (err.status === 529 || err.status === 503)) return `${name}: modelo sobrecargado (${err.status}), prueba de nuevo`
  if (err instanceof sdk.APIConnectionTimeoutError) return `${name} tardó demasiado en responder; inténtalo de nuevo`
  if (err instanceof sdk.APIConnectionError) return `No se pudo conectar con ${name}`
  if (err instanceof sdk.APIError) return `${name}: error de la API (${err.status ?? '?'}): ${err.message}`
  return err instanceof Error ? err.message : 'Error desconocido'
}
