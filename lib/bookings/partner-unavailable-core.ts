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

const ON_WAY = [
  /\b(?:ya )?(?:voy|vamos|estoy|ando|sigo|iba) (?:en camino|camino (?:a|para|hacia)|de camino|para (?:alla|alli)|saliendo|llegando)\b/,
  // «ya salí para allá», «voy saliendo» (not «ya salí del otro servicio»)
  /\b(?:ya )?(?:sali|salimos) (?:para|hacia) (?:alla|alli|alla mismo|su casa|la casa|donde)\b|\bvoy saliendo\b/,
  // «ya casi llego», «llego en 20» (not «¿a qué hora llego?» nor «llego mañana»)
  /\b(?:ya casi|casi) (?:llego|llegamos)\b|\b(?:llego|llegamos|llegare) (?:en|como en|dentro de) (?:\d{1,3}|un|una|media|cinco|diez|quince|veinte|treinta)\b/,
  // «en 10 llego», «estoy allá en hora y media»
  /\ben \d{1,3} (?:llego|estoy)\b|\bestoy (?:alla|ahi) (?:en|como en|dentro de)\b/,
]
const NEGATED_ON_WAY = /\bno (?:voy|vamos|estoy|llego|llegare|sali)\b/
const WORD_NUMBER: Record<string, number> = { una: 1, un: 1, dos: 2 }

/** «en 20», «20 minutos», «media hora», «una hora», «hora y media» → minutes (5–120), or null. */
export function etaMinutesIn(text: string | null | undefined): number | null {
  const t = fold(text ?? '')
  const clamp = (n: number) => Math.max(5, Math.min(120, Math.round(n)))
  if (/\bhora y media\b/.test(t)) return 90
  if (/\bmedia hora\b/.test(t)) return 30
  const minutes = t.match(/\b(\d{1,3}) ?(?:min|mins|minutos|minuticos|minutitos)\b/)
  if (minutes) return clamp(Number(minutes[1]))
  const h = t.match(/\b(\d|una|un|dos) horas?\b/)
  if (h) return clamp((WORD_NUMBER[h[1]] ?? Number(h[1])) * 60)
  // A bare number after «llego en» is minutes
  const bare = t.match(/\b(?:llego|llegare|llegamos|estoy (?:alla|ahi)) (?:en|como en|dentro de) (\d{1,3})\b/) ?? t.match(/\ben (\d{1,3}) (?:llego|estoy)\b/)
  return bare ? clamp(Number(bare[1])) : null
}

/**
 * The partner says they are on the way, about to arrive or running late («voy en camino», «llego en 20»,
 * «voy tarde, llego en media hora»), with the minutes when they give them. Null when they cannot come or
 * say something else. Pure.
 */
export function partnerOnWaySignal(text: string | null | undefined): { etaMinutes: number | null } | null {
  const t = fold(text ?? '')
  if (!t.trim()) return null
  const kind = partnerUnavailableSignal(t)
  if (kind === 'cannot' || kind === 'other_city') return null
  if (kind !== 'late' && (NEGATED_ON_WAY.test(t) || !ON_WAY.some((re) => re.test(t)))) return null
  return { etaMinutes: etaMinutesIn(t) }
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
