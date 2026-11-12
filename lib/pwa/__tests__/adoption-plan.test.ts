import { describe, expect, it } from 'vitest'
import { planPwaIncidents } from '@/lib/pwa/adoption-alerts'

const T = ['PWA_ADOPTION_INSTALL_RATE', 'PWA_ADOPTION_PUSH_OPT_IN_RATE']
const inc = (id: string, type: string, mins: number) => ({ id, type, lastSeenAt: new Date(Date.now() - mins * 60_000) })

describe('planPwaIncidents', () => {
  it('keeps the most recent per active type and closes duplicates', () => {
    const p = planPwaIncidents([T[0]], [inc('a', T[0], 30), inc('b', T[0], 5), inc('c', T[0], 90)], T)
    expect(p.keep[T[0]]).toBe('b')
    expect(p.resolve.sort()).toEqual(['a', 'c'])
  })
  it('closes incidents of conditions that cleared', () => {
    const p = planPwaIncidents([T[0]], [inc('a', T[0], 5), inc('x', T[1], 5)], T)
    expect(p.keep).toEqual({ [T[0]]: 'a' })
    expect(p.resolve).toEqual(['x'])
  })
  it('keeps nothing when no incident exists', () => {
    expect(planPwaIncidents([T[0]], [], T)).toEqual({ keep: {}, resolve: [] })
  })
})
