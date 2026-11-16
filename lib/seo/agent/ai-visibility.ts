/**
 * Asks a Claude with server-side web search the questions a real customer would type («plomero en Medellín») and reads
 * who gets recommended. Never throws. The question never names LoHaggo, so a mention or citation is earned.
 *
 * Budget: at most MAX_QUERIES per run. One query with web search (up to 3 searches at US$ 0,01 each plus tokens) runs
 * roughly US$ 0,03 to 0,08, so a run costs about US$ 0,20 to 0,50.
 */
import { createLogger } from '@/lib/logger'
import { logAiCall } from '@/lib/ai/calls'
import { describeApiError } from '@/lib/ai/anthropic'
import { modelForKind } from '@/lib/ai/models'
import { anthropicClient, getAiSettings } from '@/lib/ai/settings'
import { parseProbe, type AiProbeResult } from '@/lib/seo/agent/ai-visibility-core'

const logger = createLogger('seo-ai-visibility')

export const MAX_QUERIES = 6
const QUERY_TIMEOUT_MS = 90_000
const MAX_CONTINUATIONS = 2
const SEARCH_USD = 0.01

const TOOL_VERSIONS = ['web_search_20260209', 'web_search_20250305'] as const

const SYSTEM = 'Eres un asistente que ayuda a personas en Colombia a encontrar y contratar servicios a domicilio. Busca en la web y responde en español, de forma breve, con opciones concretas y enlaces.'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const tool = (type: string) => ({
  type,
  name: 'web_search',
  max_uses: 3,
  user_location: { type: 'approximate', country: 'CO', city: 'Medellín', region: 'Antioquia', timezone: 'America/Bogota' },
})

const isTransient = (err: unknown) => {
  const e = err as { status?: number; message?: string }
  return e?.status === 429 || e?.status === 529 || e?.status === 503 || /overloaded|rate.?limit/i.test(e?.message ?? '')
}
const isToolRejected = (err: unknown) => {
  const e = err as { status?: number; message?: string }
  return e?.status === 400 && /web_search|tool/i.test(e?.message ?? '')
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Meter = { costUsd: number; model: string | null }

async function askOnce(query: string, model: string, key: string, toolType: string, endAt: number, meter: Meter): Promise<unknown> {
  const client = anthropicClient(key)
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [{ role: 'user', content: query }]
  const merged: unknown[] = []
  let last: Json = {}
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const left = Math.min(QUERY_TIMEOUT_MS, endAt - Date.now())
    if (left < 5_000) throw new Error('Se acabó el tiempo de la consulta')
    const started = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (await (client.messages as any).create({ model, max_tokens: 1500, system: SYSTEM, tools: [tool(toolType)], messages }, { timeout: left })) as Json
    last = msg
    const u = (msg.usage ?? {}) as Json
    const cost = await logAiCall({
      provider: 'anthropic',
      model: msg.model ?? model,
      requestedModel: model,
      kind: 'seo_agent_probe',
      usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 },
      latencyMs: Date.now() - started,
    })
    meter.costUsd += cost + (u.server_tool_use?.web_search_requests ?? 0) * SEARCH_USD
    meter.model = msg.model ?? model
    if (Array.isArray(msg.content)) merged.push(...msg.content)
    if (msg.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: msg.content })
  }
  return { ...last, content: merged }
}

async function probeOne(query: string, model: string, key: string, endAt: number, meter: Meter): Promise<AiProbeResult> {
  let toolIdx = 0
  let retried = false
  for (;;) {
    try {
      return parseProbe(await askOnce(query, model, key, TOOL_VERSIONS[toolIdx], endAt, meter), query)
    } catch (err) {
      if (isToolRejected(err) && toolIdx < TOOL_VERSIONS.length - 1) { toolIdx++; continue }
      if (isTransient(err) && !retried && endAt - Date.now() > 15_000) { retried = true; await sleep(2_500); continue }
      logger.warn('AI probe failed', { query, message: err instanceof Error ? err.message : String(err) })
      return { ...parseProbe({}, query), error: (err instanceof Error && /tiempo/.test(err.message) ? err.message : describeApiError(err)).slice(0, 200) }
    }
  }
}

export async function runAiProbe(
  queries: string[],
  opts: { deadline?: number; concurrency?: number } = {},
): Promise<{ results: AiProbeResult[]; costUsd: number; model: string | null; error: string | null }> {
  const meter: Meter = { costUsd: 0, model: null }
  const list = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(0, MAX_QUERIES)
  try {
    if (list.length === 0) return { results: [], costUsd: 0, model: null, error: 'No hay preguntas para medir' }
    const settings = await getAiSettings()
    if (!settings.anthropicKey) return { results: [], costUsd: 0, model: null, error: 'La medición de visibilidad en IA necesita la clave de Anthropic en IA · Plataforma' }
    const model = modelForKind('seo_agent_probe', settings.defaultModel, settings.defaultModel)
    const deadline = opts.deadline ?? Date.now() + QUERY_TIMEOUT_MS * 3
    const results: AiProbeResult[] = new Array(list.length)
    let next = 0
    const worker = async () => {
      while (next < list.length) {
        const i = next++
        results[i] = Date.now() >= deadline - 5_000
          ? { ...parseProbe({}, list[i]), error: 'Sin tiempo para esta pregunta' }
          : await probeOne(list[i], model, settings.anthropicKey as string, deadline, meter)
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 2, 4)) }, worker))
    const failed = results.filter((r) => r.error).length
    return { results, costUsd: Math.round(meter.costUsd * 1e4) / 1e4, model: meter.model ?? model, error: failed === results.length ? results[0]?.error ?? 'No se pudo medir' : null }
  } catch (err) {
    logger.warn('AI visibility run failed', { message: err instanceof Error ? err.message : String(err) })
    return { results: [], costUsd: meter.costUsd, model: meter.model, error: describeApiError(err) }
  }
}
