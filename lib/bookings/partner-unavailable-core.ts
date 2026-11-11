/**
 * A partner tells the client, through the booking chat (app or WhatsApp relay), that they cannot come, are
 * in another city or will be late. Pure: the signal (a simple heuristic; the AI agent can also flag it when
 * it relays the message) and the client's message with options.
 */
import { cop } from '@/lib/ai/actions-core'

export type UnavailableKind = 'cannot' | 'other_city' | 'late'
export const UNAVAILABLE_KINDS: UnavailableKind[] = ['cannot', 'other_city', 'late']
export const UNAVAILABLE_MARK = 'partner_unavailable'
/** One notice per booking and kind in this time (a partner repeating it does not alert everyone again) */
export const UNAVAILABLE_DEDUPE_MS = 12 * 3600_000

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')

const OTHER_CITY = [
  /\b(?:estoy|ando|me encuentro|quede|sigo|voy a estar|estare)\s+(?:en otra ciudad|fuera de (?:la )?ciudad|fuera de (?:medellin|bogota|cali)|de viaje|viajando|por fuera de la ciudad)\b/,
  /\btuve que viajar\b|\bme toco viajar\b|\bsali de (?:la )?ciudad\b/,
]
const CANNOT = [
  /\bno (?:voy a |vamos a |creo )?(?:poder|puedo|podre|podria|podemos|alcanzo|alcanzare|alcanzo a) (?:ir|asistir|atender|cumplir|llegar|hacer(?:lo)? (?:hoy|manana)|el servicio|la cita|la reserva|manana|hoy)\b/,
  /\bno (?:voy a |vamos a )?(?:ir|llegar|asistir)\b(?! tarde)(?: (?:hoy|manana|a la cita|al servicio))/,
  /\b(?:tengo|tuve|me salio|me surgio|se me presento) (?:una |un )?(?:emergencia|calamidad|imprevisto|inconveniente)\b/,
  /\b(?:debo|tengo que|me toca|toca|voy a tener que) cancelar\b/,
  /\bcancelo (?:la|el) (?:cita|servicio|reserva)\b/,
  /\bno (?:estoy|estare|me encuentro) disponible\b/,
]
const LATE = [
  /\b(?:voy|vamos|iba) a llegar (?:un poco |algo |como \d+ ?(?:min|minutos|hora|horas) )?(?:tarde|retrasad[oa]|con retraso)\b/,
  /\b(?:llego|llegare|llegaremos) (?:un poco |algo )?(?:tarde|retrasad[oa]|con retraso)\b/,
  /\bme (?:retrase|retraso|demore|voy a demorar|atrase|cogio la tarde|cogio el trancon)\b/,
  /\b(?:estoy|voy|vamos|ando) (?:un poco |algo )?(?:retrasad[oa]|atrasad[oa]|demorad[oa]|tarde)\b/,
]
const NEGATED_LATE = /\bno (?:voy a llegar|llego|llegare|estoy|voy) (?:un poco |algo )?(?:tarde|retrasad[oa]|atrasad[oa])\b/

/** The strongest signal in the partner's message, or null. «Estoy de viaje, no podré ir» → other_city. */
export function partnerUnavailableSignal(text: string | null | undefined): UnavailableKind | null {
  const t = fold(text ?? '')
  if (!t.trim()) return null
  if (OTHER_CITY.some((re) => re.test(t))) return 'other_city'
  if (CANNOT.some((re) => re.test(t))) return 'cannot'
  if (!NEGATED_LATE.test(t) && LATE.some((re) => re.test(t))) return 'late'
  return null
}

export function asUnavailableKind(v: unknown): UnavailableKind | null {
  return typeof v === 'string' && (UNAVAILABLE_KINDS as string[]).includes(v) ? (v as UnavailableKind) : null
}

const KIND_TEXT: Record<UnavailableKind, string> = {
  cannot: 'no podrá atender',
  other_city: 'está fuera de la ciudad y no podrá atender',
  late: 'va a llegar tarde a',
}

export const UNAVAILABLE_LABEL: Record<UnavailableKind, string> = {
  cannot: 'avisó que no puede ir a',
  other_city: 'está en otra ciudad y no puede ir a',
  late: 'avisó que llega tarde a',
}

/** What the client reads right away, with what they can do (no invented prices: only the real other proposals). */
export function unavailableClientText(p: { kind: UnavailableKind; partnerName: string | null; service: string; when: string | null; others: { count: number; minPrice: number | null } }) {
  const who = p.partnerName?.trim().split(/\s+/)[0] || 'Tu socio'
  const at = p.when ? ` (${p.when})` : ''
  if (p.kind === 'late') {
    return `${who} nos avisó que ${KIND_TEXT.late} tu servicio de ${p.service}${at}. Si la nueva hora no te sirve, dime y te ayudo a reprogramar o a buscar otro socio.`
  }
  const others = p.others.count > 0
    ? ` Tenías ${p.others.count === 1 ? 'otra propuesta' : `${p.others.count} propuestas más`}${p.others.minPrice ? ` (desde ${cop(p.others.minPrice)})` : ''}: si cancelamos esta reserva, vuelven a estar disponibles para que elijas una.`
    : ''
  return `${who} nos avisó que ${KIND_TEXT[p.kind]} tu servicio de ${p.service}${at}.${others} ¿Prefieres esperar a que te proponga otra fecha, o cancelamos y reabrimos tu solicitud para que otros socios te propongan?`
}
