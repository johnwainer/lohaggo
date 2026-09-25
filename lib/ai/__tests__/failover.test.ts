import { describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))

import { fromOpenAIResponse, openaiCaps, ProviderResponseError, toOpenAIInput, toOpenAIRequest } from '@/lib/ai/providers/translate'
import { classifyProviderError, ProviderNotConfiguredError } from '@/lib/ai/providers/classify'
import { afterError, afterOk, EMPTY_STATE, isDown } from '@/lib/ai/providers/breaker'
import { AllProvidersFailedError, runProviders, type FailoverDeps, type ProviderPlan } from '@/lib/ai/providers/failover'
import { buildRequest } from '@/lib/ai/providers/anthropic'
import { parseProviderOrder } from '@/lib/ai/settings'
import { openaiEquivalent } from '@/lib/ai/anthropic'
import type { ProviderId } from '@/lib/ai/providers/types'

const H = new Headers()
const anthropicErr = (status: number, type: string, message: string, headers = H) => Anthropic.APIError.generate(status, { type: 'error', error: { type, message } }, undefined, headers)
const openaiErr = (status: number, code: string | null, message: string, headers = H) => OpenAI.APIError.generate(status, { error: { code, type: code, message } }, undefined, headers)

describe('traducción Anthropic → OpenAI (Responses API)', () => {
  it('el system con caché pasa a instructions, sin cache_control', () => {
    const req = toOpenAIRequest({ model: 'x', system: [{ type: 'text', text: 'Eres Lola.', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'Hoy es lunes.' }], messages: [{ role: 'user', content: 'hola' }], maxTokens: 100, effort: 'low' }, 'gpt-6-sol')
    expect(req.instructions).toBe('Eres Lola.\n\nHoy es lunes.')
    expect(req.input).toEqual([{ role: 'user', content: 'hola' }])
    expect(req.store).toBe(false)
    expect(JSON.stringify(req)).not.toContain('cache_control')
  })

  it('historial con tool_use y tool_result: function_call y function_call_output con el mismo id', () => {
    const out = toOpenAIInput([
      { role: 'user', content: '¿precio de plomería?' },
      { role: 'assistant', content: [
        { type: 'thinking', thinking: 'debo buscar', signature: 'sig' },
        { type: 'text', text: 'Busco.' },
        { type: 'tool_use', id: 'toolu_1', name: 'buscar_servicio', input: { q: 'plomería' } },
        { type: 'tool_use', id: 'toolu_2', name: 'ver_zona', input: {} },
      ] },
      { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Desde $50.000' },
        { type: 'tool_result', tool_use_id: 'toolu_2', content: [{ type: 'text', text: 'no cubierta' }], is_error: true },
      ] },
    ])
    expect(out).toEqual([
      { role: 'user', content: '¿precio de plomería?' },
      { role: 'assistant', content: 'Busco.' },
      { type: 'function_call', call_id: 'toolu_1', name: 'buscar_servicio', arguments: '{"q":"plomería"}' },
      { type: 'function_call', call_id: 'toolu_2', name: 'ver_zona', arguments: '{}' },
      { type: 'function_call_output', call_id: 'toolu_1', output: 'Desde $50.000' },
      { type: 'function_call_output', call_id: 'toolu_2', output: 'Error: no cubierta' },
    ])
  })

  it('herramientas como funciones con su JSON Schema; effort y tokens según el modelo', () => {
    const tool: Anthropic.Tool = { name: 'crear_idea', description: 'Crea una idea', input_schema: { type: 'object', properties: { titulo: { type: 'string' } }, required: ['titulo'] } }
    const reasoning = toOpenAIRequest({ model: 'x', messages: [{ role: 'user', content: 'hola' }], tools: [tool], maxTokens: 1000, effort: 'high' }, 'gpt-6-sol')
    expect(reasoning.tools).toEqual([{ type: 'function', name: 'crear_idea', description: 'Crea una idea', parameters: tool.input_schema, strict: false }])
    expect(reasoning.reasoning).toEqual({ effort: 'high' })
    expect(reasoning.max_output_tokens).toBe(3048)
    const plain = toOpenAIRequest({ model: 'x', messages: [{ role: 'user', content: 'hola' }], maxTokens: 1000, effort: 'high' }, 'gpt-4.1')
    expect(plain.reasoning).toBeUndefined()
    expect(plain.max_output_tokens).toBe(1000)
    expect(plain.tools).toBeUndefined()
    expect(openaiCaps('gpt-5-chat-latest').reasoning).toBe(false)
    expect(openaiCaps('gpt-6-luna').reasoning).toBe(true)
    expect(openaiCaps('o4-mini').reasoning).toBe(true)
  })
})

const response = (output: unknown[], opts: { status?: OpenAI.Responses.ResponseStatus; incomplete?: 'max_output_tokens' | 'content_filter'; usage?: OpenAI.Responses.ResponseUsage } = {}) => ({
  id: 'resp_1', object: 'response', created_at: 1, model: 'gpt-6-sol-2026-08-01', output, output_text: '', error: null,
  status: opts.status ?? 'completed', incomplete_details: opts.incomplete ? { reason: opts.incomplete } : null, usage: opts.usage,
}) as unknown as OpenAI.Responses.Response
const textItem = (text: string) => ({ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })

describe('traducción OpenAI → Anthropic', () => {
  it('ida y vuelta con herramientas (ejemplo de la documentación): tool_use con input parseado', () => {
    const msg = fromOpenAIResponse(response([
      { type: 'reasoning', id: 'rs_1', summary: [] },
      { type: 'function_call', id: 'fc_1', call_id: 'call_abc', name: 'get_weather', arguments: '{"location":"Bogotá"}', status: 'completed' },
    ]))
    expect(msg.stop_reason).toBe('tool_use')
    expect(msg.content).toEqual([{ type: 'tool_use', id: 'call_abc', name: 'get_weather', input: { location: 'Bogotá' }, caller: { type: 'direct' } }])
    expect(msg.model).toBe('gpt-6-sol-2026-08-01')
    // El bloque vuelve como historial en la siguiente vuelta con el mismo id
    const back = toOpenAIInput([{ role: 'assistant', content: msg.content as Anthropic.ContentBlockParam[] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_abc', content: '22 °C' }] }])
    expect(back).toEqual([
      { type: 'function_call', call_id: 'call_abc', name: 'get_weather', arguments: '{"location":"Bogotá"}' },
      { type: 'function_call_output', call_id: 'call_abc', output: '22 °C' },
    ])
  })

  it('texto, fin por longitud, rechazo y filtro de contenido', () => {
    expect(fromOpenAIResponse(response([textItem('hola')])).stop_reason).toBe('end_turn')
    expect(fromOpenAIResponse(response([textItem('hola')])).content).toEqual([{ type: 'text', text: 'hola', citations: null }])
    expect(fromOpenAIResponse(response([textItem('ho')], { status: 'incomplete', incomplete: 'max_output_tokens' })).stop_reason).toBe('max_tokens')
    const refused = fromOpenAIResponse(response([{ type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'No puedo ayudar con eso' }] }]))
    expect(refused.stop_reason).toBe('refusal')
    expect(refused.stop_details?.explanation).toBe('No puedo ayudar con eso')
    expect(fromOpenAIResponse(response([], { status: 'incomplete', incomplete: 'content_filter' })).stop_reason).toBe('refusal')
  })

  it('uso: los tokens cacheados y escritos en caché salen de la entrada', () => {
    const msg = fromOpenAIResponse(response([textItem('ok')], { usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500, input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 50 }, output_tokens_details: { reasoning_tokens: 200 } } as OpenAI.Responses.ResponseUsage }))
    expect(msg.usage.input_tokens).toBe(150)
    expect(msg.usage.cache_read_input_tokens).toBe(1000)
    expect(msg.usage.cache_creation_input_tokens).toBe(50)
    expect(msg.usage.output_tokens).toBe(300)
  })

  it('argumentos que no son JSON: error, nunca texto', () => {
    expect(() => fromOpenAIResponse(response([{ type: 'function_call', call_id: 'c', name: 'x', arguments: '{roto' }]))).toThrow(ProviderResponseError)
  })
})

describe('Claude con historial escrito por OpenAI', () => {
  it('sin bloques de thinking en una vuelta con herramientas, no pide thinking (la API lo rechazaría)', () => {
    const p = { model: 'claude-opus-5', maxTokens: 500, effort: 'low' as const, messages: [
      { role: 'user' as const, content: 'hola' },
      { role: 'assistant' as const, content: [{ type: 'tool_use' as const, id: 'call_1', name: 'x', input: {} }] },
      { role: 'user' as const, content: [{ type: 'tool_result' as const, tool_use_id: 'call_1', content: 'ok' }] },
    ] }
    expect(buildRequest(p, 'claude-opus-5').thinking).toBeUndefined()
    expect(buildRequest({ ...p, messages: [p.messages[0]] }, 'claude-opus-5').thinking).toEqual({ type: 'adaptive' })
  })
})

describe('cuándo cambiar de proveedor', () => {
  it('Anthropic sin crédito (400 con el texto de saldo, o billing_error): cambia y marca caído 30 min', () => {
    const c = classifyProviderError('anthropic', anthropicErr(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'))
    expect(c).toEqual({ failover: true, reason: 'sin_credito', cooldownMs: 30 * 60_000, tripNow: true })
    expect(classifyProviderError('anthropic', anthropicErr(402, 'billing_error', 'billing')).reason).toBe('sin_credito')
  })

  it('OpenAI sin cuota (429 insufficient_quota) es sin crédito, no límite', () => {
    expect(classifyProviderError('openai', openaiErr(429, 'insufficient_quota', 'You exceeded your current quota')).reason).toBe('sin_credito')
    expect(classifyProviderError('openai', openaiErr(429, 'credit_balance_exhausted', 'no credits')).reason).toBe('sin_credito')
    expect(classifyProviderError('openai', openaiErr(429, 'project_spend_limit_exceeded', 'limit')).reason).toBe('sin_credito')
  })

  it('clave inválida o revocada (401/403)', () => {
    expect(classifyProviderError('anthropic', anthropicErr(401, 'authentication_error', 'invalid x-api-key'))).toMatchObject({ failover: true, reason: 'clave_invalida', tripNow: true })
    expect(classifyProviderError('openai', openaiErr(403, null, 'forbidden')).reason).toBe('clave_invalida')
  })

  it('429 usa retry-after, o 1 min', () => {
    expect(classifyProviderError('anthropic', anthropicErr(429, 'rate_limit_error', 'slow down', new Headers({ 'retry-after': '20' })))).toMatchObject({ reason: 'limite', cooldownMs: 20_000, tripNow: true })
    expect(classifyProviderError('openai', openaiErr(429, 'rate_limit_exceeded', 'slow down')).cooldownMs).toBe(60_000)
  })

  it('sobrecarga, 5xx y conexión cambian sin marcar caído a la primera', () => {
    for (const s of [529, 503]) expect(classifyProviderError('anthropic', anthropicErr(s, 'overloaded_error', 'x'))).toMatchObject({ failover: true, reason: 'sobrecarga', tripNow: false })
    for (const s of [500, 502, 504]) expect(classifyProviderError('openai', openaiErr(s, null, 'x'))).toMatchObject({ failover: true, reason: 'caido', tripNow: false })
    expect(classifyProviderError('anthropic', new Anthropic.APIConnectionTimeoutError())).toMatchObject({ failover: true, reason: 'caido' })
    expect(classifyProviderError('openai', new OpenAI.APIConnectionError({ message: 'fetch failed' }))).toMatchObject({ failover: true, reason: 'caido' })
  })

  it('sin clave cambia; 400 de validación, respuesta rota y errores nuestros no', () => {
    expect(classifyProviderError('anthropic', new ProviderNotConfiguredError('anthropic'))).toMatchObject({ failover: true, reason: 'sin_clave' })
    expect(classifyProviderError('anthropic', anthropicErr(400, 'invalid_request_error', 'messages: roles must alternate')).failover).toBe(false)
    expect(classifyProviderError('openai', openaiErr(400, 'invalid_value', 'bad param')).failover).toBe(false)
    expect(classifyProviderError('openai', new ProviderResponseError('x')).failover).toBe(false)
    expect(classifyProviderError('anthropic', new Error('Tope mensual de IA alcanzado')).failover).toBe(false)
  })
})

describe('circuit breaker', () => {
  const t0 = new Date('2026-09-25T15:00:00Z')
  it('sin crédito: caído al primer error, 30 min; pasado el plazo ya no se salta', () => {
    const c = classifyProviderError('anthropic', anthropicErr(400, 'invalid_request_error', 'Your credit balance is too low'))
    const { next, transition } = afterError(EMPTY_STATE, c, 'sin crédito', t0)
    expect(transition).toBe('down')
    expect(next.status).toBe('down')
    expect(isDown(next, new Date(t0.getTime() + 29 * 60_000))).toBe(true)
    expect(isDown(next, new Date(t0.getTime() + 31 * 60_000))).toBe(false)
  })

  it('sobrecarga: degradado, y caído 5 min al tercer fallo seguido', () => {
    const c = classifyProviderError('anthropic', anthropicErr(529, 'overloaded_error', 'x'))
    let s = afterError(EMPTY_STATE, c, 'x', t0).next
    expect(s.status).toBe('degraded')
    s = afterError(s, c, 'x', t0).next
    const third = afterError(s, c, 'x', t0)
    expect(third.transition).toBe('down')
    expect(third.next.downUntil?.getTime()).toBe(t0.getTime() + 5 * 60_000)
  })

  it('una respuesta lo devuelve a ok y cierra el episodio; sin clave no cuenta como fallo', () => {
    const down = afterError(EMPTY_STATE, classifyProviderError('openai', openaiErr(401, null, 'x')), 'x', t0).next
    const ok = afterOk(down, t0)
    expect(ok.transition).toBe('recovered')
    expect(ok.next).toMatchObject({ status: 'ok', failures: 0, downUntil: null })
    expect(afterError(EMPTY_STATE, classifyProviderError('openai', new ProviderNotConfiguredError('openai')), 'x', t0).next).toBe(EMPTY_STATE)
    expect(afterOk({ ...EMPTY_STATE, lastOkAt: t0 }, new Date(t0.getTime() + 60_000)).write).toBe(false)
  })
})

describe('orden de intento', () => {
  const plan = (provider: ProviderId, call: (model: string) => Promise<string>): ProviderPlan<string> => ({ provider, primary: `${provider}-main`, fallback: `${provider}-cheap`, call })
  const deps = (over: Partial<FailoverDeps> = {}): FailoverDeps & { errors: string[]; oks: string[] } => {
    const errors: string[] = []
    const oks: string[] = []
    return { failoverEnabled: true, isDown: () => false, onError: (p, c) => { errors.push(`${p}:${c.reason}`) }, onOk: (p) => { oks.push(p) }, describe: (e) => String(e), sleep: async () => {}, errors, oks, ...over }
  }
  const noCredit = anthropicErr(400, 'invalid_request_error', 'Your credit balance is too low')

  it('Claude sin crédito: la misma llamada responde con OpenAI', async () => {
    const d = deps()
    const anthropic = vi.fn(async () => { throw noCredit })
    const r = await runProviders([plan('anthropic', anthropic), plan('openai', async (m) => `respuesta de ${m}`)], d)
    expect(r).toMatchObject({ result: 'respuesta de openai-main', provider: 'openai', failedOver: ['anthropic'] })
    expect(anthropic).toHaveBeenCalledTimes(1)
    expect(d.errors).toEqual(['anthropic:sin_credito'])
    expect(d.oks).toEqual(['openai'])
  })

  it('principal marcado caído: va directo al segundo, sin llamarlo', async () => {
    const anthropic = vi.fn(async () => 'claude')
    const r = await runProviders([plan('anthropic', anthropic), plan('openai', async () => 'openai')], deps({ isDown: (p) => p === 'anthropic' }))
    expect(r.provider).toBe('openai')
    expect(anthropic).not.toHaveBeenCalled()
  })

  it('pasado downUntil se vuelve a probar (isDown false) y responde', async () => {
    const r = await runProviders([plan('anthropic', async () => 'claude'), plan('openai', async () => 'openai')], deps({ isDown: () => false }))
    expect(r.provider).toBe('anthropic')
  })

  it('los dos caídos: se intenta igual y, si fallan, error con los dos motivos', async () => {
    const p = runProviders([plan('anthropic', async () => { throw noCredit }), plan('openai', async () => { throw openaiErr(429, 'insufficient_quota', 'quota') })], deps({ isDown: () => true }))
    await expect(p).rejects.toBeInstanceOf(AllProvidersFailedError)
    await expect(p).rejects.toThrow(/Claude \(Anthropic\): sin crédito · OpenAI: sin crédito/)
  })

  it('sobrecarga: agota su plan (3 intentos + modelo de respaldo) antes de cambiar', async () => {
    const models: string[] = []
    const r = await runProviders([plan('anthropic', async (m) => { models.push(m); throw anthropicErr(529, 'overloaded_error', 'x') }), plan('openai', async () => 'ok')], deps())
    expect(models).toEqual(['anthropic-main', 'anthropic-main', 'anthropic-main', 'anthropic-cheap'])
    expect(r.provider).toBe('openai')
  })

  it('con el cambio automático apagado se queda en el primero', async () => {
    const openai = vi.fn(async () => 'openai')
    await expect(runProviders([plan('anthropic', async () => { throw noCredit }), plan('openai', openai)], deps({ failoverEnabled: false }))).rejects.toBe(noCredit)
    expect(openai).not.toHaveBeenCalled()
  })

  it('un 400 de validación no cambia de proveedor', async () => {
    const bad = anthropicErr(400, 'invalid_request_error', 'tools.0.name: invalid')
    const openai = vi.fn(async () => 'openai')
    await expect(runProviders([plan('anthropic', async () => { throw bad }), plan('openai', openai)], deps())).rejects.toBe(bad)
    expect(openai).not.toHaveBeenCalled()
  })

  it('nuestro tope mensual no cambia de proveedor (error propio, no de la API)', async () => {
    const cap = new Error('Tope mensual de IA alcanzado (100%)')
    const openai = vi.fn(async () => 'openai')
    await expect(runProviders([plan('anthropic', async () => { throw cap }), plan('openai', openai)], deps())).rejects.toBe(cap)
    expect(openai).not.toHaveBeenCalled()
  })
})

describe('ajustes', () => {
  it('orden de proveedores: sin duplicados ni desconocidos, y con los dos', () => {
    expect(parseProviderOrder('openai,anthropic')).toEqual(['openai', 'anthropic'])
    expect(parseProviderOrder('openai,openai,gemini')).toEqual(['openai', 'anthropic'])
    expect(parseProviderOrder(null)).toEqual(['anthropic', 'openai'])
  })

  it('equivalencia de modelos: el económico va al de respaldo de OpenAI', () => {
    const s = { fallbackModel: 'claude-haiku-4-5', openaiModel: 'gpt-main', openaiFallbackModel: 'gpt-cheap' }
    expect(openaiEquivalent('claude-opus-5', s)).toBe('gpt-main')
    expect(openaiEquivalent('claude-sonnet-5', s)).toBe('gpt-main')
    expect(openaiEquivalent('claude-haiku-4-5', s)).toBe('gpt-cheap')
    expect(openaiEquivalent('gpt-4.1', s)).toBe('gpt-4.1')
  })
})
