import { OPENAI_STATIC_MODELS, STATIC_MODELS } from '@/lib/ai/models'

/**
 * Editorial review settings and rubric: shared by the server and the admin screens (no server imports).
 * The proofreader fixes form; the editor scores each piece with this rubric and approves or asks changes.
 */

export const CRITERIA = [
  { id: 'hook', label: 'Gancho', help: 'Los primeros 125 caracteres hacen que alguien se detenga', weight: 1.5 },
  { id: 'clarity', label: 'Claridad', help: 'Se entiende a la primera, sin rodeos', weight: 1 },
  { id: 'cta', label: 'Llamado a la acción', help: 'Claro, con el enlace correcto (con seguimiento UTM)', weight: 1 },
  { id: 'channel_fit', label: 'Adecuación al canal', help: 'Formato, largo y hashtags de cada red', weight: 1 },
  { id: 'voice', label: 'Voz de la marca', help: 'Suena como la marca y respeta el trato', weight: 1 },
  { id: 'accuracy', label: 'Veracidad', help: 'Solo servicios, ciudades y precios del catálogo; nada inventado', weight: 2 },
  { id: 'compliance', label: 'Cumplimiento', help: 'Temas prohibidos, promesas, salud y seguridad', weight: 2 },
  { id: 'seo', label: 'SEO del blog', help: 'Título, descripción, estructura y palabra clave (solo blog)', weight: 1 },
] as const

export type CriterionId = (typeof CRITERIA)[number]['id']
export const CRITERION_IDS = CRITERIA.map((c) => c.id) as CriterionId[]
export const CRITERION_LABEL = Object.fromEntries(CRITERIA.map((c) => [c.id, c.label])) as Record<CriterionId, string>

export type RubricItem = { id: CriterionId; weight: number; enabled: boolean }

export const LOCALES = { 'es-CO': 'Español de Colombia', 'es-419': 'Español latinoamericano', 'es-MX': 'Español de México', 'es-ES': 'Español de España' } as const
export type Locale = keyof typeof LOCALES
export const TREATMENTS = { auto: 'El de la voz del agente', tu: 'Tú', usted: 'Usted' } as const
export type Treatment = keyof typeof TREATMENTS
export const STRICTNESS = { standard: 'Estándar', strict: 'Estricto' } as const
export type Strictness = keyof typeof STRICTNESS
export const SCOPES = { agent: 'Solo las piezas de los agentes', all: 'También las publicaciones hechas por personas' } as const
export type Scope = keyof typeof SCOPES

export type EditorialSettings = {
  spellingEnabled: boolean
  spellingLocale: Locale
  treatment: Treatment
  neverCorrect: string[]
  spellingModel: string | null
  editorEnabled: boolean
  minScore: number
  maxRounds: number
  rubric: RubricItem[]
  strictness: Strictness
  styleGuide: string | null
  editorModel: string | null
  required: boolean
  scope: Scope
}

export const defaultRubric = (): RubricItem[] => CRITERIA.map((c) => ({ id: c.id, weight: c.weight, enabled: true }))

export const DEFAULT_EDITORIAL: EditorialSettings = {
  spellingEnabled: true,
  spellingLocale: 'es-CO',
  treatment: 'auto',
  neverCorrect: [],
  spellingModel: null,
  editorEnabled: true,
  minScore: 8,
  maxRounds: 2,
  rubric: defaultRubric(),
  strictness: 'standard',
  styleGuide: null,
  editorModel: null,
  required: true,
  scope: 'agent',
}

export const MAX_ROUNDS = 3
/** Only models with a known price: an unpriced id would log $0 and slip past the workspace cap. */
export const REVIEW_MODELS = [...STATIC_MODELS, ...OPENAI_STATIC_MODELS].map((m) => m.id)

const bool = (v: unknown, prev: boolean) => (typeof v === 'boolean' ? v : prev)
const oneOf = <T extends string>(v: unknown, options: Record<T, string>, prev: T): T => (typeof v === 'string' && v in options ? (v as T) : prev)
const model = (v: unknown, prev: string | null) => (v === null || v === '' ? null : typeof v === 'string' && REVIEW_MODELS.includes(v.trim()) ? v.trim() : prev)

function rubricOf(v: unknown, prev: RubricItem[]): RubricItem[] {
  if (!Array.isArray(v)) return prev
  const given = new Map<string, Record<string, unknown>>()
  for (const r of v) if (r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string') given.set((r as { id: string }).id, r as Record<string, unknown>)
  const items = CRITERIA.map((c) => {
    const r = given.get(c.id)
    const old = prev.find((p) => p.id === c.id) ?? { id: c.id, weight: c.weight, enabled: true }
    if (!r) return old
    const w = Number(r.weight)
    return { id: c.id, weight: Number.isFinite(w) ? Math.min(5, Math.max(0.5, Math.round(w * 2) / 2)) : old.weight, enabled: typeof r.enabled === 'boolean' ? r.enabled : old.enabled }
  })
  // At least the truth and compliance checks stay: they are what keeps a piece from promising what we do not sell
  return items.some((i) => i.enabled) ? items : prev
}

/** Whitelists and bounds every field; what is missing or invalid keeps its previous value. */
export function sanitizeEditorial(raw: unknown, prev: EditorialSettings = DEFAULT_EDITORIAL): EditorialSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const min = Number(r.minScore)
  const rounds = Number(r.maxRounds)
  const words = Array.isArray(r.neverCorrect)
    ? Array.from(new Set(r.neverCorrect.filter((w): w is string => typeof w === 'string').map((w) => w.trim().slice(0, 60)).filter((w) => w.length >= 2))).slice(0, 80)
    : prev.neverCorrect
  const guide = r.styleGuide === null ? null : typeof r.styleGuide === 'string' ? r.styleGuide.trim().slice(0, 3000) || null : prev.styleGuide
  return {
    spellingEnabled: bool(r.spellingEnabled, prev.spellingEnabled),
    spellingLocale: oneOf(r.spellingLocale, LOCALES, prev.spellingLocale),
    treatment: oneOf(r.treatment, TREATMENTS, prev.treatment),
    neverCorrect: words,
    spellingModel: r.spellingModel === undefined ? prev.spellingModel : model(r.spellingModel, prev.spellingModel),
    editorEnabled: bool(r.editorEnabled, prev.editorEnabled),
    minScore: Number.isFinite(min) && r.minScore !== null && r.minScore !== '' ? Math.min(10, Math.max(5, Math.round(min * 2) / 2)) : prev.minScore,
    maxRounds: Number.isFinite(rounds) && r.maxRounds !== null && r.maxRounds !== '' ? Math.min(MAX_ROUNDS, Math.max(0, Math.round(rounds))) : prev.maxRounds,
    rubric: rubricOf(r.rubric, prev.rubric),
    strictness: oneOf(r.strictness, STRICTNESS, prev.strictness),
    styleGuide: guide,
    editorModel: r.editorModel === undefined ? prev.editorModel : model(r.editorModel, prev.editorModel),
    required: bool(r.required, prev.required),
    scope: oneOf(r.scope, SCOPES, prev.scope),
  }
}

/** The stored row (or none) as settings; a row written by an older version is re-sanitized. */
export function editorialFromRow(row: Partial<Record<keyof EditorialSettings, unknown>> | null | undefined): EditorialSettings {
  if (!row) return DEFAULT_EDITORIAL
  return sanitizeEditorial({ ...row, rubric: row.rubric ?? DEFAULT_EDITORIAL.rubric }, DEFAULT_EDITORIAL)
}

/** Whether the review runs on a post of this origin at all. */
export const reviewApplies = (s: EditorialSettings, origin: string) => (s.spellingEnabled || s.editorEnabled) && (origin === 'agent' || s.scope === 'all')

// ─── Post review state ──────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'changes' | 'rejected' | 'failed' | 'stale' | 'overridden'
export const PASSING: ReviewStatus[] = ['approved', 'overridden']

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  pending: { label: 'En revisión', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  approved: { label: 'Revisada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  changes: { label: 'Requiere cambios', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  rejected: { label: 'Rechazada por el editor', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  failed: { label: 'Revisión sin hacer', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  stale: { label: 'Cambió: volver a revisar', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  overridden: { label: 'Aprobada por una persona', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
}

export function reviewBadge(status: string | null | undefined, score: number | null | undefined) {
  if (!status || !(status in REVIEW_STATUS)) return null
  const s = REVIEW_STATUS[status as ReviewStatus]
  return { label: status === 'approved' && score != null ? `${s.label} ${formatScore(score)}/10` : s.label, cls: s.cls }
}

export const formatScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
