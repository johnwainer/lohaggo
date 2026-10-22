import { describe, expect, it } from 'vitest'
import { dailyFormatGaps, enforceDailyFormats, type IdeaDraft } from '@/lib/marketing/agent-core'
import { defaultAgentConfig, sanitizeAgentConfig } from '@/lib/marketing/agent-input'

const at = (s: string) => new Date(s)
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function withReels(perDay = 1) {
  return sanitizeAgentConfig({ ...defaultAgentConfig(), schedule: { ...defaultAgentConfig().schedule, days: ALL_DAYS }, channels: { ...defaultAgentConfig().channels, INSTAGRAM: { ...defaultAgentConfig().channels.INSTAGRAM, minDaily: { reel: perDay } } } })
}

const idea = (targetDate: string, channels: IdeaDraft['channels'], formats: IdeaDraft['formats'] = {}): IdeaDraft => ({
  pillar: 'P', service: null, angle: 'a', hypothesis: '', channels, formats, targetDate, slotHint: null, rationale: '', explore: false, confidence: 0.8,
})

describe('Formatos obligatorios por día', () => {
  it('la configuración guarda el mínimo diario, añade el formato y sube la frecuencia semanal', () => {
    const base = defaultAgentConfig()
    const c = sanitizeAgentConfig({ ...base, schedule: { ...base.schedule, days: ALL_DAYS }, channels: { ...base.channels, INSTAGRAM: { ...base.channels.INSTAGRAM, formats: ['feed'], perWeek: 3, minDaily: { reel: 1, nada: 2 } } } })
    expect(c.channels.INSTAGRAM.minDaily).toEqual({ reel: 1 })
    expect(c.channels.INSTAGRAM.formats).toContain('reel')
    expect(c.channels.INSTAGRAM.perWeek).toBe(7)
    // Old configs without the field keep working
    expect(sanitizeAgentConfig({ ...base, channels: { ...base.channels, INSTAGRAM: { enabled: true, perWeek: 4, formats: ['reel'], accountIds: [] } } }).channels.INSTAGRAM.minDaily).toEqual({})
    expect(sanitizeAgentConfig({ ...base, channels: { ...base.channels, INSTAGRAM: { ...base.channels.INSTAGRAM, minDaily: { reel: 9 } } } }).channels.INSTAGRAM.minDaily.reel).toBe(3)
  })

  it('cuenta los días del horizonte que aún no tienen reel', () => {
    const c = withReels()
    const now = at('2026-10-22T10:00:00-05:00')
    const planned = [
      { channel: 'INSTAGRAM' as const, at: at('2026-10-23T12:00:00-05:00'), format: 'reel' },
      { channel: 'INSTAGRAM' as const, at: at('2026-10-24T12:00:00-05:00'), format: 'feed' },
    ]
    const g = dailyFormatGaps({ now, horizonDays: 4, channels: c.channels, planned, days: ALL_DAYS })
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ channel: 'INSTAGRAM', format: 'reel', perDay: 1 })
    expect(g[0].dates).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
  })

  it('respeta los días permitidos y los dos reels al día', () => {
    const c = withReels(2)
    const g = dailyFormatGaps({ now: at('2026-10-22T10:00:00-05:00'), horizonDays: 3, channels: c.channels, planned: [], days: [5, 6] })
    // 23 = viernes, 24 = sábado, 25 = domingo (no permitido)
    expect(g[0].dates).toEqual(['2026-10-23', '2026-10-23', '2026-10-24', '2026-10-24'])
  })

  it('obliga el formato en las ideas de ese día y avisa lo que no cubre', () => {
    const ideas = [idea('2026-10-24', ['INSTAGRAM'], { INSTAGRAM: 'feed' }), idea('2026-10-25', ['FACEBOOK'], { FACEBOOK: 'foto' })]
    const r = enforceDailyFormats(ideas, [{ channel: 'INSTAGRAM', format: 'reel', dates: ['2026-10-24', '2026-10-25', '2026-10-26'] }], ['INSTAGRAM', 'FACEBOOK'])
    expect(r.ideas[0].formats.INSTAGRAM).toBe('reel')
    expect(r.ideas[1].channels).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(r.ideas[1].formats.INSTAGRAM).toBe('reel')
    expect(r.uncovered).toEqual(['2026-10-26 Instagram reel'])
  })
})
