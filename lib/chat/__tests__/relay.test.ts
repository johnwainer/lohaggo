import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ emitProposalBroadcast: vi.fn(), emitProposalReadBroadcast: vi.fn() }))
vi.mock('@/lib/cloudinary', () => ({ cloudinaryService: { cloudName: () => 'lohaggo' } }))

import { withoutLinks } from '@/lib/chat/ops'
import { detectContactInfo } from '@/lib/chat/contact-guard'

describe('withoutLinks (lo que se reenvía al WhatsApp de la otra parte)', () => {
  it('oculta enlaces y dominios, deja el resto', () => {
    expect(withoutLinks('Paga aquí https://pago-falso.co/x y listo')).toBe('Paga aquí [enlace oculto, míralo en la app] y listo')
    expect(withoutLinks('entra a www.algo.com')).toBe('entra a [enlace oculto, míralo en la app]')
    expect(withoutLinks('mira pagos-lohaggo.com/pagar')).toBe('mira [enlace oculto, míralo en la app]')
    expect(withoutLinks('Llego a las 9. Traigo escalera.')).toBe('Llego a las 9. Traigo escalera.')
  })
})

describe('detectContactInfo', () => {
  it('bloquea teléfonos y correos, deja pasar un mensaje normal', () => {
    expect(detectContactInfo('escríbeme al 3001234567').isValid).toBe(false)
    expect(detectContactInfo('mi correo es ana@x.com').isValid).toBe(false)
    expect(detectContactInfo('¿Puede ir el lunes a las 9?').isValid).toBe(true)
  })
})
