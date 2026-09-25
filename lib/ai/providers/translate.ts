import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { THINKING_HEADROOM, type CallParams } from '@/lib/ai/providers/types'

type ResponsesParams = OpenAI.Responses.ResponseCreateParamsNonStreaming
type InputItem = OpenAI.Responses.ResponseInputItem

/**
 * Reasoning models (gpt-5 and later except the chat snapshots, o-series) take `reasoning.effort`.
 * We use the Responses API because on Chat Completions the current models only call tools with
 * reasoning off (developers.openai.com/api/docs/models/gpt-6-sol).
 */
export function openaiCaps(model: string) {
  const id = model.toLowerCase()
  const reasoning = /^o\d/.test(id) || (/^gpt-([5-9]|\d{2})/.test(id) && !/chat/.test(id))
  return { reasoning }
}

/** The model answered, but not in a shape we can use (tool arguments that are not JSON). Never shown as text. */
export class ProviderResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderResponseError'
  }
}

function textOfBlocks(content: string | Array<{ type: string; text?: string }>) {
  if (typeof content === 'string') return content
  return content.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n')
}

export function toOpenAIInstructions(system: Anthropic.TextBlockParam[] | undefined) {
  const text = system?.map((b) => b.text).filter(Boolean).join('\n\n')
  return text || undefined
}

/**
 * Anthropic messages → Responses input items. tool_use becomes a function_call and tool_result a
 * function_call_output with the same id; thinking blocks are dropped (they only mean something to
 * the model that wrote them) and cache_control goes away: OpenAI caches the prefix by itself.
 */
export function toOpenAIInput(messages: Anthropic.MessageParam[]): InputItem[] {
  const out: InputItem[] = []
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
      continue
    }
    if (m.role === 'assistant') {
      const text = m.content.filter((b): b is Anthropic.TextBlockParam => b.type === 'text').map((b) => b.text).join('\n')
      if (text) out.push({ role: 'assistant', content: text })
      for (const b of m.content) {
        if (b.type === 'tool_use') out.push({ type: 'function_call', call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) })
      }
      continue
    }
    for (const b of m.content) {
      if (b.type !== 'tool_result') continue
      const content = b.content == null ? '' : textOfBlocks(b.content as string | Array<{ type: string; text?: string }>)
      out.push({ type: 'function_call_output', call_id: b.tool_use_id, output: b.is_error ? `Error: ${content}` : content })
    }
    const text = m.content.filter((b): b is Anthropic.TextBlockParam => b.type === 'text').map((b) => b.text).join('\n')
    if (text) out.push({ role: 'user', content: text })
  }
  return out
}

export function toOpenAITools(tools: Anthropic.Tool[] | undefined): OpenAI.Responses.FunctionTool[] | undefined {
  if (!tools?.length) return undefined
  // strict off: our schemas have optional fields, and strict mode requires every property listed as required
  return tools.map((t) => ({ type: 'function', name: t.name, description: t.description ?? null, parameters: t.input_schema as Record<string, unknown>, strict: false }))
}

/** Same budget as Claude: visible tokens plus room for reasoning on the models that think. Nothing stored at OpenAI. */
export function toOpenAIRequest(p: CallParams, model: string): ResponsesParams {
  const caps = openaiCaps(model)
  const req: ResponsesParams = {
    model,
    input: toOpenAIInput(p.messages),
    max_output_tokens: p.maxTokens + (caps.reasoning ? THINKING_HEADROOM : 0),
    store: false,
  }
  const instructions = toOpenAIInstructions(p.system)
  if (instructions) req.instructions = instructions
  const tools = toOpenAITools(p.tools)
  if (tools) req.tools = tools
  if (caps.reasoning) req.reasoning = { effort: p.effort }
  return req
}

/**
 * Response → Anthropic.Message, so every caller reads one shape. Cached and cache-written tokens are
 * part of input_tokens on OpenAI; here they move to cache_read / cache_creation like Anthropic reports
 * them, so the cost is computed with each price once.
 */
export function fromOpenAIResponse(res: OpenAI.Responses.Response): Anthropic.Message {
  const content: Anthropic.ContentBlock[] = []
  let refusal: string | null = null
  let calls = 0
  for (const item of res.output ?? []) {
    if (item.type === 'message') {
      for (const c of item.content) {
        if (c.type === 'output_text' && c.text) content.push({ type: 'text', text: c.text, citations: null })
        if (c.type === 'refusal') refusal = c.refusal
      }
    } else if (item.type === 'function_call') {
      let input: unknown
      try {
        input = item.arguments ? JSON.parse(item.arguments) : {}
      } catch {
        throw new ProviderResponseError(`OpenAI devolvió argumentos inválidos para la herramienta ${item.name}`)
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProviderResponseError(`OpenAI devolvió argumentos inválidos para la herramienta ${item.name}`)
      content.push({ type: 'tool_use', id: item.call_id, name: item.name, input, caller: { type: 'direct' } })
      calls++
    }
  }
  const incomplete = res.status === 'incomplete' ? res.incomplete_details?.reason : null
  const stop: Anthropic.StopReason = refusal || incomplete === 'content_filter' ? 'refusal' : incomplete === 'max_output_tokens' ? 'max_tokens' : calls ? 'tool_use' : 'end_turn'
  if (stop === 'refusal' && !content.length) content.push({ type: 'text', text: '', citations: null })
  const u = res.usage
  const cached = u?.input_tokens_details?.cached_tokens ?? 0
  const written = u?.input_tokens_details?.cache_write_tokens ?? 0
  return {
    id: res.id,
    type: 'message',
    role: 'assistant',
    model: res.model,
    container: null,
    content,
    stop_reason: stop,
    stop_details: stop === 'refusal' ? { type: 'refusal', category: null, explanation: refusal } : null,
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(0, (u?.input_tokens ?? 0) - cached - written),
      output_tokens: u?.output_tokens ?? 0,
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: written,
      cache_creation: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  }
}
