import { logAiCall } from '@/lib/ai/calls'
import { getAiSettings } from '@/lib/ai/settings'

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'

type VoyageResponse = {
  data?: Array<{ embedding: number[]; index: number }>
  model?: string
  usage?: { total_tokens?: number }
  detail?: string
}

export async function voyageEmbed(params: {
  key: string
  model: string
  input: string[]
  inputType: 'document' | 'query'
  workspaceId?: string | null
}): Promise<{ vectors: number[][]; model: string; tokens: number }> {
  const started = Date.now()
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: params.input, model: params.model, input_type: params.inputType }),
  })
  const data = (await res.json().catch(() => ({}))) as VoyageResponse
  if (!res.ok || !data.data) throw new Error(`Voyage ${res.status}: ${data.detail || 'error'}`)
  const vectors = [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
  const tokens = data.usage?.total_tokens ?? 0
  const model = data.model || params.model
  await logAiCall({
    provider: 'voyage',
    model,
    requestedModel: params.model,
    kind: 'embedding',
    workspaceId: params.workspaceId,
    usage: { inputTokens: tokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    latencyMs: Date.now() - started,
  })
  return { vectors, model, tokens }
}

/** null when Voyage is not configured: the knowledge base then runs in lexical mode. */
export async function getVoyage() {
  const s = await getAiSettings()
  return s.voyageKey ? { key: s.voyageKey, model: s.embeddingModel } : null
}

export async function testVoyageKey(key: string, model: string) {
  const started = Date.now()
  try {
    const out = await voyageEmbed({ key, model, input: ['prueba de conexión'], inputType: 'query' })
    return { ok: true as const, latencyMs: Date.now() - started, dim: out.vectors[0]?.length ?? 0 }
  } catch (err) {
    return { ok: false as const, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : 'error' }
  }
}
