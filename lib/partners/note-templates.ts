/**
 * Quick notes a partner reuses in proposals («Incluye materiales», «Visita sin costo»…). Kept in the browser
 * (localStorage): pure helpers with an injectable storage, like lib/service-requests/draft.ts.
 */

export const NOTE_TEMPLATES_KEY = 'lohaggo:proposal-note-templates'
export const MAX_TEMPLATES = 8
export const MAX_TEMPLATE_LENGTH = 140

export const DEFAULT_NOTE_TEMPLATES = ['Incluye materiales', 'Visita sin costo', 'Garantía de 30 días', 'Llego en menos de una hora'] as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_LENGTH) : '')

export function loadNoteTemplates(storage: StorageLike | null | undefined): string[] {
  if (!storage) return [...DEFAULT_NOTE_TEMPLATES]
  try {
    const raw = JSON.parse(storage.getItem(NOTE_TEMPLATES_KEY) || 'null')
    if (!Array.isArray(raw)) return [...DEFAULT_NOTE_TEMPLATES]
    const list = raw.map(clean).filter(Boolean)
    return Array.from(new Set(list)).slice(0, MAX_TEMPLATES)
  } catch {
    return [...DEFAULT_NOTE_TEMPLATES]
  }
}

function save(storage: StorageLike | null | undefined, list: string[]) {
  if (!storage) return
  try { storage.setItem(NOTE_TEMPLATES_KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
}

/** Adds a template (newest first, no duplicates ignoring case, at most MAX_TEMPLATES). Returns the new list. */
export function addNoteTemplate(storage: StorageLike | null | undefined, text: string): string[] {
  const t = clean(text)
  const current = loadNoteTemplates(storage)
  if (!t) return current
  const next = [t, ...current.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_TEMPLATES)
  save(storage, next)
  return next
}

export function removeNoteTemplate(storage: StorageLike | null | undefined, text: string): string[] {
  const next = loadNoteTemplates(storage).filter((x) => x !== text)
  save(storage, next)
  return next
}

/** Appends a template to the note being written, on its own sentence, never twice. */
export function applyNoteTemplate(note: string, template: string, maxLength = 1000): string {
  const current = note.trim()
  if (current.toLowerCase().includes(template.toLowerCase())) return note
  const joined = current ? `${current.replace(/[.\s]+$/, '')}. ${template}.` : `${template}.`
  return joined.slice(0, maxLength)
}

/** The price a proposal starts with: the partner's catalogue price when it respects the base minimum. */
export function suggestedProposalPrice(ownPrice: number | null | undefined, basePrice: number): number | null {
  if (typeof ownPrice !== 'number' || !Number.isFinite(ownPrice) || ownPrice <= 0) return null
  return ownPrice >= basePrice ? ownPrice : basePrice
}
