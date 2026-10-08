import { describe, expect, it } from 'vitest'
import { partnerShareUrl } from '@/lib/partners/share-url'

describe('partner share links', () => {
  it('tag the visit as shared by the partner, by medium', () => {
    expect(partnerShareUrl('ana-gomez-medellin', 'whatsapp')).toBe('https://www.lohaggo.com/pro/ana-gomez-medellin?utm_source=socio&utm_medium=whatsapp&utm_campaign=perfil_socio')
    expect(partnerShareUrl('ana', 'imagen')).toContain('utm_medium=imagen')
  })
})
