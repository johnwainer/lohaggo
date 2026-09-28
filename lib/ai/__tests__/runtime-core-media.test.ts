import { describe, expect, it } from 'vitest'
import { messageText, toTurns } from '@/lib/ai/runtime-core'

describe('messageText · fotos que ve el agente', () => {
  it('una foto con texto se lee como foto (el caso real: «Esta es la foto de lo que hay q reparar»)', () => {
    expect(messageText({ direction: 'INBOUND', body: 'Esta es la foto de lo que hay q reparar', mediaUrl: 'https://api.twilio.com/x', mediaType: 'image/jpeg' })).toBe('📷 Imagen: Esta es la foto de lo que hay q reparar')
  })
  it('sin texto queda la etiqueta; sin adjunto, el texto tal cual', () => {
    expect(messageText({ direction: 'INBOUND', body: '📷 Imagen', mediaUrl: 'https://api.twilio.com/x', mediaType: 'image/jpeg' })).toBe('📷 Imagen')
    expect(messageText({ direction: 'INBOUND', body: '', mediaUrl: 'https://api.twilio.com/x', mediaType: 'audio/ogg' })).toBe('🎤 Nota de voz')
    expect(messageText({ direction: 'INBOUND', body: 'Hola' })).toBe('Hola')
  })
  it('toTurns ya no descarta la foto sin texto ni pierde la del texto', () => {
    const turns = toTurns([
      { direction: 'OUTBOUND', body: 'Envíamela por aquí' },
      { direction: 'INBOUND', body: 'Esta es la foto', mediaUrl: 'https://api.twilio.com/x', mediaType: 'image/jpeg' },
    ])
    expect(turns).toEqual([{ role: 'user', content: '📷 Imagen: Esta es la foto' }])
  })
})
