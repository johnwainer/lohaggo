import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { anthropicSafeTools, buildRequest } from '@/lib/ai/providers/anthropic'
import { classifyProviderError } from '@/lib/ai/providers/classify'
import { PLATFORM_TOOLS } from '@/lib/ai/platform-tools'

const hasIntegerBounds = (node: unknown): boolean => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some(hasIntegerBounds)
  const o = node as Record<string, unknown>
  const types = Array.isArray(o.type) ? o.type : [o.type]
  if (types.includes('integer') && ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'].some((k) => k in o)) return true
  return Object.values(o).some(hasIntegerBounds)
}

describe('herramientas que se envían a Claude', () => {
  it('ninguna herramienta del agente de la bandeja sale con rangos en enteros (Claude responde 400)', () => {
    const tools = Object.entries(PLATFORM_TOOLS).map(([name, e]) => ({ name, description: e.description, input_schema: e.schema({} as never) as Anthropic.Tool["input_schema"] }))
    expect(tools.some((t) => hasIntegerBounds(t.input_schema))).toBe(true)
    const req = buildRequest({ messages: [{ role: 'user', content: 'hola' }], tools, maxTokens: 100, effort: 'low' } as never, 'claude-sonnet-5')
    expect((req.tools ?? []).some((t) => hasIntegerBounds((t as Anthropic.Tool).input_schema))).toBe(false)
  })

  it('el rango pasa a la descripción y no toca los números decimales', () => {
    const [t] = anthropicSafeTools([{ name: 'x', input_schema: { type: 'object', properties: { puntaje: { type: 'integer', minimum: 1, maximum: 5, description: 'Calificación' }, confianza: { type: 'number', minimum: 0, maximum: 1 } } } }])
    const props = (t.input_schema as { properties: Record<string, Record<string, unknown>> }).properties
    expect(props.puntaje).toEqual({ type: 'integer', description: 'Calificación. Número entero entre 1 y 5.' })
    expect(props.confianza.maximum).toBe(1)
  })

  it('un rechazo por el formato de las herramientas pasa al otro proveedor sin marcar caído a este', () => {
    const err = new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: "tools.22.custom: For 'integer' type, properties maximum, minimum are not supported" } }, "tools.22.custom: For 'integer' type, properties maximum, minimum are not supported", new Headers())
    const c = classifyProviderError('anthropic', err)
    expect(c.failover).toBe(true)
    expect(c.reason).toBe('incompatible')
    expect(c.tripNow).toBe(false)
  })
})

describe('modo estricto', () => {
  it('con más de 20 herramientas estrictas ninguna sale estricta; con pocas se conserva', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `t${i}`, input_schema: { type: 'object' as const, properties: {} }, strict: true }))
    expect(anthropicSafeTools(many).some((t) => t.strict)).toBe(false)
    expect(anthropicSafeTools(many.slice(0, 5)).every((t) => t.strict)).toBe(true)
  })
})
