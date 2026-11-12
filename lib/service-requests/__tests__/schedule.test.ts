import { describe, expect, it } from 'vitest'
import { DAY_CHIPS, chipFromDate, dayChipDate, rangeAvailable, rangeFromTime, rangeNote, rangeTime, scheduledMomentOk } from '@/lib/service-requests/schedule'
import { timingPayload } from '@/lib/service-requests/draft'

// 2026-11-12 09:30 in Bogotá
const now = new Date('2026-11-12T14:30:00.000Z')

describe('chips de día', () => {
  it('hoy, mañana y en 5 días son días de Bogotá', () => {
    expect(dayChipDate('today', now)).toBe('2026-11-12')
    expect(dayChipDate('tomorrow', now)).toBe('2026-11-13')
    expect(dayChipDate('plus5', now)).toBe('2026-11-17')
  })

  it('cerca de medianoche UTC sigue siendo el día de Bogotá', () => {
    const late = new Date('2026-11-13T03:00:00.000Z') // 12 nov 22:00 Bogotá
    expect(dayChipDate('today', late)).toBe('2026-11-12')
    expect(dayChipDate('tomorrow', late)).toBe('2026-11-13')
  })

  it('chipFromDate devuelve el chip o null para otro día', () => {
    expect(chipFromDate('2026-11-13', now)).toBe('tomorrow')
    expect(chipFromDate('2026-11-14', now)).toBeNull()
    expect(chipFromDate('', now)).toBeNull()
    expect(DAY_CHIPS).toHaveLength(3)
  })
})

describe('franjas horarias', () => {
  it('cada franja manda su hora de inicio; cualquier hora no manda ninguna', () => {
    expect(rangeTime('morning')).toBe('08:00')
    expect(rangeTime('afternoon')).toBe('14:00')
    expect(rangeTime('evening')).toBe('18:00')
    expect(rangeTime('any')).toBe('')
    expect(rangeTime('exact', '16:45')).toBe('16:45')
    expect(rangeTime('exact', '99:99')).toBe('')
  })

  it('rangeFromTime reconoce las franjas y trata otra hora como exacta', () => {
    expect(rangeFromTime('')).toBe('any')
    expect(rangeFromTime('14:00')).toBe('afternoon')
    expect(rangeFromTime('16:45')).toBe('exact')
  })

  it('hoy no ofrece una franja que empieza en menos de una hora', () => {
    expect(rangeAvailable('morning', '2026-11-12', now)).toBe(false) // 8:00 ya pasó
    expect(rangeAvailable('afternoon', '2026-11-12', now)).toBe(true)
    expect(rangeAvailable('morning', '2026-11-13', now)).toBe(true)
    expect(rangeAvailable('exact', '2026-11-12', now)).toBe(true)
  })

  it('la nota de franja solo existe para mañana, tarde y noche', () => {
    expect(rangeNote('morning')).toContain('mañana')
    expect(rangeNote('any')).toBeNull()
    expect(rangeNote('exact')).toBeNull()
  })
})

describe('momento pedido', () => {
  it('un día pasado no vale; hoy exige una hora a más de 60 min', () => {
    expect(scheduledMomentOk('2026-11-11', '', now)).toBe(false)
    expect(scheduledMomentOk('2026-11-12', '', now)).toBe(true)
    expect(scheduledMomentOk('2026-11-12', '10:00', now)).toBe(false)
    expect(scheduledMomentOk('2026-11-12', '10:30', now)).toBe(true)
    expect(scheduledMomentOk('2026-11-13', '07:00', now)).toBe(true)
    expect(scheduledMomentOk('', '', now)).toBe(false)
  })
})

describe('timingPayload con franja', () => {
  it('mantiene compatibilidad: fecha + hora opcional, y la franja viaja en la nota', () => {
    expect(timingPayload('scheduled', '2026-11-13', '', now)).toMatchObject({ preferredDate: '2026-11-13', preferredTime: null, note: null })
    expect(timingPayload('scheduled', '2026-11-13', '14:00', now, 'afternoon')).toMatchObject({ preferredDate: '2026-11-13', preferredTime: '14:00', note: expect.stringContaining('tarde') })
    expect(timingPayload('flexible', '', '', now, 'morning').note).toBeNull()
  })
})
