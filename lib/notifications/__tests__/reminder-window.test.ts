import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { REMINDER_WINDOWS, bookingStart, candidateScheduledRange, expiringSoonMessage, inReminderWindow, minutesUntilStart } from '@/lib/notifications/reminder-window'

describe('bookingStart (hora de Bogotá)', () => {
  it('día en medianoche UTC + hora local', () => {
    expect(bookingStart({ scheduledDate: new Date('2026-10-03T00:00:00.000Z'), scheduledTime: '10:00' }).toISOString()).toBe('2026-10-03T15:00:00.000Z')
  })
  it('instante completo de la noche no se corre un día', () => {
    // 21:00 del 2 de octubre en Bogotá = 02:00Z del 3
    expect(bookingStart({ scheduledDate: new Date('2026-10-03T02:00:00.000Z'), scheduledTime: '21:00' }).toISOString()).toBe('2026-10-03T02:00:00.000Z')
  })
  it('entiende am/pm', () => {
    expect(bookingStart({ scheduledDate: new Date('2026-10-03T00:00:00.000Z'), scheduledTime: '3:30 pm' }).toISOString()).toBe('2026-10-03T20:30:00.000Z')
  })
})

describe('ventanas de recordatorio', () => {
  const booking = { scheduledDate: new Date('2026-10-03T00:00:00.000Z'), scheduledTime: '10:00' } // 15:00Z

  it('24 h: sale el día antes a la hora real, no 5 h antes', () => {
    expect(inReminderWindow(booking, new Date('2026-10-02T15:00:00.000Z'), REMINDER_WINDOWS.day)).toBe(true)
    // 5 h off (UTC reading of 10:00) must not be what decides
    expect(inReminderWindow(booking, new Date('2026-10-01T15:00:00.000Z'), REMINDER_WINDOWS.day)).toBe(false)
    expect(inReminderWindow(booking, new Date('2026-10-02T20:00:00.000Z'), REMINDER_WINDOWS.day)).toBe(false)
  })

  it('«empieza pronto» sale 30–90 min antes, también en urgentes con instante completo', () => {
    expect(inReminderWindow(booking, new Date('2026-10-03T14:00:00.000Z'), REMINDER_WINDOWS.soon)).toBe(true)
    expect(inReminderWindow(booking, new Date('2026-10-03T14:45:00.000Z'), REMINDER_WINDOWS.soon)).toBe(false)
    const urgent = { scheduledDate: new Date('2026-10-01T20:00:00.000Z'), scheduledTime: '15:00' }
    expect(minutesUntilStart(urgent, new Date('2026-10-01T19:00:00.000Z'))).toBe(60)
    expect(inReminderWindow(urgent, new Date('2026-10-01T19:00:00.000Z'), REMINDER_WINDOWS.soon)).toBe(true)
  })

  it('el rango de candidatas cubre ambos formatos de scheduledDate', () => {
    const now = new Date('2026-10-02T03:00:00.000Z') // 22:00 del 1 en Bogotá
    const r = candidateScheduledRange(now)
    expect(r.gte.getTime()).toBeLessThanOrEqual(new Date('2026-10-01T00:00:00.000Z').getTime())
    expect(r.lte.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-03T00:00:00.000Z').getTime())
  })
})

describe('mensaje de solicitud por expirar', () => {
  it('sin propuestas no pide revisarlas', () => {
    expect(expiringSoonMessage('Plomería', 0)).toContain('Aún no recibes propuestas; te avisamos si llega alguna, o escríbenos por WhatsApp')
    expect(expiringSoonMessage('Plomería', 2)).toContain('Revisa las propuestas recibidas')
  })
})
