/**
 * What the SEO agent looks for, as rules over facts the platform already has. Pure: facts in, candidates out.
 * No model here: the rules decide what is worth a brief, the model only writes it.
 */
import type { SeoConfig } from '@/lib/seo/agent/settings-core'
import type { Candidate, GscRow, Level, OpportunityKind, PageAudit } from '@/lib/seo/agent/types'

export const SITE = 'https://www.lohaggo.com'

export type SeoFacts = {
  now: Date
  services: Array<{ slug: string; name: string; category: string; partners: number; popular: boolean; requests90d: number; reviews: number; goodReviews: number }>
  cities: Array<{ slug: string; name: string; status: string }>
  /** Verified partners by service and city (the supply a page can promise) */
  supply: Array<{ serviceSlug: string; citySlug: string; partners: number; requests90d: number }>
  articles: Array<{
    slug: string; title: string; publishedAt: Date; updatedAt: Date; words: number
    seoTitle: string | null; seoDescription: string | null; category: string | null; tags: string[]
    /** Internal paths the body links to («/servicios/plomeria») */
    links: string[]
    /** Title, tags, category and slug: what the piece is about (decides if a service/city is covered) */
    haystack: string
    /** The whole body in plain text, to see which services it mentions */
    bodyText: string
    views: number
  }>
  zeroSearches: Array<{ term: string; count: number }>
  /** null = Search Console not connected or unreachable */
  gsc: { rows: GscRow[]; days: number } | null
  pages: PageAudit[]
  /** Slugs of the services that already have /precios/[slug] */
  pricePageSlugs: string[]
  thinPartnerProfiles: number
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const IMPACT_BASE: Record<Level, number> = { high: 60, medium: 40, low: 22 }
const EFFORT_PENALTY: Record<Level, number> = { low: 0, medium: 3, high: 8 }

/** Score 0–100: impact first, then real demand (log scale), then the team's focus, minus the effort. */
export function scoreOf(c: { impact: Level; effort: Level; demand?: number; focus?: boolean }): number {
  const demand = c.demand && c.demand > 0 ? Math.min(30, Math.log10(1 + c.demand) * 14) : 0
  return Math.max(0, Math.min(100, Math.round(IMPACT_BASE[c.impact] + demand + (c.focus ? 10 : 0) - EFFORT_PENALTY[c.effort])))
}

const pathOf = (url: string) => {
  try { return new URL(url, SITE).pathname.replace(/\/$/, '') || '/' } catch { return url }
}

const slugKey = (s: string) => norm(s).replace(/ /g, '-')

function focusOf(config: SeoConfig, o: { service?: string | null; city?: string | null; text?: string | null }) {
  return Boolean(
    (o.service && config.focus.services.includes(o.service)) ||
    (o.city && config.focus.cities.includes(o.city)) ||
    (o.text && config.focus.keywords.some((k) => norm(o.text!).includes(norm(k)))),
  )
}

/** Services × cities with supply and demand that no published article covers. */
function serviceCityGaps(f: SeoFacts, config: SeoConfig): Candidate[] {
  const out: Candidate[] = []
  const svc = new Map(f.services.map((s) => [s.slug, s]))
  const city = new Map(f.cities.filter((c) => c.status === 'ACTIVE').map((c) => [c.slug, c]))
  for (const row of f.supply) {
    const s = svc.get(row.serviceSlug)
    const c = city.get(row.citySlug)
    if (!s || !c || row.partners < 1) continue
    const covered = f.articles.some((a) => norm(a.haystack).includes(norm(s.name)) && norm(a.haystack).includes(norm(c.name)))
    if (covered) continue
    const impact: Level = row.requests90d > 0 || s.popular ? 'high' : 'medium'
    out.push({
      kind: 'content_gap',
      title: `${s.name} en ${c.name}: ningún artículo lo cubre`,
      detail: `Hay ${row.partners} ${row.partners === 1 ? 'socio verificado' : 'socios verificados'} y ${row.requests90d} solicitudes en 90 días, pero el blog no tiene una guía de ${s.name.toLowerCase()} en ${c.name}.`,
      targetUrl: `/servicios/${s.slug}`,
      keyword: `${s.name.toLowerCase()} en ${c.name}`,
      serviceSlug: s.slug, citySlug: c.slug, impact, effort: 'medium', source: 'rules',
      evidence: { partners: row.partners, requests90d: row.requests90d },
      dedupeKey: `gap:${s.slug}:${c.slug}`,
      score: scoreOf({ impact, effort: 'medium', demand: row.requests90d * 3 + row.partners, focus: focusOf(config, { service: s.slug, city: c.slug }) }),
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 15)
}

function zeroResultSearches(f: SeoFacts, config: SeoConfig): Candidate[] {
  return f.zeroSearches
    .filter((z) => z.count >= config.thresholds.zeroResultMinSearches && z.term.trim().length >= 3)
    .slice(0, 12)
    .map((z) => ({
      kind: 'demand_gap' as OpportunityKind,
      title: `La gente busca «${z.term}» y no hay resultados`,
      detail: `${z.count} búsquedas sin resultado en el sitio. Es demanda real: un artículo o un servicio nuevo la atiende y, si se publica, también aparece en Google.`,
      keyword: z.term,
      impact: (z.count >= 10 ? 'high' : 'medium') as Level, effort: 'medium' as Level, source: 'rules' as const,
      evidence: { searches: z.count },
      dedupeKey: `demand:${slugKey(z.term)}`,
      score: scoreOf({ impact: z.count >= 10 ? 'high' : 'medium', effort: 'medium', demand: z.count * 4, focus: focusOf(config, { text: z.term }) }),
    }))
}

function fromSearchConsole(f: SeoFacts, config: SeoConfig): Candidate[] {
  if (!f.gsc) return []
  const t = config.thresholds
  const out: Candidate[] = []
  const byQuery = new Map<string, GscRow[]>()
  for (const r of f.gsc.rows) {
    const list = byQuery.get(r.query) ?? []
    list.push(r)
    byQuery.set(r.query, list)
  }
  const pageAgg = new Map<string, { impressions: number; clicks: number; best: GscRow }>()
  for (const [query, rows] of Array.from(byQuery.entries())) {
    const impressions = rows.reduce((a, r) => a + r.impressions, 0)
    const top = [...rows].sort((a, b) => b.impressions - a.impressions)[0]
    const position = rows.reduce((a, r) => a + r.position * r.impressions, 0) / Math.max(1, impressions)
    // Second page of Google: a small push moves it to the first
    if (impressions >= t.minImpressions && position >= t.strikeFrom && position <= t.strikeTo) {
      out.push({
        kind: 'refresh', title: `«${query}» está en la posición ${position.toFixed(1)}: a un paso de la primera página`,
        detail: `${impressions} impresiones en ${f.gsc.days} días. Reforzar ${pathOf(top.page)} (título, subtítulos, preguntas frecuentes y enlaces internos) puede subirla.`,
        targetUrl: pathOf(top.page), keyword: query, impact: 'high', effort: 'low', source: 'gsc',
        evidence: { impressions, position: Math.round(position * 10) / 10, page: pathOf(top.page) },
        dedupeKey: `strike:${slugKey(query)}`, score: scoreOf({ impact: 'high', effort: 'low', demand: impressions, focus: focusOf(config, { text: query }) }),
      })
    }
    // The same query answered by two pages of ours: they compete with each other
    const strong = rows.filter((r) => r.impressions >= Math.max(5, t.minImpressions * 0.3))
    if (strong.length >= 2) {
      const pages = strong.map((r) => pathOf(r.page))
      if (new Set(pages).size >= 2) {
        out.push({
          kind: 'cannibalization', title: `Dos páginas compiten por «${query}»`,
          detail: `${Array.from(new Set(pages)).join(' y ')} aparecen para la misma búsqueda. Dejar una como principal y enlazar la otra a ella.`,
          targetUrl: pages[0], keyword: query, impact: 'medium', effort: 'low', source: 'gsc',
          evidence: { pages: Array.from(new Set(pages)), impressions },
          dedupeKey: `cannibal:${slugKey(query)}`, score: scoreOf({ impact: 'medium', effort: 'low', demand: impressions }),
        })
      }
    }
    for (const r of rows) {
      const p = pathOf(r.page)
      const a = pageAgg.get(p) ?? { impressions: 0, clicks: 0, best: r }
      a.impressions += r.impressions
      a.clicks += r.clicks
      if (r.impressions > a.best.impressions) a.best = r
      pageAgg.set(p, a)
    }
  }
  // Top ten with few clicks: the snippet (title and description) is not convincing
  for (const [path, a] of Array.from(pageAgg.entries())) {
    const ctr = a.impressions ? (a.clicks / a.impressions) * 100 : 0
    if (a.impressions >= t.minImpressions * 2 && a.best.position <= 10 && ctr < t.lowCtrPct) {
      out.push({
        kind: 'meta', title: `${path} sale en Google pero casi nadie entra (${ctr.toFixed(1)} % de clics)`,
        detail: `${a.impressions} impresiones y ${a.clicks} clics, con la búsqueda «${a.best.query}» en la posición ${a.best.position.toFixed(1)}. Reescribir título y descripción con la promesa concreta (precio desde, ciudad, garantía).`,
        targetUrl: path, keyword: a.best.query, impact: 'high', effort: 'low', source: 'gsc',
        evidence: { impressions: a.impressions, clicks: a.clicks, ctrPct: Math.round(ctr * 10) / 10 },
        dedupeKey: `ctr:${path}`, score: scoreOf({ impact: 'high', effort: 'low', demand: a.impressions }),
      })
    }
  }
  // Published for three weeks and Google shows it to nobody
  const impressionsByPath = new Map(Array.from(pageAgg.entries()).map(([p, a]) => [p, a.impressions]))
  for (const a of f.articles) {
    const ageDays = (f.now.getTime() - a.publishedAt.getTime()) / 86_400_000
    if (ageDays >= 21 && !(impressionsByPath.get(`/blog/${a.slug}`) ?? 0)) {
      out.push({
        kind: 'technical', title: `«${a.title}» no aparece en Google tras ${Math.floor(ageDays)} días`,
        detail: 'Sin impresiones en Search Console. Pedir indexación en Search Console, enlazarlo desde páginas con tráfico y revisar que no tenga noindex.',
        targetUrl: `/blog/${a.slug}`, impact: 'medium', effort: 'low', source: 'gsc',
        evidence: { ageDays: Math.floor(ageDays) }, dedupeKey: `index:${a.slug}`, score: scoreOf({ impact: 'medium', effort: 'low', demand: 5 }),
      })
    }
  }
  return out
}

function articleChecks(f: SeoFacts, config: SeoConfig): Candidate[] {
  const out: Candidate[] = []
  const t = config.thresholds
  for (const a of f.articles) {
    const path = `/blog/${a.slug}`
    const ageDays = (f.now.getTime() - a.updatedAt.getTime()) / 86_400_000
    if (ageDays > t.staleArticleDays) {
      out.push({
        kind: 'refresh', title: `«${a.title}» lleva ${Math.floor(ageDays / 30)} meses sin actualizarse`,
        detail: 'Google premia el contenido al día. Revisar precios, pasos y enlaces, y volver a publicarlo con la fecha de hoy.',
        targetUrl: path, impact: a.views > 0 ? 'medium' : 'low', effort: 'low', source: 'rules',
        evidence: { ageDays: Math.floor(ageDays), views: a.views }, dedupeKey: `stale:${a.slug}`, score: scoreOf({ impact: a.views > 0 ? 'medium' : 'low', effort: 'low', demand: a.views }),
      })
    }
    if (a.words < t.thinArticleWords) {
      out.push({
        kind: 'refresh', title: `«${a.title}» es corto (${a.words} palabras)`,
        detail: `Los artículos que posicionan suelen pasar de ${t.thinArticleWords} palabras con preguntas frecuentes y ejemplos reales. Ampliarlo.`,
        targetUrl: path, impact: 'medium', effort: 'medium', source: 'rules',
        evidence: { words: a.words }, dedupeKey: `thin:${a.slug}`, score: scoreOf({ impact: 'medium', effort: 'medium', demand: a.views }),
      })
    }
    const probs: string[] = []
    if (!a.seoTitle) probs.push('sin título SEO')
    else if (a.seoTitle.length > 60) probs.push(`título SEO de ${a.seoTitle.length} caracteres (máx. 60)`)
    if (!a.seoDescription) probs.push('sin descripción')
    else if (a.seoDescription.length < 50 || a.seoDescription.length > 160) probs.push(`descripción de ${a.seoDescription.length} caracteres (ideal 50 a 160)`)
    if (probs.length) {
      out.push({
        kind: 'meta', title: `«${a.title}»: ${probs.join(', ')}`, detail: 'Es el texto que ve la gente en Google: arreglarlo es rápido y sube los clics.',
        targetUrl: path, impact: 'medium', effort: 'low', source: 'rules', evidence: { problems: probs }, dedupeKey: `meta:${a.slug}`, score: scoreOf({ impact: 'medium', effort: 'low', demand: a.views }),
      })
    }
    // Names a service of ours and does not link to its page
    const hay = norm(a.bodyText)
    const missing = f.services.filter((s) => hay.includes(norm(s.name)) && !a.links.some((l) => l.startsWith(`/servicios/${s.slug}`)) && s.partners > 0).slice(0, 3)
    if (missing.length) {
      out.push({
        kind: 'internal_link', title: `«${a.title}» habla de ${missing.map((m) => m.name).join(', ')} sin enlazar`,
        detail: `Enlazar a ${missing.map((m) => `/servicios/${m.slug}`).join(', ')} pasa autoridad a las páginas que convierten.`,
        targetUrl: path, serviceSlug: missing[0].slug, impact: 'medium', effort: 'low', source: 'rules',
        evidence: { services: missing.map((m) => m.slug) }, dedupeKey: `links:${a.slug}`, score: scoreOf({ impact: 'medium', effort: 'low', demand: a.views }),
      })
    }
  }
  return out
}

function fromPageAudit(f: SeoFacts): Candidate[] {
  const out: Candidate[] = []
  for (const p of f.pages) {
    const real = p.issues.filter((i) => i.severity !== 'info')
    if (!real.length) continue
    const critical = real.some((i) => i.severity === 'critical')
    const impact: Level = critical ? 'high' : 'medium'
    out.push({
      kind: 'technical', title: `${p.path}: ${real.map((i) => i.message).slice(0, 2).join('; ')}`,
      detail: real.map((i) => `• ${i.message}`).join('\n'), targetUrl: p.path, impact, effort: 'low', source: 'page_audit',
      evidence: { issues: real.map((i) => i.code), status: p.status },
      dedupeKey: `tech:${p.path}`, score: scoreOf({ impact, effort: 'low', demand: p.path === '/' ? 8 : 2 }),
    })
  }
  return out
}

function programmaticPages(f: SeoFacts, config: SeoConfig): Candidate[] {
  const has = new Set(f.pricePageSlugs)
  return f.services
    .filter((s) => s.partners > 0 && !has.has(s.slug) && (s.requests90d > 0 || s.popular))
    .slice(0, 8)
    .map((s) => ({
      kind: 'programmatic' as OpportunityKind,
      title: `${s.name} no tiene página de precios`,
      detail: `Hay ${s.partners} socios y ${s.requests90d} solicitudes, pero /precios/${s.slug} no existe. «Cuánto cuesta ${s.name.toLowerCase()}» es de las búsquedas que más convierten.`,
      targetUrl: `/precios/${s.slug}`, keyword: `cuánto cuesta ${s.name.toLowerCase()}`, serviceSlug: s.slug,
      impact: 'high' as Level, effort: 'medium' as Level, source: 'rules' as const, evidence: { partners: s.partners, requests90d: s.requests90d },
      dedupeKey: `price:${s.slug}`, score: scoreOf({ impact: 'high', effort: 'medium', demand: s.requests90d * 3, focus: focusOf(config, { service: s.slug }) }),
    }))
}

function realCases(f: SeoFacts, config: SeoConfig): Candidate[] {
  return f.services
    .filter((s) => s.goodReviews >= 3 && !f.articles.some((a) => a.category && norm(a.category).includes('caso') && norm(a.haystack).includes(norm(s.name))))
    .slice(0, 5)
    .map((s) => ({
      kind: 'ugc' as OpportunityKind,
      title: `${s.goodReviews} reseñas buenas de ${s.name}: falta un caso real`,
      detail: 'Un artículo con un trabajo real (antes, después, precio y tiempo, con permiso del cliente y sin datos personales) posiciona y da confianza.',
      keyword: `${s.name.toLowerCase()} caso real`, serviceSlug: s.slug, impact: 'medium' as Level, effort: 'medium' as Level, source: 'rules' as const,
      evidence: { goodReviews: s.goodReviews }, dedupeKey: `ugc:${s.slug}`,
      score: scoreOf({ impact: 'medium', effort: 'medium', demand: s.goodReviews * 2, focus: focusOf(config, { service: s.slug }) }),
    }))
}

function localAndBrand(f: SeoFacts): Candidate[] {
  const out: Candidate[] = []
  if (f.thinPartnerProfiles >= 5) {
    out.push({
      kind: 'local', title: `${f.thinPartnerProfiles} perfiles de socios no se indexan (sin reseñas, biografía o foto)`,
      detail: 'Cada perfil completo es una página que posiciona por «plomero en Laureles». Pedir a los socios biografía y foto (campaña de reactivación) y reseñas tras cada servicio.',
      targetUrl: '/admin/partners', impact: 'medium', effort: 'medium', source: 'rules', evidence: { profiles: f.thinPartnerProfiles },
      dedupeKey: 'local:thin-profiles', score: scoreOf({ impact: 'medium', effort: 'medium', demand: f.thinPartnerProfiles }),
    })
  }
  return out
}

const EVERGREEN: Candidate[] = [
  { kind: 'local', title: 'Ficha de Google Business Profile', detail: 'La ficha con fotos, horario, servicios y reseñas aparece en el mapa de Google para «servicio + ciudad». Verificarla, subir fotos reales y responder cada reseña.', impact: 'high', effort: 'low', source: 'rules', dedupeKey: 'evergreen:gbp', score: 66 },
  { kind: 'growth', title: 'Pedir reseña pública después de cada servicio', detail: 'Las reseñas con comentario alimentan las estrellas en Google y las páginas de los socios. Pedirla por WhatsApp apenas se completa el servicio, con el enlace directo.', impact: 'high', effort: 'low', source: 'rules', dedupeKey: 'evergreen:reviews', score: 62 },
  { kind: 'growth', title: 'Alianzas con administradores de conjuntos y ferreterías', detail: 'Un enlace desde el sitio de una administradora, una ferretería o un directorio local vale más que diez artículos. Ofrecer una página de aliados con su enlace.', impact: 'medium', effort: 'high', source: 'rules', dedupeKey: 'evergreen:backlinks', score: 44 },
  { kind: 'growth', title: 'Videos cortos de «cómo se hace» con el socio', detail: 'Un video de 40 segundos del socio haciendo el trabajo sirve en Instagram, en el artículo y en YouTube. Los reels del agente pueden reutilizar los clips.', impact: 'medium', effort: 'medium', source: 'rules', dedupeKey: 'evergreen:video', score: 40 },
]

/** Every candidate the rules find today, best first. Evergreen items enter once and stay until someone decides. */
export function detectOpportunities(f: SeoFacts, config: SeoConfig): Candidate[] {
  const all = [
    ...serviceCityGaps(f, config),
    ...zeroResultSearches(f, config),
    ...fromSearchConsole(f, config),
    ...articleChecks(f, config),
    ...fromPageAudit(f),
    ...programmaticPages(f, config),
    ...realCases(f, config),
    ...localAndBrand(f),
    ...EVERGREEN,
  ]
  const seen = new Set<string>()
  return all.filter((c) => (seen.has(c.dedupeKey) ? false : (seen.add(c.dedupeKey), true))).sort((a, b) => b.score - a.score)
}

/** A 0–100 summary of the site's SEO health from what the rules see (for the panel and Haggo). */
export function healthScore(f: SeoFacts, candidates: Candidate[]): { score: number; parts: Array<{ label: string; score: number }> } {
  const pages = f.pages.length
  const clean = pages ? f.pages.filter((p) => !p.issues.some((i) => i.severity !== 'info')).length / pages : 1
  const arts = f.articles.length
  const metaOk = arts ? f.articles.filter((a) => a.seoTitle && a.seoTitle.length <= 60 && a.seoDescription && a.seoDescription.length >= 50 && a.seoDescription.length <= 160).length / arts : 0
  const covered = f.services.filter((s) => s.partners > 0)
  const withContent = covered.length ? covered.filter((s) => f.articles.some((a) => norm(a.haystack).includes(norm(s.name)))).length / covered.length : 0
  const highOpen = candidates.filter((c) => c.impact === 'high' && c.source !== 'rules' ? true : c.impact === 'high').length
  const parts = [
    { label: 'Páginas sin fallas técnicas', score: Math.round(clean * 100) },
    { label: 'Artículos con título y descripción', score: Math.round(metaOk * 100) },
    { label: 'Servicios con contenido propio', score: Math.round(withContent * 100) },
    { label: 'Pendientes de alto impacto', score: Math.max(0, 100 - highOpen * 6) },
  ]
  return { score: Math.round(parts.reduce((a, p) => a + p.score, 0) / parts.length), parts }
}
