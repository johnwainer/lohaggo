/**
 * The proposal comparison the chat agent shows («responde 1, 2 o 3 para elegir») and how a short answer
 * («2», «la segunda», «opción 1») maps back to a proposal. The numbering is stored on the conversation
 * (customFields.proposalOptions) because the model does not see its tool calls on the next turn. Pure.
 */
import { PROPOSAL_BADGE_LABEL, type ProposalBadge } from '@/lib/proposals/ranking'

export const PROPOSAL_OPTIONS_KEY = 'proposalOptions'
/** A comparison older than this is not used to read «2» as a choice */
export const PROPOSAL_OPTIONS_TTL_MS = 48 * 3600_000
export const MAX_CHAT_OPTIONS = 6

export type ProposalOption = { n: number; id: string; requestId: string; label: string }
export type ProposalOptions = { at: string; items: ProposalOption[]; reasonAskedAt?: string | null }

export function readProposalOptions(customFields: unknown, now: Date = new Date()): ProposalOptions | null {
  const fields = customFields && typeof customFields === 'object' ? (customFields as Record<string, unknown>) : {}
  const raw = fields[PROPOSAL_OPTIONS_KEY] as Partial<ProposalOptions> | undefined
  if (!raw || typeof raw.at !== 'string' || !Array.isArray(raw.items)) return null
  const at = new Date(raw.at).getTime()
  if (!Number.isFinite(at) || now.getTime() - at > PROPOSAL_OPTIONS_TTL_MS) return null
  const items = raw.items.filter((i): i is ProposalOption => Boolean(i) && typeof i.n === 'number' && typeof i.id === 'string' && typeof i.requestId === 'string')
  if (!items.length) return null
  return { at: raw.at, items: items.map((i) => ({ ...i, label: typeof i.label === 'string' ? i.label : '' })), reasonAskedAt: typeof raw.reasonAskedAt === 'string' ? raw.reasonAskedAt : null }
}

const ORDINALS: Record<string, number> = { primera: 1, primero: 1, segunda: 2, segundo: 2, tercera: 3, tercero: 3, cuarta: 4, cuarto: 4, quinta: 5, quinto: 5, sexta: 6, sexto: 6 }
const NUMBER_WORDS: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }
const CHOICE_FILLER = new Set(['la', 'el', 'opcion', 'numero', 'quiero', 'me', 'quedo', 'con', 'elijo', 'escojo', 'prefiero', 'esa', 'ese', 'de', 'por', 'favor', 'porfa', 'nro', 'num', 'propuesta', 'gracias', 'si', 'pues', 'mejor', 'va', 'dale'])

/**
 * The option number when the whole message is a choice («2», «la 2», «opción dos», «me quedo con la
 * segunda»), else null. A message with anything else (a question, a price) is left to the model.
 */
export function optionFromText(text: string, max: number): number | null {
  const words = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 7) return null
  let pick: number | null = null
  for (const w of words) {
    const n = /^\d$/.test(w) ? Number(w) : ORDINALS[w] ?? NUMBER_WORDS[w] ?? null
    if (n !== null) {
      if (pick !== null && pick !== n) return null
      pick = n
    } else if (!CHOICE_FILLER.has(w)) return null
  }
  return pick !== null && pick >= 1 && pick <= max ? pick : null
}

export type CompareRow = {
  n: number
  ref: string
  partnerName: string
  price: string
  rating: number
  reviews: number
  jobs: number
  zone: string | null
  when: string | null
  badges: ProposalBadge[]
}

/** «1) Darwin · $130.000 · 4.8★ (12 reseñas) · 15 servicios · cubre El Poblado · propone sáb 15 nov 09:00 · Mejor calificado [ref abc123]» */
export function compareLine(r: CompareRow) {
  const rep = r.reviews > 0 ? `${r.rating.toFixed(1)}★ (${r.reviews} reseña${r.reviews === 1 ? '' : 's'})` : 'nuevo, sin reseñas'
  const parts = [
    `${r.n}) ${r.partnerName}`,
    r.price,
    rep,
    `${r.jobs} servicio${r.jobs === 1 ? '' : 's'} hecho${r.jobs === 1 ? '' : 's'}`,
    r.zone ? `cubre ${r.zone}` : null,
    r.when ? `propone ${r.when}` : 'fecha: la de la solicitud',
    ...r.badges.map((b) => PROPOSAL_BADGE_LABEL[b]),
  ]
  return `${parts.filter(Boolean).join(' · ')} [ref ${r.ref}]`
}

/** «Responde 1, 2 o 3 para elegir» / «Responde 1 para elegirla» */
export function choosePrompt(count: number) {
  if (count <= 1) return 'Responde 1 para elegirla'
  const nums = Array.from({ length: count }, (_, i) => String(i + 1))
  return `Responde ${nums.slice(0, -1).join(', ')} o ${nums[nums.length - 1]} para elegir`
}
