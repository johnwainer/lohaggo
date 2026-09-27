import { describe, expect, it } from 'vitest'
import { CONFIRM_WINDOW_MS, confirmationGate, dailyLimitFor, DAILY_ACTION_LIMITS, sameActionInput } from '@/lib/ai/actions-core'
import { cityFromText, parseWhen } from '@/lib/ai/platform-tools'

describe('confirmationGate', () => {
  const now = new Date('2026-10-01T15:00:00Z')
  it('asks first: without confirmado nothing runs, even with a recent proposal', () => {
    expect(confirmationGate({ confirmado: false, proposedAt: new Date(now.getTime() - 60_000), now })).toBe('ask')
    expect(confirmationGate({ confirmado: false, proposedAt: null, now })).toBe('ask')
  })
  it('a yes without a proposal in the window is stale (cannot be invented in one turn)', () => {
    expect(confirmationGate({ confirmado: true, proposedAt: null, now })).toBe('stale')
    expect(confirmationGate({ confirmado: true, proposedAt: new Date(now.getTime() - CONFIRM_WINDOW_MS - 1), now })).toBe('stale')
  })
  it('a yes within the window runs', () => {
    expect(confirmationGate({ confirmado: true, proposedAt: new Date(now.getTime() - CONFIRM_WINDOW_MS + 1000), now })).toBe('run')
  })
})

describe('daily limits', () => {
  it('money and commitment tools have a limit; reads do not', () => {
    expect(dailyLimitFor('crear_solicitud')).toBe(DAILY_ACTION_LIMITS.crear_solicitud)
    expect(dailyLimitFor('cancelar_reserva')).toBe(2)
    expect(dailyLimitFor('ver_mis_reservas')).toBeNull()
  })
})

describe('parseWhen', () => {
  it('combines date and time in Bogotá', () => {
    const w = parseWhen('2026-10-03', '9:05')
    expect(w?.scheduledTime).toBe('09:05')
    expect(w?.scheduledDate.toISOString()).toBe('2026-10-03T14:05:00.000Z')
  })
  it('rejects bad input', () => {
    expect(parseWhen('3/10/2026', '10:00')).toBeNull()
    expect(parseWhen('2026-10-03', '25:00')).toBeNull()
    expect(parseWhen('2026-10-03', '')).toBeNull()
  })
})

describe('cityFromText', () => {
  it('maps names with or without accents and falls back to Medellín', () => {
    expect(cityFromText('Bogotá')).toBe('BOGOTA')
    expect(cityFromText('en medellin')).toBe('MEDELLIN')
    expect(cityFromText('Cali')).toBe('CALI')
    expect(cityFromText('Pereira')).toBe('MEDELLIN')
  })
})

describe('confirmation must be about the same thing', () => {
  it('a yes with different data than the proposal is a mismatch', () => {
    const proposedAt = new Date(Date.now() - 60_000)
    const a = { reserva_ref: '000abc', motivo: 'viaje', confirmado: false }
    const b = { reserva_ref: '000xyz', motivo: 'viaje', confirmado: true }
    expect(sameActionInput(a, { ...a, confirmado: true })).toBe(true)
    expect(sameActionInput(a, b)).toBe(false)
    expect(confirmationGate({ confirmado: true, proposedAt, sameInput: false })).toBe('mismatch')
    expect(confirmationGate({ confirmado: true, proposedAt, sameInput: true })).toBe('run')
  })
  it('ignores surrounding spaces and key order', () => {
    expect(sameActionInput({ b: ' x ', a: 1 }, { a: 1, b: 'x', confirmado: true })).toBe(true)
  })
})
