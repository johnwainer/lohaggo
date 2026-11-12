/**
 * «Pedir de nuevo»: a finished booking becomes a draft of the request wizard (same partner, same address and
 * notes) saved in the browser; the service page reopens it with `?resume=1` at the «Cuándo» step so the
 * client only picks a day.
 */
import { emptyDraft, saveDraft, type RequestDraft } from '@/lib/service-requests/draft'

/** Address text as the wizard writes it: «calle, barrio, Ciudad» (the saved-address form adds «#número»). */
export function splitStoredAddress(address: string): { street: string; neighborhood: string } {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) return { street: parts.slice(0, -2).join(', '), neighborhood: parts[parts.length - 2] }
  if (parts.length === 2) return { street: parts[0], neighborhood: parts[1] }
  return { street: parts[0] ?? '', neighborhood: '' }
}

/** The booking's notes without the lines the platform added itself (arrival directions, the time window). */
export function cleanNotes(notes: string | null | undefined): { notes: string; instructions: string } {
  const lines = (notes ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const instructions = lines.find((l) => l.startsWith('Indicaciones para llegar:'))?.replace('Indicaciones para llegar:', '').trim() ?? ''
  const rest = lines.filter((l) => !l.startsWith('Indicaciones para llegar:') && !l.startsWith('Franja preferida:'))
  return { notes: rest.join('\n').slice(0, 1500), instructions: instructions.slice(0, 300) }
}

export function draftFromBooking(b: { serviceSlug: string; partnerId?: string | null; address: string; notes?: string | null }, now = Date.now()): RequestDraft {
  const { street, neighborhood } = splitStoredAddress(b.address)
  const { notes, instructions } = cleanNotes(b.notes)
  return {
    ...emptyDraft(b.serviceSlug),
    step: 2,
    partnerId: b.partnerId ?? '',
    addressMode: 'new',
    newAddress: { street: street.slice(0, 200), neighborhood: neighborhood.slice(0, 100), instructions },
    when: 'flexible',
    notes,
    savedAt: now,
  }
}

/** Saves the draft and returns where to go. */
export function rebookHref(storage: Pick<Storage, 'setItem'> | null | undefined, b: Parameters<typeof draftFromBooking>[0]): string {
  const { v: _v, savedAt: _s, ...draft } = draftFromBooking(b)
  saveDraft(storage as Storage | null | undefined, draft)
  return `/servicios/${b.serviceSlug}?resume=1`
}
