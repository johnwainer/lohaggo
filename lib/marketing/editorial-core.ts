/**
 * Editorial review, pure part: the texts of a post, their fingerprint, applying the proofreader's
 * corrections safely, validating both reviewers' answers and deciding what follows each round.
 */
import { createHash } from 'crypto'
import type { MarketingChannel } from '@/lib/marketing/channel-rules'
import { CRITERIA, CRITERION_IDS, CRITERION_LABEL, PASSING, reviewApplies, type CriterionId, type EditorialSettings, type RubricItem, type ReviewStatus } from '@/lib/marketing/editorial-rubric'

// ─── Texts and fingerprint ──────────────────────────────────────────────────

export type ReviewText = { key: string; channel: MarketingChannel | null; label: string; text: string }

type PostTexts = {
  title: string
  variants: Array<{ channel: string; body: string; seoTitle?: string | null; seoDescription?: string | null; excerpt?: string | null; linkUrl?: string | null }>
  media: Array<{ id: string; alt: string | null }>
}

const CHANNEL_NAME: Record<MarketingChannel, string> = { WEB: 'Blog', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook' }
const ORDER: MarketingChannel[] = ['WEB', 'INSTAGRAM', 'FACEBOOK']

/** Every text a reader sees, with a stable key the reviewers use to point at it. */
export function collectTexts(post: PostTexts): ReviewText[] {
  const out: ReviewText[] = [{ key: 'title', channel: null, label: 'Título', text: post.title }]
  const variants = [...post.variants].sort((a, b) => ORDER.indexOf(a.channel as MarketingChannel) - ORDER.indexOf(b.channel as MarketingChannel))
  for (const v of variants) {
    const ch = v.channel as MarketingChannel
    const name = CHANNEL_NAME[ch] ?? ch
    out.push({ key: `${ch}.body`, channel: ch, label: ch === 'WEB' ? 'Artículo del blog' : `Texto de ${name}`, text: v.body })
    if (ch === 'WEB') {
      if (v.seoTitle) out.push({ key: 'WEB.seoTitle', channel: ch, label: 'Título SEO', text: v.seoTitle })
      if (v.seoDescription) out.push({ key: 'WEB.seoDescription', channel: ch, label: 'Descripción SEO', text: v.seoDescription })
      if (v.excerpt) out.push({ key: 'WEB.excerpt', channel: ch, label: 'Resumen', text: v.excerpt })
    }
  }
  for (const m of [...post.media].sort((a, b) => a.id.localeCompare(b.id))) if (m.alt) out.push({ key: `media.${m.id}.alt`, channel: null, label: 'Texto alternativo de imagen', text: m.alt })
  return out.filter((t) => t.text.trim())
}

/** What the review saw: every text and every link. Any later edit changes it. */
export function contentHash(post: PostTexts) {
  const texts = collectTexts(post).map((t) => [t.key, t.text])
  const links = [...post.variants].sort((a, b) => a.channel.localeCompare(b.channel)).map((v) => [v.channel, v.linkUrl ?? ''])
  return createHash('sha256').update(JSON.stringify({ texts, links })).digest('hex')
}

// ─── Protected tokens and corrections ───────────────────────────────────────

const TOKEN_RE = new RegExp(String.raw`https?:\/\/[^\s)\]>"]+|www\.[^\s)\]>"]+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|co|net|org|io|app|info|es)\b(?:\/[^\s)\]>"]*)?|[@#][\p{L}\p{N}_.]+|\d+(?:[.,:]\d+)*|[$%]`, 'giu')

/** Links, domains, @mentions, #hashtags, figures and money signs: what a spelling fix never changes. */
export function protectedTokens(text: string) {
  return (text.match(TOKEN_RE) ?? []).map((t) => t.replace(/[.,;:]+$/, '')).sort()
}

/** Formatting characters a spelling fix never adds or removes. */
const markup = (s: string) => (s.match(/[*_#`[\]<>|~]/g) ?? []).sort().join('')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const boundedRe = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(s)}(?![\\p{L}\\p{N}_])`, 'gu')

export type Correction = { field: string; channel: MarketingChannel | null; original: string; corrected: string; reason: string }
export type RejectedCorrection = Correction & { why: string }

function refusal(c: Correction, texts: Record<string, string>, protectedWords: string[]): string | null {
  if (!(c.field in texts)) return 'Ese campo no existe'
  if (!c.original || c.original === c.corrected) return 'No cambia nada'
  if (!c.corrected.trim()) return 'Borraría texto'
  if (c.original.length > 400) return 'Fragmento demasiado largo para una corrección'
  if (Math.abs(c.corrected.length - c.original.length) > Math.max(12, c.original.length * 0.5)) return 'Reescribe en vez de corregir'
  if (protectedTokens(c.original).join('\u0000') !== protectedTokens(c.corrected).join('\u0000')) return 'Tocaría un enlace, una mención, un hashtag o una cifra'
  if (markup(c.original) !== markup(c.corrected)) return 'Cambiaría el formato (Markdown o HTML)'
  // A protected word (any case) must stay exactly as it was, as a whole word, as many times
  for (const w of protectedWords) {
    const found = c.original.match(new RegExp(boundedRe(w).source, 'giu')) ?? []
    for (const slice of Array.from(new Set(found))) {
      const count = (t: string) => (t.match(boundedRe(slice)) ?? []).length
      if (count(c.original) !== count(c.corrected)) return `Cambiaría «${slice}», que no se corrige`
    }
  }
  if (!boundedRe(c.original).test(texts[c.field])) return 'El fragmento no está tal cual en el texto'
  return null
}

/**
 * Applies only exact, whole-word matches that keep every protected token and word. An occurrence that
 * already reads as the corrected form is left alone, so applying the same list twice changes nothing.
 */
export function applyCorrections(texts: Record<string, string>, proposals: Correction[], protectedWords: string[]) {
  const out = { ...texts }
  const applied: Correction[] = []
  const rejected: RejectedCorrection[] = []
  for (const c of proposals) {
    const why = refusal(c, out, protectedWords)
    if (why) { rejected.push({ ...c, why }); continue }
    const inside = c.corrected.indexOf(c.original)
    let changed = false
    out[c.field] = out[c.field].replace(boundedRe(c.original), (match, offset: number, whole: string) => {
      if (inside >= 0 && whole.slice(offset - inside, offset - inside + c.corrected.length) === c.corrected) return match
      changed = true
      return c.corrected
    })
    if (changed) applied.push(c)
    else rejected.push({ ...c, why: 'Ya estaba corregido' })
  }
  return { texts: out, applied, rejected }
}

// ─── Reviewers' answers ─────────────────────────────────────────────────────

type Json = Record<string, unknown>
type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] }
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
/** Keeps inner spacing: the fragment must match the text exactly. */
const raw = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const chan = (v: unknown): MarketingChannel | null => (v === 'WEB' || v === 'INSTAGRAM' || v === 'FACEBOOK' ? v : null)

export const MAX_CORRECTIONS = 80

export function parseProofread(input: unknown, texts: ReviewText[]): Parsed<Correction[]> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  if (!Array.isArray(input.cambios)) return { ok: false, errors: ['Falta la lista de cambios (vacía si no hay nada que corregir)'] }
  const byKey = new Map(texts.map((t) => [t.key, t]))
  const out: Correction[] = []
  for (const c of input.cambios.filter(isObj).slice(0, MAX_CORRECTIONS)) {
    const field = str(c.campo, 80)
    const t = byKey.get(field)
    if (!t) continue
    out.push({ field, channel: t.channel, original: raw(c.original, 500), corrected: raw(c.corregido, 700), reason: str(c.motivo, 200) })
  }
  return { ok: true, value: out }
}

export const VERDICTS = ['aprobada', 'cambios', 'rechazada'] as const
export type Verdict = (typeof VERDICTS)[number]
export type CriterionScore = { id: CriterionId; score: number; comment: string }
export type Instruction = { channel: MarketingChannel | null; field: string; change: string; reason: string }
export type EditorReview = { scores: CriterionScore[]; verdict: Verdict; summary: string; instructions: Instruction[] }

/** The criteria that apply to this piece: enabled ones, and SEO only when there is a blog article. */
export function activeCriteria(rubric: RubricItem[], channels: string[]) {
  return rubric.filter((r) => r.enabled && (r.id !== 'seo' || channels.includes('WEB')))
}

export function parseEditor(input: unknown, criteria: RubricItem[]): Parsed<EditorReview> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  const errors: string[] = []
  const given = new Map<string, Json>()
  for (const c of Array.isArray(input.criterios) ? input.criterios.filter(isObj) : []) given.set(str(c.id, 40), c)
  const scores: CriterionScore[] = []
  for (const r of criteria) {
    const c = given.get(r.id)
    const n = c ? c.puntaje : undefined
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10) { errors.push(`Falta el puntaje de 0 a 10 de «${CRITERION_LABEL[r.id]}» (${r.id})`); continue }
    scores.push({ id: r.id, score: Math.round(n * 10) / 10, comment: str(c!.comentario, 400) })
  }
  const verdict = VERDICTS.includes(input.veredicto as Verdict) ? (input.veredicto as Verdict) : null
  if (!verdict) errors.push(`veredicto: ${VERDICTS.join(', ')}`)
  const instructions: Instruction[] = (Array.isArray(input.instrucciones) ? input.instrucciones.filter(isObj) : [])
    .map((i) => ({ channel: chan(i.canal), field: str(i.campo, 80), change: str(i.cambio, 600), reason: str(i.motivo, 300) }))
    .filter((i) => i.change)
    .slice(0, 12)
  if (verdict !== 'aprobada' && !instructions.length) errors.push('Si pides cambios o rechazas, di qué cambiar, dónde y por qué (instrucciones)')
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { scores, verdict: verdict!, summary: str(input.resumen, 800), instructions } }
}

/** Weighted mean over the criteria that apply, computed here (not by the model), one decimal. */
export function weightedScore(scores: CriterionScore[], criteria: RubricItem[]) {
  let sum = 0
  let weights = 0
  for (const r of criteria) {
    const s = scores.find((x) => x.id === r.id)
    if (!s) continue
    sum += s.score * r.weight
    weights += r.weight
  }
  return weights ? Math.round((sum / weights) * 10) / 10 : 0
}

export type EditorOutcome = { result: 'approved' | 'changes' | 'rejected'; score: number; instructions: Instruction[] }

/**
 * The editor's verdict against the workspace's bar. Approval needs both the verdict and the minimum
 * score; an approval under the bar becomes a change request built from the weakest criteria.
 */
export function editorOutcome(review: EditorReview, criteria: RubricItem[], minScore: number): EditorOutcome {
  const score = weightedScore(review.scores, criteria)
  if (review.verdict === 'rechazada') return { result: 'rejected', score, instructions: review.instructions }
  if (review.verdict === 'aprobada' && score >= minScore) return { result: 'approved', score, instructions: [] }
  const instructions = review.instructions.length
    ? review.instructions
    : review.scores.filter((s) => s.score < minScore).sort((a, b) => a.score - b.score).map((s) => ({ channel: null, field: s.id, change: s.comment || `Mejora «${CRITERION_LABEL[s.id]}»`, reason: `${CRITERION_LABEL[s.id]}: ${s.score}/10` }))
  return { result: 'changes', score, instructions }
}

/** After a review round: approved, the agent rewrites (rounds left), or a person takes over. */
export function nextReviewStep(outcome: EditorOutcome['result'], round: number, maxRounds: number): 'approved' | 'rewrite' | 'human' {
  if (outcome === 'approved') return 'approved'
  if (outcome === 'changes' && round < maxRounds) return 'rewrite'
  return 'human'
}

/** The editor's asks as the agent's corrections for its next version. */
export function instructionsForAgent(instructions: Instruction[]) {
  return instructions.map((i) => `${i.channel ? `${CHANNEL_NAME[i.channel]}` : 'General'}${i.field ? ` (${i.field})` : ''}: ${i.change}${i.reason ? ` — ${i.reason}` : ''}`)
}

// ─── Publishing gate ────────────────────────────────────────────────────────

/**
 * Null when the post may be scheduled or published; otherwise why not. Only posts in the review's
 * scope, only when the review is mandatory: a current approval (or a person's override) of exactly
 * these texts.
 */
export function gateReason(s: EditorialSettings, post: { origin: string; reviewStatus: string | null; reviewHash: string | null }, currentHash: string): string | null {
  if (!s.required || !reviewApplies(s, post.origin)) return null
  if (PASSING.includes(post.reviewStatus as ReviewStatus) && post.reviewHash === currentHash) return null
  if (post.reviewHash && post.reviewHash !== currentHash) return 'Cambió después de la revisión editorial: vuelve a revisarla'
  if (post.reviewStatus === 'changes') return 'El editor pidió cambios que no se han resuelto'
  if (post.reviewStatus === 'rejected') return 'El editor la rechazó'
  return 'Falta la revisión editorial'
}

export const criterionHelp = (id: CriterionId) => CRITERIA.find((c) => c.id === id)?.help ?? ''
export { CRITERION_IDS }
