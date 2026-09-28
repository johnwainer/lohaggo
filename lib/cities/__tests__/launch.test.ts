import { describe, expect, it } from 'vitest'
import { LAUNCH_MIN, evaluateLaunch } from '@/lib/cities/launch-core'
import { cityEnumOfSlug } from '@/lib/cities/launch'

const svc = (slug: string, verified: number) => ({ slug, name: slug, verified })

describe('city launch', () => {
  it('ready only with the focus services covered and enough partners', () => {
    const full = [svc('plomeria', 3), svc('electricidad', 4), svc('pintura', 3), svc('limpieza-hogar', 5), svc('masajes', 0)]
    const r = evaluateLaunch({ city: 'Bogotá', partnersByService: full, totalVerified: LAUNCH_MIN.totalVerified, waitlist: { clients: 0, partners: 0, withWhatsapp: 0 } })
    expect(r.ready).toBe(true)
    expect(r.recruitFirst).toEqual(['masajes'])
    const thin = evaluateLaunch({ city: 'Bogotá', partnersByService: [svc('plomeria', 1)], totalVerified: 2, waitlist: { clients: 10, partners: 1, withWhatsapp: 4 } })
    expect(thin.ready).toBe(false)
    expect(thin.gaps.map((g) => g.slug)).toEqual(['plomeria', 'electricidad', 'pintura', 'limpieza-hogar'])
    expect(thin.recruitFirst[0]).toBe('plomeria')
  })
  it('maps city slugs to the enum', () => {
    expect(cityEnumOfSlug('bogota')).toBe('BOGOTA')
    expect(cityEnumOfSlug('medellin')).toBe('MEDELLIN')
    expect(cityEnumOfSlug('pereira')).toBeNull()
  })
})
