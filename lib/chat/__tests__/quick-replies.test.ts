import { describe, expect, it } from 'vitest'
import { QUICK_REPLIES, messageTextFor, photoProblem, quickRepliesFor } from '@/lib/chat/quick-replies'
import { PHOTO_ONLY_TEXT } from '@/lib/chat/constants'
import { detectContactInfo } from '@/lib/chat/contact-guard'

describe('respuestas rápidas', () => {
  it('el socio y el cliente tienen las suyas', () => {
    expect(quickRepliesFor('PARTNER')).toContain('Voy en camino')
    expect(quickRepliesFor('PARTNER')).toContain('¿Me envías una foto?')
    expect(quickRepliesFor('CLIENT')).not.toContain('Voy en camino')
    expect(quickRepliesFor(undefined)).toEqual(QUICK_REPLIES.CLIENT)
  })

  it('ninguna es bloqueada por el filtro de contacto', () => {
    for (const text of [...QUICK_REPLIES.PARTNER, ...QUICK_REPLIES.CLIENT]) {
      expect(detectContactInfo(text).isValid).toBe(true)
    }
  })
})

describe('mensaje con foto', () => {
  it('solo foto → el texto marcador; con texto, el texto', () => {
    expect(messageTextFor('  ', true)).toBe(PHOTO_ONLY_TEXT)
    expect(messageTextFor('Mira', true)).toBe('Mira')
    expect(messageTextFor('  ', false)).toBe('')
  })

  it('rechaza lo que no es imagen o pesa demasiado', () => {
    expect(photoProblem({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(photoProblem({ type: 'application/pdf', size: 1000 })).toMatch(/fotos/)
    expect(photoProblem({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10 MB/)
  })
})
