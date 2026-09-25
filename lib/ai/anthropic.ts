import Anthropic from '@anthropic-ai/sdk'
import { buildAttemptPlan, runWithFallback } from '@/lib/ai/retry'
import { modelCaps } from '@/lib/ai/models'
import { logAiCall, type AiCallKind } from '@/lib/ai/calls'
import { requireAnthropic } from '@/lib/ai/settings'
import type { UsageTokens } from '@/lib/ai/pricing'

export type Effort = 'low' | 'medium' | 'high'

export type CallParams = {
  model: string
  system?: Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  maxTokens: number
  effort: Effort
  /** Longer than the client's 60 s default, for long jobs (marketing agent) outside a live chat */
  timeoutMs?: number
}

export type CallContext = {
  kind: AiCallKind
  workspaceId?: string | null
  agentId?: string | null
  conversationId?: string | null
  /** false for the platform's own diagnostics that should not fall back */
  allowFallback?: boolean
}

export type CallResult = {
  message: Anthropic.Message
  model: string
  usage: UsageTokens
  costUsd: number
  latencyMs: number
}

/** Extra room for adaptive thinking so a small visible budget (512) is not eaten by reasoning. */
const THINKING_HEADROOM = 2048

/**
 * Builds the request for a given model. Claude 5 / 4.6+: adaptive thinking + effort, never
 * temperature/top_p/top_k (400). Legacy fallback models (Haiku 4.5) take neither thinking nor effort.
 */
export function buildRequest(p: CallParams, model: string): Anthropic.MessageCreateParamsNonStreaming {
  const caps = modelCaps(model)
  const req: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: p.maxTokens + (caps.adaptiveThinking ? THINKING_HEADROOM : 0),
    messages: p.messages,
  }
  if (p.system?.length) req.system = p.system
  if (p.tools?.length) req.tools = p.tools
  if (caps.adaptiveThinking) req.thinking = { type: 'adaptive' }
  if (caps.effort) req.output_config = { effort: p.effort }
  return req
}

export function usageOf(message: Anthropic.Message): UsageTokens {
  return {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  }
}

/**
 * One Messages API call with the platform policy: 2 retries with growing wait on 529, then the
 * fallback model. Logs one ai_calls row with the model that really answered (message.model).
 */
export async function callClaude(p: CallParams, ctx: CallContext): Promise<CallResult> {
  const { client, settings } = await requireAnthropic()
  const plan = buildAttemptPlan(p.model, ctx.allowFallback === false ? null : settings.fallbackModel)
  const started = Date.now()
  const { result: message } = await runWithFallback(plan, (model) => client.messages.create(buildRequest(p, model), p.timeoutMs ? { timeout: p.timeoutMs } : undefined))
  const latencyMs = Date.now() - started
  const usage = usageOf(message)
  const costUsd = await logAiCall({
    provider: 'anthropic',
    model: message.model,
    requestedModel: p.model,
    kind: ctx.kind,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    conversationId: ctx.conversationId,
    usage,
    latencyMs,
  })
  return { message, model: message.model, usage, costUsd, latencyMs }
}

export function textOf(message: Anthropic.Message) {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/** Live model list for the configured key (GET /v1/models). */
export async function listAnthropicModels(client: Anthropic) {
  const out: Array<{ id: string; displayName: string }> = []
  for await (const m of client.models.list({ limit: 100 })) out.push({ id: m.id, displayName: m.display_name })
  return out
}

/** Minimal call: does this model answer on this account, and how fast. No fallback. */
export async function probeModel(model: string) {
  const { client } = await requireAnthropic()
  const started = Date.now()
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responde solo: ok' }],
    })
    const latencyMs = Date.now() - started
    await logAiCall({ provider: 'anthropic', model: message.model, requestedModel: model, kind: 'model_test', usage: usageOf(message), latencyMs })
    return { ok: true as const, model: message.model, latencyMs, stopReason: message.stop_reason }
  } catch (err) {
    return { ok: false as const, model, latencyMs: Date.now() - started, error: describeApiError(err) }
  }
}

export function describeApiError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return 'Clave inválida (401)'
  if (err instanceof Anthropic.PermissionDeniedError) return 'La clave no tiene permiso para este recurso (403)'
  if (err instanceof Anthropic.NotFoundError) return 'Modelo no disponible en esta cuenta (404)'
  if (err instanceof Anthropic.RateLimitError) return 'Límite de peticiones alcanzado (429)'
  if (err instanceof Anthropic.BadRequestError) return `Petición rechazada (400): ${err.message}`
  if (err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503)) return 'Modelo sobrecargado (529), prueba de nuevo'
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'Anthropic tardó demasiado en responder; inténtalo de nuevo'
  if (err instanceof Anthropic.APIConnectionError) return 'No se pudo conectar con Anthropic'
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status ?? '?'}): ${err.message}`
  return err instanceof Error ? err.message : 'Error desconocido'
}
