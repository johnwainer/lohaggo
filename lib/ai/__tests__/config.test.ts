import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))

import { resolutionRate, sanitizeAgentInput } from '@/lib/ai/agent-input'
import { resolveGrants } from '@/lib/ai/permissions'
import { agentToolNames, buildToolDefs, toolGuidance } from '@/lib/ai/tools'
import { googleExportUrl } from '@/lib/ai/knowledge'
import { isPrivateAddress } from '@/lib/ai/net'
import { CRM_MODULES, crmLookup, maskEmail } from '@/lib/ai/platform-data'

describe('entrada del agente', () => {
  it('filtra canales, herramientas y módulos desconocidos', () => {
    const out = sanitizeAgentInput({ channels: ['WHATSAPP', 'TELEGRAM'], tools: ['etiquetar_contacto', 'borrar_todo'], crmModules: ['reservas', 'facturas'] }, { allowModel: false })
    expect(out.channels).toEqual(['WHATSAPP'])
    expect(out.tools).toEqual(['etiquetar_contacto'])
    expect(out.crmModules).toEqual(['reservas'])
  })
  it('el modelo solo si la plataforma lo permite', () => {
    expect(sanitizeAgentInput({ model: 'claude-sonnet-5' }, { allowModel: false })).not.toHaveProperty('model')
    expect(sanitizeAgentInput({ model: 'claude-sonnet-5' }, { allowModel: true }).model).toBe('claude-sonnet-5')
  })
  it('memoria mínima 4 y límites', () => {
    expect(sanitizeAgentInput({ memoryWindow: 1, maxTokens: 999999 }, { allowModel: false })).toMatchObject({ memoryWindow: 4, maxTokens: 4096 })
  })
  it('webhook solo https y zona horaria válida', () => {
    expect(() => sanitizeAgentInput({ webhookUrl: 'http://x.com' }, { allowModel: false })).toThrow()
    expect(() => sanitizeAgentInput({ hoursTimezone: 'Marte/Olympus' }, { allowModel: false })).toThrow()
    expect(sanitizeAgentInput({ hoursTimezone: 'America/Bogota' }, { allowModel: false }).hoursTimezone).toBe('America/Bogota')
  })
  it('horas HH:MM y días 0-6', () => {
    const out = sanitizeAgentInput({ hoursStart: '25:00', hoursEnd: '18:30', hoursDays: [1, 9, 3, 3] }, { allowModel: false })
    expect(out).not.toHaveProperty('hoursStart')
    expect(out.hoursEnd).toBe('18:30')
    expect(out.hoursDays).toEqual([1, 3])
  })
  it('resolución = (conversaciones − traspasos) / conversaciones', () => {
    expect(resolutionRate(0, 0)).toBeNull()
    expect(resolutionRate(10, 3)).toBe(70)
  })
})

describe('permisos', () => {
  it('el propietario tiene todo', () => expect(resolveGrants('OWNER', [])).toHaveLength(4))
  it('un miembro solo lo concedido, y editar implica ver', () => {
    expect(resolveGrants('MEMBER', [])).toEqual([])
    expect(resolveGrants('MEMBER', ['ai.test'])).toEqual(['ai.view', 'ai.test'])
  })
})

describe('herramientas', () => {
  const base = { id: 'a', name: 'Sofía', tools: [] as string[], crmModules: [] as string[], webhookUrl: null as string | null }

  it('solo las de tools[], en orden de catálogo (prefijo estable para la caché)', () => {
    const a = { ...base, tools: ['crear_tarea', 'etiquetar_contacto'] }
    expect(agentToolNames(a)).toEqual(['etiquetar_contacto', 'crear_tarea'])
  })
  it('consultar_crm exige módulos autorizados y su enum es exactamente esos', () => {
    expect(agentToolNames({ ...base, tools: ['consultar_crm'] })).toEqual([])
    const defs = buildToolDefs({ ...base, tools: ['consultar_crm'], crmModules: ['pagos'] })
    expect((defs[0].input_schema.properties as Record<string, { enum: string[] }>).modulo.enum).toEqual(['pagos'])
  })
  it('avisar_webhook exige URL', () => {
    expect(agentToolNames({ ...base, tools: ['avisar_webhook'] })).toEqual([])
    expect(agentToolNames({ ...base, tools: ['avisar_webhook'], webhookUrl: 'https://x.co/h' })).toEqual(['avisar_webhook'])
  })
  it('elegir_salida solo dentro de un flujo, con exactamente sus salidas', () => {
    expect(buildToolDefs(base).map((d) => d.name)).toEqual([])
    const defs = buildToolDefs(base, ['compra', 'soporte'])
    expect(defs.map((d) => d.name)).toEqual(['elegir_salida'])
    expect((defs[0].input_schema.properties as Record<string, { enum: string[] }>).salida.enum).toEqual(['compra', 'soporte'])
  })
  it('todas estrictas y con guía de cuándo usarlas', () => {
    const a = { ...base, tools: ['etiquetar_contacto', 'buscar_en_conocimiento'] }
    expect(buildToolDefs(a).every((d) => d.strict === true)).toBe(true)
    expect(toolGuidance(a)).toMatch(/etiquetar_contacto: .*No etiquetes/)
  })
})

describe('Google Docs', () => {
  it('convierte enlaces de Docs, Sheets y Slides a exportación', () => {
    expect(googleExportUrl('https://docs.google.com/document/d/abc_123/edit')).toBe('https://docs.google.com/document/d/abc_123/export?format=txt')
    expect(googleExportUrl('https://docs.google.com/spreadsheets/d/XYZ/edit#gid=0')).toBe('https://docs.google.com/spreadsheets/d/XYZ/export?format=csv')
    expect(googleExportUrl('https://docs.google.com/presentation/d/P1/edit')).toBe('https://docs.google.com/presentation/d/P1/export/txt')
  })
  it('rechaza cualquier otra URL (SSRF)', () => {
    expect(googleExportUrl('http://169.254.169.254/latest')).toBeNull()
    expect(googleExportUrl('https://evil.com/docs.google.com/document/d/x')).toBeNull()
  })
})

describe('SSRF del webhook', () => {
  it('bloquea redes privadas, loopback y metadatos de la nube', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(ip)).toBe(true)
  })
  it('permite IPs públicas', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe('datos de la plataforma', () => {
  it('módulos de cliente y de socio', () => {
    expect(Object.keys(CRM_MODULES)).toEqual(expect.arrayContaining(['cuenta', 'reservas', 'socio_perfil', 'socio_documentos', 'socio_servicios', 'socio_reservas', 'socio_propuestas', 'socio_pagos']))
  })
  it('sin usuario vinculado dice "no disponible", nunca "no tiene"', async () => {
    const out = await crmLookup('socio_documentos', null)
    expect(out).toMatch(/no disponible/)
    expect(out).not.toMatch(/no tiene/)
  })
  it('un fallo de la consulta se reporta como no disponible', async () => {
    // prisma está simulado vacío: la consulta lanza
    expect(await crmLookup('reservas', 'u1')).toMatch(/no disponible en este momento/)
    expect(await crmLookup('socio_perfil', 'u1')).toMatch(/no disponible en este momento/)
  })
  it('módulo desconocido', async () => expect(await crmLookup('facturas', 'u1')).toMatch(/no disponible/))
  it('enmascara el correo', () => expect(maskEmail('juanperez@gmail.com')).toBe('ju*******@gmail.com'))
  it('la herramienta de catálogo no depende del contacto y tiene temas cerrados', () => {
    const defs = buildToolDefs({ id: 'a', name: 'S', tools: ['consultar_catalogo'], crmModules: [], webhookUrl: null })
    expect(defs[0].name).toBe('consultar_catalogo')
    expect((defs[0].input_schema.properties as Record<string, { enum?: string[] }>).tema.enum).toEqual(['servicios', 'ciudades', 'pagos'])
  })
})
