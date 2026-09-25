import type OpenAI from 'openai'
import { fromOpenAIResponse, toOpenAIRequest } from '@/lib/ai/providers/translate'
import type { CallParams } from '@/lib/ai/providers/types'

/** One Responses API call, answered in Anthropic's shape. */
export async function callOpenAI(client: OpenAI, p: CallParams, model: string) {
  const res = await client.responses.create(toOpenAIRequest(p, model), p.timeoutMs ? { timeout: p.timeoutMs } : undefined)
  return fromOpenAIResponse(res)
}

/** Text models of the account (GET /v1/models), without embeddings, audio, image or moderation models. */
export async function listOpenAIModels(client: OpenAI) {
  const out: Array<{ id: string; displayName: string }> = []
  for await (const m of client.models.list()) {
    if (!/^(gpt-|o\d|chatgpt-)/.test(m.id) || /embedding|audio|realtime|tts|transcribe|image|search|moderation|instruct/.test(m.id)) continue
    out.push({ id: m.id, displayName: m.id })
  }
  return out.sort((a, b) => b.id.localeCompare(a.id))
}
