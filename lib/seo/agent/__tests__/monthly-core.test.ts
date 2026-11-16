import { describe, expect, it } from 'vitest'
import { arrow, bogotaDay, buildMonthly, monthKey, monthRange, pctChange, previousMonthKey, renderMonthlyEmail, type MonthlyInput } from '../monthly-core'

const base = (over: Partial<MonthlyInput> = {}): MonthlyInput => ({
  monthLabel: 'octubre de 2026',
  gsc: { clicks: 120, impressions: 4000, prevClicks: 100, prevImpressions: 5000, topQueries: [{ query: 'plomero en Medellín', clicks: 30, impressions: 500, position: 4.2 }], topPages: [{ path: '/servicios/plomero', clicks: 40, impressions: 900 }] },
  keywords: [], articles: { publishedThisMonth: [{ title: 'Cómo elegir plomero', slug: 'como-elegir-plomero', views: 12 }], totalPublished: 20, indexed: 18, inspected: 20 },
  health: { score: 80, prevScore: 75 }, opportunities: { open: 5, highOpen: 2, doneThisMonth: 3 }, spendUsd: 1.234, ...over,
})

describe('variaciones', () => {
  it('pctChange y arrow', () => {
    expect(pctChange(120, 100)).toBe(20)
    expect(pctChange(80, 100)).toBe(-20)
    expect(pctChange(5, null)).toBeNull()
    expect(pctChange(5, 0)).toBeNull()
    expect(pctChange(0, 0)).toBe(0)
    expect(arrow(20)).toBe('▲ +20%')
    expect(arrow(-12.5)).toBe('▼ -12,5%')
    expect(arrow(null)).toBe('–')
  })
  it('resume con signo y sin inventar el mes anterior', () => {
    const s = buildMonthly(base())
    expect(s.clicks!.text).toContain('▲ +20%')
    expect(s.impressions!.text).toContain('▼ -20%')
    const n = buildMonthly(base({ gsc: { clicks: 10, impressions: 100, prevClicks: null, prevImpressions: null, topQueries: [], topPages: [] }, health: { score: 70, prevScore: null } }))
    expect(n.clicks!.text).toContain('sin mes anterior para comparar')
    expect(n.health.text).toContain('sin mes anterior para comparar')
    expect(n.noPrevious).toBe(true)
    expect(n.clicks!.pct).toBeNull()
  })
})

describe('subió y bajó', () => {
  it('separa keywords que subieron, bajaron y no aparecen', () => {
    const s = buildMonthly(base({ keywords: [
      { keyword: 'plomero en Medellín', position: 5, prevPosition: 9, impressions: 300 },
      { keyword: 'electricista en Bello', position: 15, prevPosition: 8, impressions: 100 },
      { keyword: 'pintor en Envigado', position: null, prevPosition: null, impressions: 0 },
    ] }))
    expect(s.rose.some((c) => c.label === 'plomero en Medellín')).toBe(true)
    expect(s.fell.map((c) => c.label)).toEqual(expect.arrayContaining(['electricista en Bello', 'pintor en Envigado']))
    expect(s.rose.length).toBeLessThanOrEqual(3)
    expect(s.fell.length).toBeLessThanOrEqual(3)
  })
})

describe('claves de mes en Bogotá', () => {
  it('usa la hora de Bogotá, también al cambiar de año', () => {
    expect(monthKey(new Date('2026-11-01T04:59:00Z'))).toBe('2026-10')
    expect(monthKey(new Date('2026-11-01T05:00:00Z'))).toBe('2026-11')
    expect(monthKey(new Date('2027-01-01T04:00:00Z'))).toBe('2026-12')
    expect(monthKey(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01')
    expect(previousMonthKey('2027-01')).toBe('2026-12')
    expect(previousMonthKey('2026-03')).toBe('2026-02')
    expect(bogotaDay(new Date('2026-11-01T04:59:00Z'))).toBe(31)
    expect(monthRange('2026-12').end.toISOString()).toBe('2027-01-01T05:00:00.000Z')
  })
})

describe('qué hacer', () => {
  it('pide indexación cuando hay páginas sin indexar', () => {
    expect(buildMonthly(base()).todo.join(' ')).toMatch(/indexe/)
  })
  it('pide publicar si no salió ningún artículo y siempre da 3', () => {
    const s = buildMonthly(base({ articles: { publishedThisMonth: [], totalPublished: 3, indexed: 3, inspected: 3 } }))
    expect(s.todo).toHaveLength(3)
    expect(s.todo.join(' ')).toMatch(/Publicar/)
    expect(buildMonthly(base({ gsc: null })).todo[0]).toMatch(/Search Console/)
  })
  it('enlaza para búsquedas que no aparecen', () => {
    const s = buildMonthly(base({ articles: { publishedThisMonth: [1, 2, 3, 4].map((n) => ({ title: `t${n}`, slug: `s${n}`, views: 0 })), totalPublished: 9, indexed: 9, inspected: 9 }, keywords: [{ keyword: 'pintor en Envigado', position: null, prevPosition: null, impressions: 0 }] }))
    expect(s.todo.join(' ')).toMatch(/Enlazar/)
  })
})

describe('correo', () => {
  it('escapa y recorta texto externo, sin scripts', () => {
    const evil = '<script>alert(1)</script>' + 'x'.repeat(300)
    const s = buildMonthly(base({
      gsc: { clicks: 1, impressions: 1, prevClicks: 1, prevImpressions: 1, topQueries: [{ query: evil, clicks: 1, impressions: 1, position: 3 }], topPages: [] },
      articles: { publishedThisMonth: [{ title: evil, slug: 'a"b<c', views: 1 }], totalPublished: 1, indexed: null, inspected: null },
      keywords: [{ keyword: evil, position: null, prevPosition: 4, impressions: 5 }],
    }))
    const { html, text, subject } = renderMonthlyEmail(s)
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('x'.repeat(120))
    expect(html).not.toContain('a"b<c')
    expect(text).not.toContain('x'.repeat(120))
    expect(subject).toContain('octubre de 2026')
  })
})
