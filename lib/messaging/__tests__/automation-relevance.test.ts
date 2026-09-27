import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/messaging/providers', () => ({}))
vi.mock('@/lib/messaging/provider-config', () => ({}))
vi.mock('@/lib/messaging/inbox-emitter', () => ({ emitInboxEvent: () => {} }))
vi.mock('@/lib/workspaces', () => ({}))
vi.mock('@/lib/messaging/whatsapp-templates', () => ({}))

import { DEFAULT_AUTOMATION_RULES, LEGACY_DEFAULT_BODIES, automationSkipReason, missingDefaultRules } from '@/lib/messaging/automation-service'

describe('relevancia antes de enviar', () => {
  it('primer servicio: no si ya pidió algo; marketing respeta la exclusión', () => {
    expect(automationSkipReason('CLIENT_FIRST_BOOKING_NUDGE', { hasRequestOrBooking: true })).toBe('Ya tiene una solicitud o reserva')
    expect(automationSkipReason('CLIENT_FIRST_BOOKING_NUDGE', { hasRequestOrBooking: false })).toBeNull()
    expect(automationSkipReason('CLIENT_REFERRAL_REMINDER', { excludedFromMarketing: true })).toBe('Excluido de marketing')
    expect(automationSkipReason('PARTNER_REFERRAL_REMINDER', { excludedFromMarketing: true })).toBe('Excluido de marketing')
  })
  it('las transaccionales de reserva no miran la exclusión de marketing', () => {
    expect(automationSkipReason('BOOKING_CREATED', { excludedFromMarketing: true })).toBeNull()
    expect(automationSkipReason('BOOKING_COMPLETED', { excludedFromMarketing: true })).toBeNull()
  })
  it('documentos: no si ya está verificado o ya subió identidad', () => {
    expect(automationSkipReason('PARTNER_DOCS_REMINDER', { partnerVerified: true })).toBe('Socio ya verificado')
    expect(automationSkipReason('PARTNER_DOCS_REMINDER', { hasIdentityDoc: true })).toBe('Ya subió su documento de identidad')
    expect(automationSkipReason('PARTNER_DOCS_REMINDER', {})).toBeNull()
  })
})

describe('reglas por defecto', () => {
  it('ningún enlace de las reglas apunta a rutas que no existen', () => {
    const bodies = DEFAULT_AUTOMATION_RULES.map((r) => r.customBody ?? '').join('\n')
    expect(bodies).not.toMatch(/\/buscar|\/mis-reservas/)
    for (const next of Object.values(LEGACY_DEFAULT_BODIES)) expect(next).not.toMatch(/\/buscar|\/mis-reservas/)
  })
  it('solo faltan las que no existen por nombre ni por disparador + rol + canales', () => {
    const existing = [
      { name: 'Bienvenida Socio (Email)', trigger: 'PARTNER_REGISTERED', targetRole: 'PARTNER', channels: JSON.stringify(['EMAIL']) },
      { name: 'Renombrada por el admin', trigger: 'CLIENT_REGISTERED', targetRole: 'CLIENT', channels: JSON.stringify(['EMAIL']) },
    ]
    const missing = missingDefaultRules(existing, DEFAULT_AUTOMATION_RULES)
    expect(missing.map((r) => r.name)).not.toContain('Bienvenida Socio (Email)')
    expect(missing.map((r) => r.name)).not.toContain('Bienvenida Cliente (Email)')
    expect(missing).toHaveLength(DEFAULT_AUTOMATION_RULES.length - 2)
    expect(missingDefaultRules(DEFAULT_AUTOMATION_RULES.map((r) => ({ ...r, targetRole: r.targetRole ?? null })), DEFAULT_AUTOMATION_RULES)).toEqual([])
  })
})
