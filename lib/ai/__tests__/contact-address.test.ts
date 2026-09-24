import { describe, expect, it } from 'vitest'
import { normalizeContactAddress, twilioAddress } from '@/lib/messaging/contact-address'

describe('dirección del contacto (Twilio)', () => {
  it('E.164 se respeta', () => {
    expect(normalizeContactAddress('whatsapp:+573196473402')).toBe('+573196473402')
    expect(normalizeContactAddress('+1 (407) 360-4069')).toBe('+14073604069')
  })
  it('celular colombiano local o con 57 recibe +57', () => {
    expect(normalizeContactAddress('3196473402')).toBe('+573196473402')
    expect(normalizeContactAddress('573196473402')).toBe('+573196473402')
    expect(normalizeContactAddress('319 647 3402')).toBe('+573196473402')
  })
  it('un identificador que no es teléfono no se convierte en un número +57 inválido', () => {
    expect(normalizeContactAddress('whatsapp:4073604069448271')).toBe('4073604069448271')
    expect(twilioAddress('4073604069448271', true)).toBe('whatsapp:4073604069448271')
  })
  it('para enviar usa la misma forma con o sin prefijo de WhatsApp', () => {
    expect(twilioAddress('+573196473402', true)).toBe('whatsapp:+573196473402')
    expect(twilioAddress('+573196473402', false)).toBe('+573196473402')
  })
})
