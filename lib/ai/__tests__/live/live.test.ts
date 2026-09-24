/**
 * Integration tests against the real Anthropic API. They cost money, so they only run with:
 *   AI_LIVE_TESTS=1 AI_TEST_ANTHROPIC_KEY=sk-ant-… npm run test:ai-live
 * The database is never touched: prisma, settings and the ai_calls logger are mocked.
 */
import { describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

const KEY = process.env.AI_TEST_ANTHROPIC_KEY || ''
const LIVE = process.env.AI_LIVE_TESTS === '1' && Boolean(KEY)

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/ai/calls', () => ({ logAiCall: async () => 0, AUX_KINDS: [] }))
vi.mock('@/lib/ai/settings', () => {
  const client = new Anthropic({ apiKey: process.env.AI_TEST_ANTHROPIC_KEY || 'missing', maxRetries: 0 })
  const settings = { anthropicKey: 'x', voyageKey: null, defaultModel: 'claude-opus-5', fallbackModel: 'claude-haiku-4-5', embeddingModel: 'voyage-3', allowAgentModelOverride: false, auxDailyBudgetUsd: 5 }
  return { requireAnthropic: async () => ({ client, settings }), getAiSettings: async () => settings }
})

import { buildRequest, callClaude, textOf } from '@/lib/ai/anthropic'
import { buildAttemptPlan, runWithFallback } from '@/lib/ai/retry'
import { buildSystem } from '@/lib/ai/prompt'
import { parseMarkers } from '@/lib/ai/format'
import type { Retrieval } from '@/lib/ai/knowledge'

const agent = {
  name: 'Sofía', goal: 'Resolver dudas de los clientes de LoHaggo sobre servicios del hogar', instructions: 'LoHaggo conecta clientes con técnicos verificados en Medellín. Trata al cliente de tú.',
  tone: 'Cercano y profesional', language: 'auto', handoffOnUnknown: true, ignoreSpam: true, signatureMode: 'off', signatureText: null,
}
const KB = [
  '### Precios\nLa visita de diagnóstico de plomería cuesta $60.000 COP. La de electricidad, $70.000 COP. El valor de la visita se descuenta si aceptas la reparación.',
  '### Horario\nAtendemos solicitudes de lunes a sábado de 7:00 a 19:00.',
  '### Cobertura\nSolo operamos en Medellín, Envigado, Sabaneta, Itagüí y Bello.',
].join('\n\n')

function system(knowledgeText = KB) {
  const knowledge: Retrieval = { mode: 'full', chunks: [{ docId: 'kb', title: 'Base LoHaggo', text: knowledgeText, score: 1 }] }
  return buildSystem(agent, {
    knowledge, nowText: 'martes 22 de septiembre de 2026, 10:15', timezone: 'America/Bogota', channel: 'WHATSAPP',
    contact: { name: 'Cliente', tags: [], fields: {}, linkedUser: false }, summary: null, toolGuidance: '',
  })
}

async function ask(text: string, sys = system()) {
  const r = await callClaude({ model: 'claude-opus-5', system: sys, messages: [{ role: 'user', content: text }], maxTokens: 400, effort: 'low' }, { kind: 'playground' })
  return { ...r, markers: parseMarkers(textOf(r.message)) }
}

describe.skipIf(!LIVE)('API real', () => {
  it('el modelo por defecto responde y se registra el que respondió', async () => {
    const r = await ask('¿Cuánto cuesta la visita de plomería?')
    expect(r.message.stop_reason).toBe('end_turn')
    expect(r.model.startsWith('claude-opus-5')).toBe(true)
    expect(r.markers.text).toMatch(/60[.,]?000/)
    expect(r.markers.handoff).toBe(false)
  }, 60_000)

  it('un 529 persistente cae al modelo de reserva', async () => {
    const client = new Anthropic({ apiKey: KEY, maxRetries: 0 })
    const p = { model: 'claude-opus-5', messages: [{ role: 'user' as const, content: 'Di solo: hola' }], maxTokens: 50, effort: 'low' as const }
    const out = await runWithFallback(
      buildAttemptPlan('claude-opus-5', 'claude-haiku-4-5', 10),
      async (model) => {
        if (model === 'claude-opus-5') throw Object.assign(new Error('Overloaded'), { status: 529 })
        return client.messages.create(buildRequest(p, model))
      },
    )
    expect(out.model).toBe('claude-haiku-4-5')
    expect(out.result.model.startsWith('claude-haiku-4-5')).toBe(true)
    expect(out.attempts).toBe(4)
  }, 60_000)

  it('[[HANDOFF]] ante algo que no está en el conocimiento', async () => {
    const r = await ask('¿Hacen instalación de paneles solares en Cartagena y cuánto cuesta?')
    expect(r.markers.handoff).toBe(true)
    expect(r.markers.text).not.toMatch(/\$\s?\d/) // no invented price
  }, 60_000)

  it('la caché se usa desde la segunda llamada', async () => {
    // Long stable prefix (above the minimum cacheable size); the per-turn block stays after the breakpoints
    const big = `${KB}\n\n${Array.from({ length: 120 }, (_, i) => `Pregunta frecuente ${i}: el servicio ${i} incluye revisión, diagnóstico, mano de obra y garantía de 30 días sobre el trabajo realizado.`).join('\n')}`
    const sys = system(big)
    await ask('Hola', sys)
    const second = await ask('¿Atienden en Bello?', sys)
    expect(second.usage.cacheReadTokens).toBeGreaterThan(0)
  }, 120_000)

  describe('spam: 6 promociones y 6 clientes reales, cero falsos positivos', () => {
    const promos = [
      'Hola! Somos una agencia de marketing digital. Aumentamos tus seguidores en Instagram 10x garantizado. Escríbenos para una demo gratis 🚀',
      'Préstamos inmediatos sin estudio de crédito, desembolso en 24 horas. Responde SI para recibir información.',
      'Posiciona tu web en el primer lugar de Google con nuestro servicio SEO. Precio especial esta semana: $99 USD.',
      '¡Felicidades! Has ganado un iPhone 16. Reclama tu premio aquí: bit.ly/premio-ya',
      'Vendemos bases de datos de clientes de empresas en Colombia actualizadas 2026. Pide tu cotización.',
      'Ofrecemos desarrollo de apps y chatbots con IA para tu negocio. ¿Agendamos una llamada de 15 minutos?',
    ]
    const customers = [
      'Hola buenas, necesito un plomero para mañana, se me está saliendo el agua del lavaplatos',
      'cuanto vale',
      '¿Trabajan en Envigado?',
      'El técnico no llegó y ya pagué, esto es un robo, quiero mi plata',
      'ok gracias',
      'Hola, vi su publicidad en Instagram. ¿Me pueden cotizar una instalación eléctrica?',
    ]

    it.each(customers)('cliente real no es spam: %s', async (text) => {
      const r = await ask(text)
      expect(r.markers.spam).toBe(false)
    }, 60_000)

    it('las promociones: se toleran falsos negativos, se informa cuántas detectó', async () => {
      let detected = 0
      for (const text of promos) if ((await ask(text)).markers.spam) detected++
      console.info(`[spam] promociones detectadas: ${detected}/${promos.length}`)
      expect(detected).toBeGreaterThanOrEqual(0)
    }, 180_000)
  })
})
