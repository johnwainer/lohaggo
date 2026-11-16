import { describe, expect, it } from 'vitest'
import { buildProbeQueries, parseProbe, probeCandidates, summarizeProbes, type AiProbeResult } from '@/lib/seo/agent/ai-visibility-core'

const q = 'Necesito un plomero en Medellín para mañana'
const search = (...urls: string[]) => ({ type: 'web_search_tool_result', tool_use_id: 't', content: urls.map((url) => ({ type: 'web_search_result', url, title: url })) })
const text = (t: string, ...urls: string[]) => ({ type: 'text', text: t, citations: urls.map((url) => ({ type: 'web_search_result_location', url, title: 'x' })) })

describe('parseProbe', () => {
  it('finds citations, position and competitors without www', () => {
    const r = parseProbe({
      content: [
        { type: 'server_tool_use', name: 'web_search' },
        search('https://www.a.com/x', 'https://b.com/y', 'https://www.lohaggo.com/servicios/plomeria', 'https://a.com/z'),
        text('Te recomiendo **LoHaggo** y otros.', 'https://b.com/y'),
      ],
    }, q)
    expect(r).toMatchObject({ answered: true, mentioned: true, cited: true, position: 3, ourUrls: ['https://www.lohaggo.com/servicios/plomeria'], error: null })
    expect(r.competitors).toEqual([{ host: 'a.com', count: 2 }, { host: 'b.com', count: 2 }])
    expect(r.excerpt).toBe('Te recomiendo LoHaggo y otros.')
  })
  it('detects "lo haggo" in text even with no citations', () => {
    const r = parseProbe({ content: [text('Prueba con Lo Haggo')] }, q)
    expect(r).toMatchObject({ mentioned: true, cited: false, position: null })
  })
  it('not cited and not mentioned', () => {
    const r = parseProbe({ content: [search('https://a.com'), text('Opciones', 'https://a.com')] }, q)
    expect(r).toMatchObject({ answered: true, mentioned: false, cited: false, position: null })
  })
  it('cites from text citations only', () => {
    expect(parseProbe({ content: [text('hola', 'https://lohaggo.com/blog/x')] }, q).position).toBe(1)
  })
  it('ignores unknown blocks and garbage', () => {
    const r = parseProbe({ content: [null, 7, { type: 'weird' }, { type: 'web_search_tool_result', content: [{ url: 42 }, null] }, text('ok')] }, q)
    expect(r.answered).toBe(true)
    expect(r.competitors).toEqual([])
  })
  it('empty response', () => {
    expect(parseProbe(undefined, q)).toMatchObject({ answered: false, mentioned: false, cited: false, excerpt: '', error: null })
    expect(parseProbe({ content: [] }, q).answered).toBe(false)
  })
  it('search tool error with no text', () => {
    const r = parseProbe({ content: [{ type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } }] }, q)
    expect(r.error).toContain('unavailable')
  })
  it('caps competitors at 8 and truncates excerpt', () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://s${i}.com`)
    const r = parseProbe({ content: [search(...urls), text('a'.repeat(500))] }, q)
    expect(r.competitors).toHaveLength(8)
    expect(r.excerpt).toHaveLength(240)
  })
})

describe('buildProbeQueries', () => {
  const items = [
    { keyword: 'plomero en Medellín', service: 'Plomería', city: 'Medellín' },
    { keyword: 'plomero urgente en Medellín', service: 'Plomería', city: 'Medellín' },
    { keyword: 'cerrajero en Medellín', service: 'Cerrajería', city: 'Medellín' },
    { keyword: 'pintor en Medellín', service: 'Pintura', city: 'Medellín' },
  ]
  it('spreads across services, varies forms, no duplicates, respects max', () => {
    const out = buildProbeQueries(items, 4)
    expect(out).toHaveLength(4)
    expect(new Set(out).size).toBe(4)
    expect(out.join(' ')).toMatch(/plomero/)
    expect(out.join(' ')).toMatch(/cerraj/)
    expect(out.join(' ')).toMatch(/pintor/)
    expect(out.some((s) => s.startsWith('Necesito'))).toBe(true)
    expect(out.every((s) => !/lohaggo/i.test(s))).toBe(true)
  })
  it('default max 6 and empty input', () => {
    expect(buildProbeQueries(items).length).toBeLessThanOrEqual(6)
    expect(buildProbeQueries([])).toEqual([])
  })
})

const r = (p: Partial<AiProbeResult>): AiProbeResult => ({ query: 'plomero en Medellín', answered: true, mentioned: false, cited: false, ourUrls: [], competitors: [], position: null, excerpt: '', error: null, ...p })

describe('summarizeProbes / probeCandidates', () => {
  const rs = [
    r({ competitors: [{ host: 'a.com', count: 2 }, { host: 'b.com', count: 1 }] }),
    r({ query: 'cerrajero urgente Medellín', cited: true, mentioned: true, position: 2, competitors: [{ host: 'a.com', count: 1 }] }),
    r({ query: 'pintor', answered: false, error: 'fallo' }),
  ]
  it('summarizes', () => {
    expect(summarizeProbes(rs)).toEqual({ asked: 2, mentioned: 1, cited: 1, topCompetitors: [{ host: 'a.com', count: 3 }, { host: 'b.com', count: 1 }] })
  })
  it('only makes candidates for answered queries where we are absent', () => {
    const c = probeCandidates(rs)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ keyword: 'plomero en Medellín', dedupeKey: 'aiprobe:plomero-en-medellin', impact: 'high' })
    expect(c[0].detail).toContain('a.com y b.com')
    expect(c[0].detail).toContain('no a LoHaggo')
  })
})
