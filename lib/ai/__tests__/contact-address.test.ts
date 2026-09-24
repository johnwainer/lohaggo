import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { normalizeContactAddress, twilioAddress } from '@/lib/messaging/contact-address'
import { toE164 } from '@/lib/inbox/contacts'

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


describe('teléfono del contacto', () => {
  it('acepta formatos locales e internacionales', () => {
    expect(toE164('300 123 4567')).toBe('+573001234567')
    expect(toE164('+1 (904) 988-6515')).toBe('+19049886515')
  })
  it('rechaza identificadores de WhatsApp y basura', () => {
    expect(toE164('CO.4073604069448271')).toBeNull()
    expect(toE164('hola')).toBeNull()
    expect(toE164('')).toBeNull()
  })
})
