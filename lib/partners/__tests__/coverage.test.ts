import { describe, expect, it } from 'vitest'
import { availableAt, availableRestOfToday, bogotaClock, matchesRequest, parseSchedule, type ScheduleRange } from '@/lib/partners/coverage-core'

// 2026-09-28 is a Monday (dayOfWeek 1)
const bogota = (isoLocal: string) => new Date(`${isoLocal}-05:00`)
const weekdays: ScheduleRange[] = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '17:00' }))

describe('bogotaClock', () => {
  it('reads the Bogotá wall clock, not UTC', () => {
    // 20:30 Bogotá Monday = 01:30 UTC Tuesday
    expect(bogotaClock(bogota('2026-09-28T20:30:00'))).toEqual({ dayOfWeek: 1, minutes: 20 * 60 + 30 })
  })
})

describe('availableAt', () => {
  it('empty schedule is always available', () => {
    expect(availableAt([], bogota('2026-09-27T03:00:00'))).toBe(true)
  })
  it('inside a range, start inclusive, end exclusive', () => {
    expect(availableAt(weekdays, bogota('2026-09-28T08:00:00'))).toBe(true)
    expect(availableAt(weekdays, bogota('2026-09-28T16:59:00'))).toBe(true)
    expect(availableAt(weekdays, bogota('2026-09-28T17:00:00'))).toBe(false)
    expect(availableAt(weekdays, bogota('2026-09-28T07:59:00'))).toBe(false)
  })
  it('off days are not available', () => {
    expect(availableAt(weekdays, bogota('2026-09-27T10:00:00'))).toBe(false) // Sunday
  })
  it('uses Bogotá day even when UTC is already the next day', () => {
    const fridayNight: ScheduleRange[] = [{ dayOfWeek: 5, startTime: '18:00', endTime: '23:00' }]
    expect(availableAt(fridayNight, bogota('2026-10-02T21:00:00'))).toBe(true)
  })
})

describe('availableRestOfToday', () => {
  it('true while a range of today has not ended', () => {
    expect(availableRestOfToday(weekdays, bogota('2026-09-28T06:00:00'))).toBe(true)
    expect(availableRestOfToday(weekdays, bogota('2026-09-28T16:00:00'))).toBe(true)
    expect(availableRestOfToday(weekdays, bogota('2026-09-28T18:00:00'))).toBe(false)
    expect(availableRestOfToday(weekdays, bogota('2026-09-27T09:00:00'))).toBe(false)
  })
})

describe('matchesRequest', () => {
  const now = bogota('2026-09-28T10:00:00')
  it('no zones and no schedule matches anything', () => {
    expect(matchesRequest({ coverageZones: [], schedule: [] }, { zone: 'belen', isUrgent: true }, now)).toBe(true)
  })
  it('filters by zone; a request without zone matches every partner', () => {
    expect(matchesRequest({ coverageZones: ['el-poblado'] }, { zone: 'belen' }, now)).toBe(false)
    expect(matchesRequest({ coverageZones: ['el-poblado'] }, { zone: 'el-poblado' }, now)).toBe(true)
    expect(matchesRequest({ coverageZones: ['el-poblado'] }, { zone: null }, now)).toBe(true)
  })
  it('preferred date only checks the weekday (date-only stored at midnight UTC)', () => {
    expect(matchesRequest({ schedule: weekdays }, { preferredDate: new Date('2026-09-29T00:00:00Z') }, now)).toBe(true) // Tuesday
    expect(matchesRequest({ schedule: weekdays }, { preferredDate: new Date('2026-10-04T00:00:00Z') }, now)).toBe(false) // Sunday
  })
  it('preferred date and time checks the range', () => {
    const tue = new Date('2026-09-29T00:00:00Z')
    expect(matchesRequest({ schedule: weekdays }, { preferredDate: tue, preferredTime: '09:30' }, now)).toBe(true)
    expect(matchesRequest({ schedule: weekdays }, { preferredDate: tue, preferredTime: '19:00' }, now)).toBe(false)
    expect(matchesRequest({ schedule: weekdays }, { preferredDate: tue, preferredTime: '3:00 PM' }, now)).toBe(true)
  })
  it('urgent: available now or later today', () => {
    expect(matchesRequest({ schedule: weekdays }, { isUrgent: true }, now)).toBe(true)
    expect(matchesRequest({ schedule: weekdays }, { isUrgent: true }, bogota('2026-09-28T20:00:00'))).toBe(false)
  })
  it('no date and not urgent: schedule does not restrict', () => {
    expect(matchesRequest({ schedule: weekdays }, {}, bogota('2026-09-27T20:00:00'))).toBe(true)
  })
})

describe('parseSchedule', () => {
  it('sorts and accepts valid ranges', () => {
    const r = parseSchedule([{ dayOfWeek: 2, startTime: '14:00', endTime: '18:00' }, { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' }])
    expect(r.ok && r.schedule.map((x) => x.startTime)).toEqual(['08:00', '14:00'])
  })
  it('rejects bad input', () => {
    expect(parseSchedule('x').ok).toBe(false)
    expect(parseSchedule([{ dayOfWeek: 7, startTime: '08:00', endTime: '09:00' }]).ok).toBe(false)
    expect(parseSchedule([{ dayOfWeek: 1, startTime: '8:00', endTime: '09:00' }]).ok).toBe(false)
    expect(parseSchedule([{ dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }]).ok).toBe(false)
    expect(parseSchedule([{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' }]).ok).toBe(false)
  })
  it('max 3 ranges per day', () => {
    const four = ['06', '09', '12', '15'].map((h) => ({ dayOfWeek: 3, startTime: `${h}:00`, endTime: `${h}:30` }))
    expect(parseSchedule(four).ok).toBe(false)
    expect(parseSchedule(four.slice(0, 3)).ok).toBe(true)
  })
})
