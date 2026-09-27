/**
 * Client-side draft of the "Solicitar" wizard, so nothing is lost when the visitor has to log in or register
 * before sending. Pure helpers with an injectable storage (localStorage in the browser).
 */

export type WhenMode = 'asap' | 'flexible' | 'scheduled'
export type AddressMode = 'saved' | 'new'

export type NewAddressDraft = { street: string; neighborhood: string; instructions: string }

export type RequestDraft = {
  v: 1
  slug: string
  step: number
  partnerId: string
  addressMode: AddressMode
  selectedAddressId: string
  newAddress: NewAddressDraft
  when: WhenMode
  preferredDate: string
  preferredTime: string
  notes: string
  budget: string
  savedAt: number
}

export const DRAFT_KEY = 'lohaggo:request-draft'
export const DRAFT_PHOTOS_KEY = 'lohaggo:request-draft-photos'
export const DRAFT_TTL_MS = 7 * 24 * 3600_000
export const FLEXIBLE_NOTE = 'Horario flexible esta semana'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function emptyDraft(slug: string): RequestDraft {
  return {
    v: 1, slug, step: 1, partnerId: '', addressMode: 'new', selectedAddressId: '',
    newAddress: { street: '', neighborhood: '', instructions: '' },
    when: 'asap', preferredDate: '', preferredTime: '', notes: '', budget: '', savedAt: 0,
  }
}

export function saveDraft(storage: StorageLike | null | undefined, draft: Omit<RequestDraft, 'v' | 'savedAt'>, now = Date.now()) {
  if (!storage) return
  try { storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, v: 1, savedAt: now })) } catch { /* quota / private mode */ }
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

/** The draft for this service if there is a recent, well-formed one; otherwise null. */
export function loadDraft(storage: StorageLike | null | undefined, slug: string, now = Date.now()): RequestDraft | null {
  if (!storage) return null
  let raw: unknown
  try { raw = JSON.parse(storage.getItem(DRAFT_KEY) || 'null') } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<RequestDraft>
  if (d.v !== 1 || d.slug !== slug) return null
  if (typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_TTL_MS) return null
  const when: WhenMode = d.when === 'flexible' || d.when === 'scheduled' ? d.when : 'asap'
  const na = (d.newAddress && typeof d.newAddress === 'object' ? d.newAddress : {}) as Partial<NewAddressDraft>
  return {
    v: 1,
    slug,
    step: Math.min(3, Math.max(1, Number(d.step) || 1)),
    partnerId: str(d.partnerId, 100),
    addressMode: d.addressMode === 'saved' ? 'saved' : 'new',
    selectedAddressId: str(d.selectedAddressId, 100),
    newAddress: { street: str(na.street, 200), neighborhood: str(na.neighborhood, 100), instructions: str(na.instructions, 300) },
    when,
    preferredDate: /^\d{4}-\d{2}-\d{2}$/.test(str(d.preferredDate)) ? str(d.preferredDate) : '',
    preferredTime: /^\d{2}:\d{2}$/.test(str(d.preferredTime)) ? str(d.preferredTime) : '',
    notes: str(d.notes),
    budget: str(d.budget, 20),
    savedAt: d.savedAt,
  }
}

export function clearDraft(storage: StorageLike | null | undefined) {
  if (!storage) return
  try { storage.removeItem(DRAFT_KEY); storage.removeItem(DRAFT_PHOTOS_KEY) } catch { /* ignore */ }
}

/** Today's date in Bogotá plus `days`, as YYYY-MM-DD. */
export function bogotaDatePlus(days: number, now = new Date()): string {
  const bogota = new Date(now.getTime() - 5 * 3600_000)
  bogota.setUTCDate(bogota.getUTCDate() + days)
  return bogota.toISOString().slice(0, 10)
}

/** What the API receives for each "Cuándo" option (no schema change: flexible = today+2, no time, a note). */
export function timingPayload(when: WhenMode, preferredDate: string, preferredTime: string, now = new Date()) {
  if (when === 'asap') return { isUrgent: true, preferredDate: null, preferredTime: null, note: null as string | null }
  if (when === 'flexible') return { isUrgent: false, preferredDate: bogotaDatePlus(2, now), preferredTime: null, note: FLEXIBLE_NOTE as string | null }
  return { isUrgent: false, preferredDate: preferredDate || null, preferredTime: preferredTime || null, note: null as string | null }
}

/** Notes sent with the request: what the client wrote, plus the flexible-time note and arrival directions. */
export function composeNotes(parts: { notes?: string; timingNote?: string | null; instructions?: string }): string {
  const out = [parts.notes?.trim(), parts.timingNote, parts.instructions?.trim() ? `Indicaciones para llegar: ${parts.instructions.trim()}` : null]
  return out.filter(Boolean).join('\n').slice(0, 2000)
}
