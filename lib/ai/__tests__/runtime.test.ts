import { describe, expect, it } from 'vitest'
import {
  type AgentLike,
  type TakeOverConversation,
  describeNow,
  effectiveWindow,
  hasRecentHumanActivity,
  isWithinHours,
  matchKeyword,
  needsSummary,
  pickAgent,
  preHandoff,
  shouldTakeOverCore,
  toTurns,
} from '@/lib/ai/runtime-core'
import { applySignature, formatForChannel, parseMarkers } from '@/lib/ai/format'
import { CHUNK_MAX, CHUNK_MIN, chunkText, estimateTokens, rankLexical } from '@/lib/ai/knowledge-core'
import { buildSystem } from '@/lib/ai/prompt'

let seq = 0
function agent(over: Partial<AgentLike> = {}): AgentLike {
  seq++
  return {
    id: `a${seq}`, name: `Agente ${seq}`, status: 'active', createdAt: new Date(2026, 0, seq), isDefault: false,
    channels: [], autopilot: false, autopilotChannels: [], autopilotAccounts: [], autopilotSkipTags: [],
    handoffKeywords: [], handoffAfterTurns: 0, hoursEnabled: false, hoursTimezone: null, hoursDays: [1, 2, 3, 4, 5],
    hoursStart: '08:00', hoursEnd: '18:00', outsideHours: 'notice', outsideHoursMessage: null, memoryWindow: 20,
    ...over,
  }
}

function conv(over: Partial<TakeOverConversation> = {}): TakeOverConversation {
  return { channel: 'WHATSAPP', connectionId: null, isTest: false, assignedToId: null, automationsPaused: false, aiSpam: false, threadOwner: null, tags: [], aiAgentId: null, aiHandoffAt: null, ...over }
}

describe('pick', () => {
  it('el activo que declara el canal gana', () => {
    const all = agent({ channels: [] , isDefault: true })
    const wa = agent({ channels: ['WHATSAPP'] })
    expect(pickAgent([all, wa], 'WHATSAPP')?.id).toBe(wa.id)
  })
  it('si nadie lo declara, el isDefault', () => {
    const old = agent({ channels: [] })
    const def = agent({ channels: [], isDefault: true })
    expect(pickAgent([old, def], 'INSTAGRAM')?.id).toBe(def.id)
  })
  it('si no hay default, el activo más antiguo que lo atiende', () => {
    const newer = agent({ channels: [] })
    const older = { ...agent({ channels: [] }), createdAt: new Date(2020, 0, 1) }
    expect(pickAgent([newer, older], 'SMS')?.id).toBe(older.id)
  })
  it('un agente con otros canales explícitos no atiende este', () => {
    expect(pickAgent([agent({ channels: ['INSTAGRAM'] })], 'WHATSAPP')).toBeNull()
  })
  it('pausados nunca', () => {
    expect(pickAgent([agent({ status: 'paused' })], 'WHATSAPP')).toBeNull()
  })
  it('la conversación conserva su agente', () => {
    const a = agent({ channels: ['WHATSAPP'] })
    const b = agent({ channels: [] })
    expect(pickAgent([a, b], 'WHATSAPP', b.id)?.id).toBe(b.id)
  })
})

describe('preHandoff', () => {
  const now = new Date('2026-09-23T15:00:00Z') // miércoles 10:00 en Bogotá
  const base = { text: 'hola', turns: 0, now, accountTz: 'America/Bogota' }

  it('palabra clave antes de llamar al modelo (sin tildes ni mayúsculas)', () => {
    const r = preHandoff(agent({ handoffKeywords: ['hablar con humano'] }), { ...base, text: '¡Quiero HABLAR con Humano ya!' })
    expect(r).toEqual({ action: 'handoff', reason: 'keyword', detail: 'hablar con humano' })
  })
  it('la palabra clave no casa dentro de otra palabra', () => {
    expect(matchKeyword('reasesor', ['asesor'])).toBeNull()
    expect(matchKeyword('quiero un asesor', ['asesor'])).toBe('asesor')
  })
  it('tope de turnos', () => {
    expect(preHandoff(agent({ handoffAfterTurns: 5 }), { ...base, turns: 5 }).action).toBe('handoff')
    expect(preHandoff(agent({ handoffAfterTurns: 5 }), { ...base, turns: 4 }).action).toBe('continue')
    expect(preHandoff(agent({ handoffAfterTurns: 0 }), { ...base, turns: 999 }).action).toBe('continue')
  })
  it('fuera de horario: handoff, aviso o silencio', () => {
    const night = new Date('2026-09-24T03:00:00Z') // 22:00 Bogotá
    const hours = { hoursEnabled: true }
    expect(preHandoff(agent({ ...hours, outsideHours: 'handoff' }), { ...base, now: night }).action).toBe('handoff')
    expect(preHandoff(agent({ ...hours, outsideHours: 'silent' }), { ...base, now: night }).action).toBe('silent')
    const notice = preHandoff(agent({ ...hours, outsideHours: 'notice', outsideHoursMessage: 'Abrimos a las 8' }), { ...base, now: night })
    expect(notice).toEqual({ action: 'notice', message: 'Abrimos a las 8' })
    expect(preHandoff(agent(hours), base).action).toBe('continue')
  })
})

describe('horario y fecha', () => {
  it('días, rango y zona horaria de la cuenta', () => {
    const a = agent({ hoursEnabled: true, hoursDays: [1, 2, 3, 4, 5], hoursStart: '08:00', hoursEnd: '18:00' })
    expect(isWithinHours(a, new Date('2026-09-23T15:00:00Z'), 'America/Bogota')).toBe(true) // mié 10:00
    expect(isWithinHours(a, new Date('2026-09-23T15:00:00Z'), 'Asia/Tokyo')).toBe(false) // jue 00:00
    expect(isWithinHours(a, new Date('2026-09-27T15:00:00Z'), 'America/Bogota')).toBe(false) // domingo
  })
  it('rango nocturno', () => {
    const a = agent({ hoursEnabled: true, hoursDays: [0, 1, 2, 3, 4, 5, 6], hoursStart: '22:00', hoursEnd: '06:00' })
    expect(isWithinHours(a, new Date('2026-09-24T04:00:00Z'), 'America/Bogota')).toBe(true) // 23:00
    expect(isWithinHours(a, new Date('2026-09-23T17:00:00Z'), 'America/Bogota')).toBe(false) // 12:00
  })
  it('describe hoy en la zona de la cuenta', () => {
    const text = describeNow(new Date('2026-09-24T15:15:00Z'), 'America/Bogota')
    expect(text).toMatch(/jueves 24 de septiembre de 2026, 10:15/)
  })
})

describe('shouldTakeOver: una prueba por cada salida negativa', () => {
  const pilot = () => agent({ autopilot: true, autopilotChannels: ['WHATSAPP'] })
  const ctx = (agents: AgentLike[] = [pilot()], recentHumanActivity = false) => ({ agents, recentHumanActivity })

  it('conversación de prueba → no', () => expect(shouldTakeOverCore(conv({ isTest: true }), ctx())).toEqual({ take: false, reason: 'test' }))
  it('persona responsable → no', () => expect(shouldTakeOverCore(conv({ assignedToId: 'u1' }), ctx())).toEqual({ take: false, reason: 'human_owner' }))
  it('una persona escribió hace menos de 30 min → no', () => expect(shouldTakeOverCore(conv(), ctx(undefined, true))).toEqual({ take: false, reason: 'human_recent' }))
  it('la IA ya traspasó (aunque nadie la tenga asignada) → no', () => expect(shouldTakeOverCore(conv({ aiHandoffAt: new Date() }), ctx())).toEqual({ take: false, reason: 'handed_off' }))
  it('automatizaciones pausadas → no', () => expect(shouldTakeOverCore(conv({ automationsPaused: true }), ctx())).toEqual({ take: false, reason: 'paused' }))
  it('conversación marcada como spam → no', () => expect(shouldTakeOverCore(conv({ aiSpam: true }), ctx())).toEqual({ take: false, reason: 'spam' }))
  it('hilo en la bandeja nativa de Meta → no', () => expect(shouldTakeOverCore(conv({ threadOwner: 'other' }), ctx())).toEqual({ take: false, reason: 'thread_elsewhere' }))
  it('etiqueta excluida → no', () => {
    const a = agent({ autopilot: true, autopilotChannels: ['WHATSAPP'], autopilotSkipTags: ['VIP'] })
    expect(shouldTakeOverCore(conv({ tags: ['vip'] }), ctx([a]))).toEqual({ take: false, reason: 'skip_tag' })
  })
  it('ningún agente con piloto y el canal declarado explícitamente → no', () => {
    expect(shouldTakeOverCore(conv(), ctx([agent({ autopilot: false, autopilotChannels: ['WHATSAPP'] })]))).toEqual({ take: false, reason: 'no_agent' })
    // "todos los canales" no cuenta: es justo el accidente a evitar
    expect(shouldTakeOverCore(conv(), ctx([agent({ autopilot: true, autopilotChannels: [] })]))).toEqual({ take: false, reason: 'no_agent' })
    expect(shouldTakeOverCore(conv(), ctx([agent({ autopilot: true, autopilotChannels: ['WHATSAPP'], status: 'paused' })]))).toEqual({ take: false, reason: 'no_agent' })
  })
  it('la cuenta de canal no está en autopilotAccounts → no', () => {
    const a = agent({ autopilot: true, autopilotChannels: ['INSTAGRAM'], autopilotAccounts: ['conn_A'] })
    expect(shouldTakeOverCore(conv({ channel: 'INSTAGRAM', connectionId: 'conn_B' }), ctx([a]))).toEqual({ take: false, reason: 'account_not_enabled' })
  })
  it('si no, sí: y respeta el agente que ya lleva la conversación', () => {
    const a = pilot()
    const b = pilot()
    const r = shouldTakeOverCore(conv({ aiAgentId: b.id }), ctx([a, b]))
    expect(r.take).toBe(true)
    if (r.take) expect(r.agent.id).toBe(b.id)
  })
  it('prefiere el agente asignado explícitamente a esa cuenta', () => {
    const any = pilot()
    const specific = agent({ autopilot: true, autopilotChannels: ['WHATSAPP'], autopilotAccounts: ['WHATSAPP:default'] })
    const r = shouldTakeOverCore(conv(), ctx([any, specific]))
    expect(r.take && r.agent.id).toBe(specific.id)
  })
})

describe('regla de los 30 minutos', () => {
  const now = new Date('2026-09-23T15:00:00Z')
  const msg = (min: number, over: Record<string, unknown> = {}) => ({ direction: 'OUTBOUND', isInternal: false, sentById: 'u1', senderType: 'HUMAN', sentAt: new Date(now.getTime() - min * 60_000), ...over })
  it('persona hace 10 min → activa', () => expect(hasRecentHumanActivity([msg(10)], now)).toBe(true))
  it('persona hace 31 min → no', () => expect(hasRecentHumanActivity([msg(31)], now)).toBe(false))
  it('la propia IA y las automatizaciones no cuentan', () => {
    expect(hasRecentHumanActivity([msg(1, { sentById: null, senderType: 'AI' })], now)).toBe(false)
    expect(hasRecentHumanActivity([msg(1, { sentById: null, senderType: 'AUTOMATION' })], now)).toBe(false)
  })
  it('un eco de la bandeja nativa de Meta sí cuenta como persona', () => expect(hasRecentHumanActivity([msg(5, { sentById: null, senderType: 'ECHO' })], now)).toBe(true))
  it('las notas internas no cuentan', () => expect(hasRecentHumanActivity([msg(5, { isInternal: true })], now)).toBe(false))
  it('devolver la conversación a la IA anula los mensajes humanos anteriores', () => {
    const handBack = new Date(now.getTime() - 60_000)
    // La persona escribió hace 2 min y la devolvió hace 1 min: la IA puede responder
    expect(hasRecentHumanActivity([msg(2)], now, undefined, handBack)).toBe(false)
    // Si vuelve a escribir después de devolverla, la IA se calla otra vez
    expect(hasRecentHumanActivity([msg(0.5)], now, undefined, handBack)).toBe(true)
  })
})

describe('marcas', () => {
  it('se extraen y no llegan al cliente', () => {
    expect(parseMarkers('No tengo ese dato. [[HANDOFF]]')).toEqual({ text: 'No tengo ese dato.', handoff: true, done: false, spam: false, ignore: false, sensitive: false, offensive: false })
    expect(parseMarkers('¡Listo, agendado! [[DONE]]').done).toBe(true)
    expect(parseMarkers('[[SPAM]]')).toEqual({ text: '', handoff: false, done: false, spam: true, ignore: false, sensitive: false, offensive: false })
  })
  it('tolera espacios y minúsculas, y varias marcas', () => {
    const r = parseMarkers('Gracias [[ done ]]\n[[HANDOFF]]')
    expect(r.done && r.handoff).toBe(true)
    expect(r.text).toBe('Gracias')
  })
  it('texto sin marcas queda igual', () => expect(parseMarkers('Hola, ¿en qué te ayudo?').text).toBe('Hola, ¿en qué te ayudo?'))
})

describe('formato por canal', () => {
  it('**negrita** → *negrita* en WhatsApp y se limpia en los demás', () => {
    expect(formatForChannel('El precio es **$50.000** hoy', 'WHATSAPP')).toBe('El precio es *$50.000* hoy')
    expect(formatForChannel('El precio es **$50.000** hoy', 'INSTAGRAM')).toBe('El precio es $50.000 hoy')
    expect(formatForChannel('Es *importante* saberlo', 'MESSENGER')).toBe('Es importante saberlo')
  })
  it('viñetas a «•»', () => {
    expect(formatForChannel('Opciones:\n- Plomería\n* Pintura\n+ Aseo', 'SMS')).toBe('Opciones:\n• Plomería\n• Pintura\n• Aseo')
  })
  it('enlaces en corchetes a la URL entera', () => {
    expect(formatForChannel('Mira [aquí](https://lohaggo.com/servicios)', 'WHATSAPP')).toBe('Mira aquí: https://lohaggo.com/servicios')
    expect(formatForChannel('[https://lohaggo.com](https://lohaggo.com)', 'SMS')).toBe('https://lohaggo.com')
  })
  it('un asterisco suelto no se toca', () => {
    expect(formatForChannel('5 * 3 = 15', 'INSTAGRAM')).toBe('5 * 3 = 15')
    expect(formatForChannel('Aplica condiciones*', 'WHATSAPP')).toBe('Aplica condiciones*')
    expect(formatForChannel('Aplica condiciones*', 'MESSENGER')).toBe('Aplica condiciones*')
  })
  it('encabezados fuera', () => expect(formatForChannel('## Horario\nLunes a viernes', 'SMS')).toBe('Horario\nLunes a viernes'))
  it('firma cada mensaje o solo el final', () => {
    expect(applySignature('Hola', 'every', '— Equipo LoHaggo', false)).toBe('Hola\n\n— Equipo LoHaggo')
    expect(applySignature('Hola', 'final', '— Equipo', false)).toBe('Hola')
    expect(applySignature('Adiós', 'final', '— Equipo', true)).toBe('Adiós\n\n— Equipo')
    expect(applySignature('Hola', 'off', '— Equipo', true)).toBe('Hola')
  })
})

describe('troceado', () => {
  const para = (n: number) => `Párrafo ${n}. ` + 'El servicio de plomería incluye revisión, diagnóstico y reparación de fugas en cocinas y baños. '.repeat(6)

  it('documento corto: un solo fragmento', () => {
    const chunks = chunkText('Horario: lunes a viernes de 8 a 6.')
    expect(chunks).toHaveLength(1)
  })
  it('fragmentos entre 500 y 800 tokens (salvo el último) con solapamiento', () => {
    const text = Array.from({ length: 40 }, (_, i) => para(i)).join('\n\n')
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks.slice(0, -1)) {
      expect(c.tokens).toBeGreaterThanOrEqual(CHUNK_MIN)
      expect(c.tokens).toBeLessThanOrEqual(CHUNK_MAX + 20)
    }
    // Overlap: the start of chunk n+1 repeats the tail of chunk n
    const tail = chunks[0].text.split(/\s+/).slice(-5).join(' ')
    expect(chunks[1].text.startsWith(tail) || chunks[1].text.includes(tail)).toBe(true)
  })
  it('texto sin párrafos (CSV largo) también se corta', () => {
    const csv = Array.from({ length: 800 }, (_, i) => `fila${i},precio ${i * 1000}`).join(' ')
    const chunks = chunkText(csv)
    expect(chunks.length).toBeGreaterThan(1)
    expect(Math.max(...chunks.map((c) => c.tokens))).toBeLessThanOrEqual(CHUNK_MAX + 20)
  })
  it('estimación de tokens', () => expect(estimateTokens('abcd'.repeat(100))).toBe(100))
  it('búsqueda léxica: título y términos raros pesan más', () => {
    const ranked = rankLexical('¿Cuánto cuesta la plomería?', [
      { title: 'Precios de plomería', text: 'La visita de plomería cuesta $60.000.' },
      { title: 'Horario', text: 'Atendemos de lunes a viernes.' },
    ])
    expect(ranked[0].title).toBe('Precios de plomería')
    expect(ranked).toHaveLength(1)
  })
})

describe('ventana de memoria', () => {
  it('mínimo 4 mensajes', () => {
    expect(effectiveWindow(2)).toBe(4)
    expect(effectiveWindow(20)).toBe(20)
  })
  it('resume cuando hay mensajes fuera de la ventana y ha salido media ventana nueva', () => {
    expect(needsSummary(15, 20, 0)).toBe(false)
    expect(needsSummary(21, 20, 0)).toBe(true)
    expect(needsSummary(30, 20, 5)).toBe(false) // 10 fuera, 5 ya resumidos
    expect(needsSummary(35, 20, 5)).toBe(true) // 15 fuera, 10 nuevos
  })
  it('turnos: roles, fusión de seguidos, sin notas internas y empezando por el cliente', () => {
    const turns = toTurns([
      { direction: 'OUTBOUND', body: 'Mensaje de campaña' },
      { direction: 'INBOUND', body: 'Hola' },
      { direction: 'INBOUND', body: '¿Tienen plomeros?' },
      { direction: 'OUTBOUND', body: 'nota', isInternal: true },
      { direction: 'OUTBOUND', body: 'Sí, claro.' },
    ])
    expect(turns).toEqual([
      { role: 'user', content: 'Hola\n¿Tienen plomeros?' },
      { role: 'assistant', content: 'Sí, claro.' },
    ])
  })
})

describe('buildSystem', () => {
  const a = { name: 'Sofía', goal: 'Agendar visitas', instructions: 'Trata de usted.', tone: 'Cercano y profesional', language: 'auto', handoffOnUnknown: true, ignoreSpam: true, signatureMode: 'off', signatureText: null }
  const base = {
    nowText: 'martes 24 de septiembre de 2026, 10:15', timezone: 'America/Bogota', channel: 'WHATSAPP',
    contact: { name: 'Ana', tags: [], fields: {}, linkedUser: false }, summary: null, toolGuidance: '',
  }

  it('orden: identidad → reglas → conocimiento → contexto; lo variable al final y sin caché', () => {
    const blocks = buildSystem(a, { ...base, knowledge: { mode: 'full', chunks: [{ docId: 'd', title: 'Precios', text: 'Visita $60.000', score: 1 }] } })
    expect(blocks).toHaveLength(4)
    expect(blocks[0].text).toContain('Sofía')
    expect(blocks[1].text).toContain('[[HANDOFF]]')
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[2].text).toContain('### Precios')
    expect(blocks[2].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[3].text).toContain('hoy es martes 24 de septiembre de 2026, 10:15')
    expect(blocks[3].cache_control).toBeUndefined()
  })
  it('el prefijo cacheado no cambia entre turnos (fecha y contacto solo en el último bloque)', () => {
    const k = { mode: 'full' as const, chunks: [{ docId: 'd', title: 'T', text: 'x', score: 1 }] }
    const t1 = buildSystem(a, { ...base, knowledge: k })
    const t2 = buildSystem(a, { ...base, knowledge: k, nowText: 'miércoles 25 de septiembre de 2026, 09:00', contact: { name: 'Luis', tags: ['vip'], fields: { ciudad: 'Medellín' }, linkedUser: true } })
    expect(t1.slice(0, 3)).toEqual(t2.slice(0, 3))
    expect(t1[3]).not.toEqual(t2[3])
  })
  it('fragmentos recuperados no se marcan para caché (cambian por turno)', () => {
    const blocks = buildSystem(a, { ...base, knowledge: { mode: 'semantic', chunks: [{ docId: 'd', title: 'T', text: 'x', score: 0.8 }] } })
    expect(blocks[2].cache_control).toBeUndefined()
  })
  it('reglas: sin Markdown, no inventar, spam prudente, firma', () => {
    const rules = buildSystem(a, { ...base, knowledge: { mode: 'none', chunks: [] } })[1].text
    expect(rules).toMatch(/Sin Markdown/)
    expect(rules).toMatch(/No inventes pedidos, precios, plazos, disponibilidad/)
    expect(rules).toMatch(/Ante cualquier duda NO lo marques/)
    expect(rules).toMatch(/despidas.*Sofía/)
    const signed = buildSystem({ ...a, signatureMode: 'every', signatureText: '— Equipo' }, { ...base, knowledge: { mode: 'none', chunks: [] } })[1].text
    expect(signed).toMatch(/firma del negocio se añade sola/)
  })
  it('idioma fijo', () => {
    const rules = buildSystem({ ...a, language: 'en' }, { ...base, knowledge: { mode: 'none', chunks: [] } })[1].text
    expect(rules).toMatch(/Responde siempre en inglés/)
  })
})

import { accountAllowed, accountKeysOf } from '@/lib/ai/runtime-core'

describe('claves de cuenta estables', () => {
  it('sin conexión: CANAL:default', () => expect(accountKeysOf({ channel: 'WHATSAPP', connectionId: null })).toEqual(['WHATSAPP:default']))
  it('con conexión Meta: clave estable por id de página + id interno heredado', () => {
    expect(accountKeysOf({ channel: 'INSTAGRAM', connectionId: 'conn_new', connectionExternalId: '1784140' })).toEqual(['INSTAGRAM:1784140', 'conn_new'])
  })
  it('reconectar la cuenta (nuevo id interno) no desactiva al agente', () => {
    const a = agent({ autopilot: true, autopilotChannels: ['INSTAGRAM'], autopilotAccounts: ['INSTAGRAM:1784140'] })
    const r = shouldTakeOverCore(conv({ channel: 'INSTAGRAM', connectionId: 'conn_after_reconnect', connectionExternalId: '1784140' }), { agents: [a], recentHumanActivity: false })
    expect(r.take).toBe(true)
  })
  it('un agente guardado con el id interno antiguo sigue funcionando mientras exista', () => {
    expect(accountAllowed({ autopilotAccounts: ['conn_old'] }, ['MESSENGER:218', 'conn_old'])).toBe(true)
    expect(accountAllowed({ autopilotAccounts: ['conn_old'] }, ['MESSENGER:218', 'conn_new'])).toBe(false)
  })
})
