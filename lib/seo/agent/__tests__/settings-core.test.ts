import { describe, expect, it } from 'vitest'
import { DEFAULT_SEO_CONFIG, sanitizeSeoConfig } from '@/lib/seo/agent/settings-core'

describe('sanitizeSeoConfig', () => {
  it('gives the defaults for nothing or garbage', () => {
    expect(sanitizeSeoConfig(null)).toEqual(DEFAULT_SEO_CONFIG)
    expect(sanitizeSeoConfig('x')).toEqual(DEFAULT_SEO_CONFIG)
    expect(sanitizeSeoConfig([1, 2])).toEqual(DEFAULT_SEO_CONFIG)
  })
  it('clamps numbers and keeps the strike range ordered', () => {
    const c = sanitizeSeoConfig({ briefsPerCycle: 99, monthlyBudgetUsd: -4, weeklyDay: 9, thresholds: { strikeFrom: 15, strikeTo: 10, minImpressions: '50' } })
    expect(c.briefsPerCycle).toBe(10)
    expect(c.monthlyBudgetUsd).toBe(0)
    expect(c.weeklyDay).toBe(6)
    expect(c.thresholds.strikeTo).toBeGreaterThan(c.thresholds.strikeFrom)
    expect(c.thresholds.minImpressions).toBe(50)
  })
  it('only accepts a valid Search Console property', () => {
    expect(sanitizeSeoConfig({ gsc: { siteUrl: 'sc-domain:lohaggo.com' } }).gsc.siteUrl).toBe('sc-domain:lohaggo.com')
    expect(sanitizeSeoConfig({ gsc: { siteUrl: 'https://www.lohaggo.com/' } }).gsc.siteUrl).toBe('https://www.lohaggo.com/')
    expect(sanitizeSeoConfig({ gsc: { siteUrl: 'javascript:alert(1)' } }).gsc.siteUrl).toBe(DEFAULT_SEO_CONFIG.gsc.siteUrl)
  })
  it('cleans lists: slugs, domains, duplicates and limits', () => {
    const c = sanitizeSeoConfig({ focus: { services: ['plomeria', 'Plomería!', 'plomeria'], cities: ['medellin'], keywords: ['  plomero  ', ''] }, competitors: ['Ejemplo.com', 'no es dominio'] })
    expect(c.focus.services).toEqual(['plomeria'])
    expect(c.focus.keywords).toEqual(['plomero'])
    expect(c.competitors).toEqual(['ejemplo.com'])
  })
  it('is idempotent', () => {
    const once = sanitizeSeoConfig({ enabled: false, briefsPerCycle: 4, focus: { keywords: ['a'] } })
    expect(sanitizeSeoConfig(once)).toEqual(once)
  })
})
