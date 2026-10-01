import { describe, expect, it } from 'vitest'
import { formatCapabilities, formatSummary } from '@/lib/marketing/format-capabilities'
import { scopesFor } from '@/lib/messaging/meta-graph'

const IG_PUBLISH = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
const FB_PUBLISH = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement']

describe('formatCapabilities', () => {
  it('Instagram with publish scopes and no insights: publishes every format, cannot measure', () => {
    const caps = formatCapabilities('INSTAGRAM', IG_PUBLISH)
    expect(caps.map((c) => c.key)).toEqual(['feed', 'carousel', 'reel', 'trial_reel', 'story'])
    expect(caps.every((c) => c.canPublish)).toBe(true)
    expect(caps.every((c) => c.canMeasure === false)).toBe(true)
    expect(caps[0].missing).toEqual(['instagram_manage_insights'])
  })

  it('Facebook with everything: publishes and measures', () => {
    const caps = formatCapabilities('MESSENGER', [...FB_PUBLISH, 'read_insights'])
    expect(caps.every((c) => c.canPublish && c.canMeasure && c.missing.length === 0)).toBe(true)
    expect(caps.find((c) => c.key === 'reel')?.ready).toBe(true)
  })

  it('missing a publish scope blocks publishing', () => {
    const caps = formatCapabilities('MESSENGER', ['pages_show_list', 'pages_read_engagement'])
    expect(caps.every((c) => c.canPublish === false)).toBe(true)
    expect(caps[0].missing).toContain('pages_manage_posts')
  })

  it('unknown scopes: null, nothing reported missing', () => {
    const caps = formatCapabilities('INSTAGRAM', null)
    expect(caps.every((c) => c.canPublish === null && c.canMeasure === null && c.missing.length === 0)).toBe(true)
    expect(formatSummary('INSTAGRAM', caps)).toMatch(/no se pudieron leer/)
  })

  it('summary names what lacks code and permissions', () => {
    const s = formatSummary('INSTAGRAM', formatCapabilities('INSTAGRAM', IG_PUBLISH))
    expect(s).toContain('Historia')
    expect(s).toContain('Reel de prueba (no disponible)')
    expect(s).toContain('sin permiso de estadísticas')
    expect(s).toContain('instagram_manage_insights')
  })
})

describe('scopesFor insights', () => {
  it('asks statistics permissions only on opt-in', () => {
    expect(scopesFor('INSTAGRAM')).not.toContain('instagram_manage_insights')
    expect(scopesFor('INSTAGRAM', { insights: true })).toContain('instagram_manage_insights')
    expect(scopesFor('MESSENGER', { insights: true })).toContain('read_insights')
  })

  it('Instagram publishing asks pages_read_engagement (Facebook Login requires it)', () => {
    expect(scopesFor('INSTAGRAM')).toContain('pages_read_engagement')
  })
})
