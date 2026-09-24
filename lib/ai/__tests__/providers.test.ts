import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))

import { DEFAULT_PRICING, computeCost, periodOf, resolvePricing } from '@/lib/ai/pricing'
import { buildAttemptPlan, runWithFallback } from '@/lib/ai/retry'
import { modelCaps } from '@/lib/ai/models'
import { buildRequest } from '@/lib/ai/anthropic'
import { evaluateBudget } from '@/lib/ai/limits'

describe('coste', () => {
  it('calcula entrada, salida y caché con la tarifa por millón', () => {
    const price = { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 }
    const cost = computeCost({ inputTokens: 1000, outputTokens: 200, cacheReadTokens: 10_000, cacheWriteTokens: 2000 }, price)
    // 0.005 + 0.005 + 0.005 + 0.0125
    expect(cost).toBeCloseTo(0.0275, 6)
  })

  it('sin tarifa, coste cero (no inventa precio)', () => {
    expect(computeCost({ inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 }, null)).toBe(0)
  })

  it('resuelve por coincidencia exacta y luego por prefijo más largo', () => {
    expect(resolvePricing(DEFAULT_PRICING, 'anthropic', 'claude-opus-5')?.inputPerMTok).toBe(5)
    expect(resolvePricing(DEFAULT_PRICING, 'anthropic', 'claude-haiku-4-5-foo')?.inputPerMTok).toBe(1)
    expect(resolvePricing(DEFAULT_PRICING, 'anthropic', 'desconocido')).toBeNull()
    expect(resolvePricing(DEFAULT_PRICING, 'voyage', 'voyage-3-lite')?.inputPerMTok).toBe(0.02)
  })

  it('periodo YYYY-MM', () => {
    expect(periodOf(new Date(Date.UTC(2026, 8, 24)))).toBe('2026-09')
    expect(periodOf(new Date(Date.UTC(2026, 11, 31, 23)))).toBe('2026-12')
  })
})

describe('529 y modelo de reserva', () => {
  const overloaded = Object.assign(new Error('overloaded'), { status: 529 })
  const noSleep = async () => {}

  it('plan: 3 intentos al principal con espera creciente y luego la reserva', () => {
    const plan = buildAttemptPlan('claude-opus-5', 'claude-haiku-4-5', 1000)
    expect(plan.map((p) => p.model)).toEqual(['claude-opus-5', 'claude-opus-5', 'claude-opus-5', 'claude-haiku-4-5'])
    expect(plan[2].delayMs).toBeGreaterThan(plan[1].delayMs)
  })

  it('cae a la reserva tras dos reintentos con 529', async () => {
    const call = vi.fn(async (model: string) => {
      if (model === 'claude-opus-5') throw overloaded
      return 'ok'
    })
    const out = await runWithFallback(buildAttemptPlan('claude-opus-5', 'claude-haiku-4-5'), call, noSleep)
    expect(out.model).toBe('claude-haiku-4-5')
    expect(call).toHaveBeenCalledTimes(4)
  })

  it('no reintenta ni cambia de modelo ante un 400', async () => {
    const bad = Object.assign(new Error('bad'), { status: 400 })
    const call = vi.fn(async () => { throw bad })
    await expect(runWithFallback(buildAttemptPlan('claude-opus-5', 'claude-haiku-4-5'), call, noSleep)).rejects.toBe(bad)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('se recupera en el segundo intento sin tocar la reserva', async () => {
    let n = 0
    const out = await runWithFallback(buildAttemptPlan('claude-opus-5', 'claude-haiku-4-5'), async () => {
      n++
      if (n === 1) throw overloaded
      return 'ok'
    }, noSleep)
    expect(out.model).toBe('claude-opus-5')
    expect(out.attempts).toBe(2)
  })
})

describe('forma de la petición por modelo', () => {
  const base = { messages: [{ role: 'user' as const, content: 'hola' }], maxTokens: 512, effort: 'low' as const }

  it('Claude 5: razonamiento adaptativo + effort, sin temperature/top_p/top_k ni budget_tokens', () => {
    const req = buildRequest({ ...base, model: 'claude-opus-5' }, 'claude-opus-5') as unknown as Record<string, unknown>
    expect(req.thinking).toEqual({ type: 'adaptive' })
    expect(req.output_config).toEqual({ effort: 'low' })
    expect(req).not.toHaveProperty('temperature')
    expect(req).not.toHaveProperty('top_p')
    expect(req).not.toHaveProperty('top_k')
    expect(JSON.stringify(req)).not.toContain('budget_tokens')
    expect(req.max_tokens as number).toBeGreaterThan(512)
  })

  it('Haiku 4.5 (reserva): sin thinking ni effort, que rechaza', () => {
    const req = buildRequest({ ...base, model: 'claude-opus-5' }, 'claude-haiku-4-5') as unknown as Record<string, unknown>
    expect(req).not.toHaveProperty('thinking')
    expect(req).not.toHaveProperty('output_config')
    expect(req.max_tokens).toBe(512)
  })

  it('capacidades', () => {
    expect(modelCaps('claude-opus-5').adaptiveThinking).toBe(true)
    expect(modelCaps('claude-sonnet-5').effort).toBe(true)
    expect(modelCaps('claude-sonnet-4-6').effort).toBe(true)
    expect(modelCaps('claude-haiku-4-5').effort).toBe(false)
    expect(modelCaps('claude-sonnet-4-5').adaptiveThinking).toBe(false)
  })
})

describe('topes mensuales', () => {
  it('sin tope, ok', () => {
    expect(evaluateBudget({ costUsd: 999, calls: 999 }, { costCapUsd: null, callCap: null }).state).toBe('ok')
  })
  it('aviso al 80 % y corte al 100 %', () => {
    expect(evaluateBudget({ costUsd: 7.9, calls: 0 }, { costCapUsd: 10, callCap: null }).state).toBe('ok')
    expect(evaluateBudget({ costUsd: 8, calls: 0 }, { costCapUsd: 10, callCap: null }).state).toBe('warn')
    expect(evaluateBudget({ costUsd: 10, calls: 0 }, { costCapUsd: 10, callCap: null }).state).toBe('blocked')
  })
  it('decide el mayor de los dos ratios', () => {
    expect(evaluateBudget({ costUsd: 1, calls: 100 }, { costCapUsd: 10, callCap: 100 }).state).toBe('blocked')
  })
  it('tope cero bloquea', () => {
    expect(evaluateBudget({ costUsd: 0, calls: 0 }, { costCapUsd: 0, callCap: null }).state).toBe('blocked')
  })
})
