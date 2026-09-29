import { describe, expect, it } from 'vitest'
import { WA_CATALOG, contentTypes } from '@/lib/messaging/wa-catalog'

describe('WA_CATALOG · reglas de Meta', () => {
  it('82 plantillas con nombres únicos', () => {
    expect(WA_CATALOG).toHaveLength(82)
    expect(new Set(WA_CATALOG.map((t) => t.name)).size).toBe(82)
  })
  it('ningún texto empieza ni termina con variable, ni junta dos variables', () => {
    for (const t of WA_CATALOG.filter((x) => x.body)) {
      const b = t.body!.trim()
      expect(b, t.name).not.toMatch(/^\{\{\d+\}\}/)
      expect(b, t.name).not.toMatch(/\{\{\d+\}\}[.!?*]?$/)
      expect(b, t.name).not.toMatch(/\}\}[\s#]*\{\{/)
    }
  })
  it('cada variable usada tiene ejemplo y no sobra ninguno', () => {
    for (const t of WA_CATALOG.filter((x) => x.category !== 'AUTHENTICATION')) {
      const text = `${t.body ?? ''} ${t.url?.url ?? ''}`
      const used = Array.from(new Set(Array.from(text.matchAll(/\{\{(\d+)\}\}/g), (m) => m[1])))
      expect(used.sort(), t.name).toEqual(Object.keys(t.variables).sort())
    }
  })
  it('botones dentro de los límites de WhatsApp y URL con la variable solo al final', () => {
    for (const t of WA_CATALOG) {
      expect(t.quickReplies.length, t.name).toBeLessThanOrEqual(3)
      for (const q of t.quickReplies) expect(q.title.length, `${t.name}:${q.title}`).toBeLessThanOrEqual(20)
      if (t.url) {
        expect(t.url.title.length, t.name).toBeLessThanOrEqual(25)
        expect(t.url.url, t.name).toMatch(/^https:\/\/www\.lohaggo\.com\/\{\{\d+\}\}$/)
      }
    }
  })
  it('elige el tipo de contenido según los botones', () => {
    const byName = (n: string) => WA_CATALOG.find((t) => t.name === n)!
    expect(Object.keys(contentTypes(byName('lh_codigo_verificacion')))).toEqual(['whatsapp/authentication'])
    expect(Object.keys(contentTypes(byName('lh_cliente_nueva_propuesta')))).toEqual(['twilio/card'])
    expect(Object.keys(contentTypes(byName('lh_cliente_sin_propuestas')))).toEqual(['twilio/quick-reply'])
    expect(Object.keys(contentTypes(byName('lh_cliente_cuenta_creada')))).toEqual(['twilio/call-to-action'])
    expect(Object.keys(contentTypes(byName('lh_cliente_solicitud_cancelada')))).toEqual(['twilio/text'])
  })
})
