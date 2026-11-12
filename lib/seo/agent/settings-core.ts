/**
 * SEO agent settings: what the admin tunes without a deploy. Pure (no DB): defaults, types and the sanitizer
 * every stored or submitted value goes through. Missing or invalid keys fall back to the defaults.
 */

export type SeoConfig = {
  enabled: boolean
  /** Weekday of the weekly AI cycle (0 = Sunday … 6 = Saturday, Bogotá) */
  weeklyDay: number
  /** Briefs the agent writes per cycle (each one is a model call) */
  briefsPerCycle: number
  /** Monthly model spend cap in USD; at the cap the agent keeps the free rules and stops writing */
  monthlyBudgetUsd: number
  /** Send each new brief to the marketing agent's backlog by itself (otherwise a person presses the button) */
  autoSendToMarketing: boolean
  /** Ideas sent by the agent enter the marketing backlog already accepted (otherwise «proposed») */
  autoAcceptIdeas: boolean
  /** The idea also asks the marketing agent for Instagram and Facebook versions of the same topic and keyword */
  socialAdaptation: boolean
  gsc: {
    enabled: boolean
    /** «sc-domain:lohaggo.com» or the URL-prefix property «https://www.lohaggo.com/» */
    siteUrl: string
  }
  pageAudit: { enabled: boolean; maxPages: number }
  thresholds: {
    /** A query needs at least this many impressions in the window to count */
    minImpressions: number
    /** Below this CTR (%) a page in the top 10 gets a title/description rewrite */
    lowCtrPct: number
    /** «Striking distance»: positions between these (the second page of Google) */
    strikeFrom: number
    strikeTo: number
    staleArticleDays: number
    thinArticleWords: number
    /** Searches with zero results on the site needed to count as unmet demand */
    zeroResultMinSearches: number
  }
  /** Where to push first: service slugs, city slugs and keywords the team cares about */
  focus: { services: string[]; cities: string[]; keywords: string[] }
  /** Domains the agent keeps in mind (for angle, never to copy) */
  competitors: string[]
}

export const DEFAULT_SEO_CONFIG: Readonly<SeoConfig> = {
  enabled: true,
  weeklyDay: 1,
  briefsPerCycle: 3,
  monthlyBudgetUsd: 5,
  autoSendToMarketing: false,
  autoAcceptIdeas: false,
  socialAdaptation: true,
  gsc: { enabled: true, siteUrl: 'sc-domain:lohaggo.com' },
  pageAudit: { enabled: true, maxPages: 40 },
  thresholds: { minImpressions: 10, lowCtrPct: 2, strikeFrom: 8, strikeTo: 20, staleArticleDays: 180, thinArticleWords: 600, zeroResultMinSearches: 3 },
  focus: { services: [], cities: [], keywords: [] },
  competitors: [],
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def
}
const num = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : def
}
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
const list = (v: unknown, max: number, len: number, re?: RegExp): string[] => {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    const s = typeof x === 'string' ? x.trim().slice(0, len) : ''
    if (s && (!re || re.test(s)) && !out.includes(s)) out.push(s)
    if (out.length >= max) break
  }
  return out
}

const SITE_RE = /^(sc-domain:[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\/?)$/i

export function sanitizeSeoConfig(raw: unknown): SeoConfig {
  const r = obj(raw)
  const d = DEFAULT_SEO_CONFIG
  const g = obj(r.gsc)
  const p = obj(r.pageAudit)
  const t = obj(r.thresholds)
  const f = obj(r.focus)
  const strikeFrom = int(t.strikeFrom, d.thresholds.strikeFrom, 4, 30)
  const site = typeof g.siteUrl === 'string' ? g.siteUrl.trim() : ''
  return {
    enabled: bool(r.enabled, d.enabled),
    weeklyDay: int(r.weeklyDay, d.weeklyDay, 0, 6),
    briefsPerCycle: int(r.briefsPerCycle, d.briefsPerCycle, 0, 10),
    monthlyBudgetUsd: num(r.monthlyBudgetUsd, d.monthlyBudgetUsd, 0, 500),
    autoSendToMarketing: bool(r.autoSendToMarketing, d.autoSendToMarketing),
    autoAcceptIdeas: bool(r.autoAcceptIdeas, d.autoAcceptIdeas),
    socialAdaptation: bool(r.socialAdaptation, d.socialAdaptation),
    gsc: { enabled: bool(g.enabled, d.gsc.enabled), siteUrl: SITE_RE.test(site) ? site : d.gsc.siteUrl },
    pageAudit: { enabled: bool(p.enabled, d.pageAudit.enabled), maxPages: int(p.maxPages, d.pageAudit.maxPages, 5, 80) },
    thresholds: {
      minImpressions: int(t.minImpressions, d.thresholds.minImpressions, 1, 5000),
      lowCtrPct: num(t.lowCtrPct, d.thresholds.lowCtrPct, 0.1, 30),
      strikeFrom,
      strikeTo: int(t.strikeTo, d.thresholds.strikeTo, strikeFrom + 1, 50),
      staleArticleDays: int(t.staleArticleDays, d.thresholds.staleArticleDays, 30, 720),
      thinArticleWords: int(t.thinArticleWords, d.thresholds.thinArticleWords, 200, 2500),
      zeroResultMinSearches: int(t.zeroResultMinSearches, d.thresholds.zeroResultMinSearches, 1, 100),
    },
    focus: {
      services: list(f.services, 20, 80, /^[a-z0-9-]+$/),
      cities: list(f.cities, 20, 80, /^[a-z0-9-]+$/),
      keywords: list(f.keywords, 30, 80),
    },
    competitors: list(r.competitors, 10, 80, /^[a-z0-9.-]+\.[a-z]{2,}$/i).map((x) => x.toLowerCase()),
  }
}
