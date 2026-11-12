/** Shared types of the SEO agent. Pure. */

export const OPPORTUNITY_KINDS = ['content_gap', 'demand_gap', 'refresh', 'meta', 'cannibalization', 'internal_link', 'technical', 'programmatic', 'ugc', 'local', 'growth'] as const
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number]

export const KIND_LABEL: Record<OpportunityKind, string> = {
  content_gap: 'Contenido nuevo',
  demand_gap: 'Demanda sin atender',
  refresh: 'Actualizar contenido',
  meta: 'Título y descripción',
  cannibalization: 'Páginas que compiten',
  internal_link: 'Enlaces internos',
  technical: 'Técnico',
  programmatic: 'Página por servicio',
  ugc: 'Casos reales y reseñas',
  local: 'Local y marca',
  growth: 'Crecimiento',
}

/** Kinds that become an article (and so can go to the marketing agent); the rest are fixes a person or Haggo does */
export const ARTICLE_KINDS: OpportunityKind[] = ['content_gap', 'demand_gap', 'ugc', 'refresh']

export const STATUSES = ['open', 'briefed', 'sent', 'done', 'dismissed'] as const
export type OpportunityStatus = (typeof STATUSES)[number]
export type Level = 'low' | 'medium' | 'high'

export type Candidate = {
  kind: OpportunityKind
  title: string
  detail: string
  targetUrl?: string | null
  keyword?: string | null
  serviceSlug?: string | null
  citySlug?: string | null
  impact: Level
  effort: Level
  source: 'rules' | 'gsc' | 'page_audit' | 'ai' | 'marketing'
  evidence?: Record<string, unknown>
  /** Stable id of the finding: the same problem keeps the same key */
  dedupeKey: string
  score: number
}

/** What the agent hands to the writer: an article plan, never the article itself */
export type SeoBrief = {
  keyword: string
  secondary: string[]
  intent: 'informacional' | 'transaccional' | 'comparativa' | 'local'
  title: string
  seoTitle: string
  seoDescription: string
  /** H2 sections, in order */
  outline: Array<{ h2: string; points: string[] }>
  faqs: Array<{ q: string; a: string }>
  /** Internal links the article must carry: only URLs of the site */
  internalLinks: Array<{ url: string; anchor: string }>
  /** Facts the article may use (from the platform's own data); anything else is not a fact */
  facts: string[]
  cta: string
  schema: 'Article' | 'FAQPage' | 'HowTo'
  /** Format of the marketing agent for the web channel */
  format: 'guía' | 'lista' | 'comparativa' | 'preguntas' | 'caso'
  notes: string
}

export type GscRow = { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }

export type PageIssue = { code: string; severity: 'critical' | 'warning' | 'info'; message: string }
export type PageAudit = {
  url: string
  path: string
  status: number | null
  title: string | null
  description: string | null
  h1Count: number
  canonical: string | null
  robots: string | null
  jsonLd: string[]
  imagesWithoutAlt: number
  words: number
  issues: PageIssue[]
}
