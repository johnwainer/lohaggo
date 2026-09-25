import type Anthropic from '@anthropic-ai/sdk'
import { modelCaps } from '@/lib/ai/models'
import { THINKING_HEADROOM, type CallParams } from '@/lib/ai/providers/types'

/** Some assistant turn has tool calls without the thinking that led to them (written by another provider). */
function hasForeignToolTurn(messages: Anthropic.MessageParam[]) {
  return messages.some((m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_use') && !m.content.some((b) => b.type === 'thinking' || b.type === 'redacted_thinking'))
}

/**
 * Builds the request for a given model. Claude 5 / 4.6+: adaptive thinking + effort, never
 * temperature/top_p/top_k (400). Legacy fallback models (Haiku 4.5) take neither thinking nor effort.
 * A tool round started by OpenAI has no thinking blocks, and with thinking on the API would reject it.
 */
export function buildRequest(p: CallParams, model: string): Anthropic.MessageCreateParamsNonStreaming {
  const caps = modelCaps(model)
  const thinking = caps.adaptiveThinking && !hasForeignToolTurn(p.messages)
  const req: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: p.maxTokens + (thinking ? THINKING_HEADROOM : 0),
    messages: p.messages,
  }
  if (p.system?.length) req.system = p.system
  if (p.tools?.length) req.tools = p.tools
  if (thinking) req.thinking = { type: 'adaptive' }
  if (caps.effort) req.output_config = { effort: p.effort }
  return req
}

export async function callAnthropic(client: Anthropic, p: CallParams, model: string) {
  return client.messages.create(buildRequest(p, model), p.timeoutMs ? { timeout: p.timeoutMs } : undefined)
}

/** Live model list for the configured key (GET /v1/models). */
export async function listAnthropicModels(client: Anthropic) {
  const out: Array<{ id: string; displayName: string }> = []
  for await (const m of client.models.list({ limit: 100 })) out.push({ id: m.id, displayName: m.display_name })
  return out
}
