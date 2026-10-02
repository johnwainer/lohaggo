import { describe, expect, it } from 'vitest'
import { agentFormatLabel, channelLines, formatLabel, postSortDate } from '@/lib/marketing/format-display'

const img = { id: 'i1', kind: 'image' }
const img2 = { id: 'i2', kind: 'image' }
const vid = { id: 'v1', kind: 'video' }

describe('format labels', () => {
  it('names each network format', () => {
    expect(formatLabel('INSTAGRAM', 'story', [img])).toBe('Historia')
    expect(formatLabel('INSTAGRAM', null, [vid])).toBe('Reel')
    expect(formatLabel('INSTAGRAM', null, [img, img2])).toBe('Carrusel (2)')
    expect(formatLabel('INSTAGRAM', 'feed', [img])).toBe('Foto')
    expect(formatLabel('FACEBOOK', 'reel', [vid])).toBe('Reel')
    expect(formatLabel('FACEBOOK', null, [img, img2])).toBe('Fotos (2)')
    expect(formatLabel('FACEBOOK', null, [vid])).toBe('Video')
    expect(formatLabel('FACEBOOK', null, [], 'https://x.co')).toBe('Enlace')
    expect(formatLabel('FACEBOOK', null, [])).toBe('Texto')
    expect(formatLabel('WEB', null, [])).toBe('Artículo')
  })
  it('names the agent plan formats the same way', () => {
    expect(agentFormatLabel('FACEBOOK', 'historia')).toBe('Historia')
    expect(agentFormatLabel('INSTAGRAM', 'feed')).toBe('Foto')
    expect(agentFormatLabel('WEB', 'guía')).toBe('Artículo (guía)')
  })
})

describe('channel lines', () => {
  const variants = [
    { channel: 'FACEBOOK', format: 'reel', mediaIds: ['v1'], linkUrl: null },
    { channel: 'INSTAGRAM', format: 'story', mediaIds: ['i1'], linkUrl: null },
    { channel: 'WEB', format: null, mediaIds: [], linkUrl: null },
  ]
  const media = [img, vid]
  it('one line per channel and account, Instagram first; a re-send replaces the old failure', () => {
    const lines = channelLines(variants, media, [
      { channel: 'FACEBOOK', status: 'failed', scheduledAt: '2026-10-01T15:00:00Z', publishedAt: null, lastError: 'x', createdAt: '2026-10-01T10:00:00Z', connection: { name: 'Haggo' } },
      { channel: 'FACEBOOK', status: 'scheduled', scheduledAt: '2026-10-03T15:00:00Z', publishedAt: null, createdAt: '2026-10-02T10:00:00Z', connection: { name: 'Haggo' } },
      { channel: 'INSTAGRAM', status: 'published', scheduledAt: '2026-10-01T15:00:00Z', publishedAt: '2026-10-01T15:01:00Z', createdAt: '2026-10-01T10:00:00Z', connection: { name: '@lohaggo_' } },
    ])
    expect(lines.map((l) => `${l.channel} ${l.format} ${l.account} ${l.status}`)).toEqual([
      'INSTAGRAM Historia @lohaggo_ published',
      'FACEBOOK Reel Haggo scheduled',
      'WEB Artículo null null',
    ])
    expect(postSortDate(lines, '2026-09-01T00:00:00Z')).toBe('2026-10-03T15:00:00.000Z')
  })
  it('without anything pending the list orders by the last send', () => {
    const lines = channelLines([variants[1]], media, [{ channel: 'INSTAGRAM', status: 'published', scheduledAt: '2026-10-01T15:00:00Z', publishedAt: '2026-10-01T15:01:00Z', connection: null }])
    expect(postSortDate(lines, '2026-09-01T00:00:00Z')).toBe('2026-10-01T15:01:00.000Z')
  })
})
