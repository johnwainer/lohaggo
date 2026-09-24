import { describe, expect, it } from 'vitest'
import { COPILOT_MAX_AGE_MS, copilotAgentFor, copilotTimer, splitSuggestion, suggestionOutcome, type CopilotAgentLike, type CopilotConversation } from '@/lib/ai/copilot-core'
import { shouldTakeOverCore } from '@/lib/ai/runtime-core'

let seq = 0
function agent(over: Partial<CopilotAgentLike> = {}): CopilotAgentLike {
  seq++
  return {
    id: `a${seq}`, name: `A${seq}`, status: 'active', createdAt: new Date(2026, 0, seq), isDefault: false, channels: [],
    autopilot: false, autopilotChannels: [], autopilotAccounts: [], autopilotSkipTags: [], handoffKeywords: [], handoffAfterTurns: 0,
    hoursEnabled: false, hoursTimezone: null, hoursDays: [1, 2, 3, 4, 5], hoursStart: '08:00', hoursEnd: '18:00', outsideHours: 'notice',
    outsideHoursMessage: null, memoryWindow: 20,
    copilotChannels: ['WHATSAPP'], copilotSuggest: 'auto', copilotTakeover: true, copilotTakeoverMinutes: 10, copilotWarnMinutes: 2,
    ...over,
  }
}
const conv = (over: Partial<CopilotConversation> = {}): CopilotConversation => ({
  aiHandled: false, aiHandoffAt: null, isTest: false, aiSpam: false, automationsPaused: false, threadOwner: null, status: 'IN_PROGRESS', tags: [], copilotSkipMessageId: null, ...over,
})
const now = new Date('2026-09-24T15:00:00Z')
const inbound = (minAgo: number, id = 'm1') => ({ id, direction: 'INBOUND', sentAt: new Date(now.getTime() - minAgo * 60_000) })
const tz = 'America/Bogota'

describe('qué agente hace de copiloto', () => {
  it('el más antiguo activo con el canal declarado', () => {
    const a = agent()
    const b = agent()
    expect(copilotAgentFor([b, a], 'WHATSAPP')?.id).toBe(a.id)
    expect(copilotAgentFor([agent({ copilotChannels: [] })], 'WHATSAPP')).toBeNull()
    expect(copilotAgentFor([agent({ status: 'paused' })], 'WHATSAPP')).toBeNull()
  })
})

describe('temporizador: cuándo retoma', () => {
  it('espera, avisa y luego retoma', () => {
    expect(copilotTimer(agent(), conv(), inbound(5), now, tz).action).toBe('wait')
    expect(copilotTimer(agent(), conv(), inbound(8.5), now, tz).action).toBe('warn')
    const t = copilotTimer(agent(), conv(), inbound(11), now, tz)
    expect(t.action).toBe('takeover')
    if (t.action !== 'none') expect(t.waitingMinutes).toBe(11)
  })
  it('sin aviso previo pasa directo de esperar a retomar', () => {
    expect(copilotTimer(agent({ copilotWarnMinutes: 0 }), conv(), inbound(9.5), now, tz).action).toBe('wait')
  })
  it('una salida negativa por cada caso', () => {
    const cases: Array<[string, ReturnType<typeof copilotTimer>['action']]> = [
      ['retomar apagado', copilotTimer(agent({ copilotTakeover: false }), conv(), inbound(30), now, tz).action],
      ['ya la lleva la IA', copilotTimer(agent(), conv({ aiHandled: true }), inbound(30), now, tz).action],
      ['de prueba', copilotTimer(agent(), conv({ isTest: true }), inbound(30), now, tz).action],
      ['spam', copilotTimer(agent(), conv({ aiSpam: true }), inbound(30), now, tz).action],
      ['pausada', copilotTimer(agent(), conv({ automationsPaused: true }), inbound(30), now, tz).action],
      ['hilo en Meta', copilotTimer(agent(), conv({ threadOwner: 'x' }), inbound(30), now, tz).action],
      ['resuelta', copilotTimer(agent(), conv({ status: 'RESOLVED' }), inbound(30), now, tz).action],
      ['la persona ya respondió', copilotTimer(agent(), conv(), { id: 'm2', direction: 'OUTBOUND', sentAt: inbound(30).sentAt }, now, tz).action],
      ['"lo atiendo yo"', copilotTimer(agent(), conv({ copilotSkipMessageId: 'm1' }), inbound(30), now, tz).action],
      ['fuera de la ventana de 24 h', copilotTimer(agent(), conv(), inbound(COPILOT_MAX_AGE_MS / 60_000 + 1), now, tz).action],
      ['fuera de horario', copilotTimer(agent({ hoursEnabled: true, hoursDays: [0] }), conv(), inbound(30), now, tz).action],
    ]
    for (const [name, action] of cases) expect([name, action]).toEqual([name, 'none'])
  })
  it('un mensaje nuevo del cliente vuelve a activar el retome aunque se dijera "lo atiendo yo"', () => {
    expect(copilotTimer(agent(), conv({ copilotSkipMessageId: 'm1' }), inbound(30, 'm2'), now, tz).action).toBe('takeover')
  })
})

describe('casos que la IA no retoma: solo avisa', () => {
  it('conversación que la IA traspasó', () => {
    const t = copilotTimer(agent(), conv({ aiHandoffAt: new Date() }), inbound(30), now, tz)
    expect(t.action).toBe('alert')
  })
  it('conversación con etiqueta excluida', () => {
    expect(copilotTimer(agent({ autopilotSkipTags: ['VIP'] }), conv({ tags: ['vip'] }), inbound(30), now, tz).action).toBe('alert')
  })
  it('en modo aviso no hay cuenta regresiva de retome', () => {
    expect(copilotTimer(agent(), conv({ aiHandoffAt: new Date() }), inbound(8.5), now, tz).action).toBe('wait')
  })
})

describe('sugerencias', () => {
  it('separa la nota para la persona', () => {
    expect(splitSuggestion('Hola Ana, ya lo reviso. [[CONTEXTO]] Tiene una reserva sin pagar.')).toEqual({ text: 'Hola Ana, ya lo reviso.', context: 'Tiene una reserva sin pagar.' })
    expect(splitSuggestion('Hola')).toEqual({ text: 'Hola', context: null })
  })
  it('usada tal cual o editada', () => {
    expect(suggestionOutcome('Hola Ana,  ¿en qué te ayudo?', 'hola ana, ¿en qué te ayudo?')).toBe('used')
    expect(suggestionOutcome('Hola Ana', 'Hola Ana, dame un minuto')).toBe('edited')
  })
})

describe('conversación retomada por un agente en copiloto', () => {
  it('sigue respondiendo aunque ese agente no tenga piloto automático en el canal', () => {
    const a = agent()
    const c = { channel: 'WHATSAPP', connectionId: null, isTest: false, assignedToId: null, automationsPaused: false, aiSpam: false, threadOwner: null, tags: [], aiAgentId: a.id, aiHandoffAt: null }
    expect(shouldTakeOverCore({ ...c, aiHandled: true }, { agents: [a], recentHumanActivity: false }).take).toBe(true)
    // Sin haber sido retomada, el copiloto no contesta solo
    expect(shouldTakeOverCore({ ...c, aiHandled: false }, { agents: [a], recentHumanActivity: false })).toEqual({ take: false, reason: 'no_agent' })
  })
})
