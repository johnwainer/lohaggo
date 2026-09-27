/**
 * The LoHaggo service guarantee: the single source of the policy. The public page (/garantia), the site's
 * trust claim, the chat agent's tool, the admin screen and Haggo all read it from here. Pure.
 *
 * Honest with how the platform works today: the client normally pays the partner directly (cash or
 * transfer), so LoHaggo does not hold the money. What LoHaggo can always do is find another partner,
 * cancel without cost, mediate, and act on the partner (strikes, pause). Money back only when the payment
 * went through LoHaggo online; otherwise LoHaggo asks the partner to return what was agreed.
 */

export type GuaranteeType = 'NO_SHOW' | 'BAD_WORK' | 'DAMAGE'
export type GuaranteeRemedy = 'redo' | 'reassign' | 'cancel_free' | 'refund' | 'mediation' | 'reject'
export type GuaranteeStatus = 'OPEN' | 'REDO_SCHEDULED' | 'REASSIGNED' | 'REFUND_REVIEW' | 'RESOLVED' | 'REJECTED'

export const GUARANTEE_TYPES: GuaranteeType[] = ['NO_SHOW', 'BAD_WORK', 'DAMAGE']
export const GUARANTEE_REMEDIES: GuaranteeRemedy[] = ['redo', 'reassign', 'cancel_free', 'refund', 'mediation', 'reject']
export const isGuaranteeType = (v: unknown): v is GuaranteeType => typeof v === 'string' && (GUARANTEE_TYPES as string[]).includes(v)
export const isGuaranteeRemedy = (v: unknown): v is GuaranteeRemedy => typeof v === 'string' && (GUARANTEE_REMEDIES as string[]).includes(v)

export const TYPE_LABEL: Record<GuaranteeType, string> = {
  NO_SHOW: 'El socio no llegó',
  BAD_WORK: 'Trabajo incompleto o distinto',
  DAMAGE: 'Daño a la propiedad',
}

export const STATUS_LABEL: Record<GuaranteeStatus, string> = {
  OPEN: 'Abierto',
  REDO_SCHEDULED: 'Corrección acordada',
  REASSIGNED: 'Otro socio en camino',
  REFUND_REVIEW: 'Reembolso en revisión',
  RESOLVED: 'Resuelto',
  REJECTED: 'No procede',
}

export const REMEDY_LABEL: Record<GuaranteeRemedy, string> = {
  redo: 'El mismo socio corrige sin costo',
  reassign: 'Otro socio con prioridad',
  cancel_free: 'Cancelar sin costo',
  refund: 'Reembolso del pago en línea',
  mediation: 'Mediación del equipo',
  reject: 'No procede',
}

/** Claims that still need someone: they block a second claim on the same booking and count for the SLA. */
export const ACTIVE_STATUSES: GuaranteeStatus[] = ['OPEN', 'REDO_SCHEDULED', 'REFUND_REVIEW']
export const isActiveStatus = (s: string) => (ACTIVE_STATUSES as string[]).includes(s)

// ─── Times ──────────────────────────────────────────────────────────────────

const H = 3600_000
/** Late arrival without notice that counts as a no-show */
export const NO_SHOW_LATE_MINUTES = 60
/** A no-show is claimed from the scheduled time up to this many hours after it */
export const NO_SHOW_WINDOW_HOURS = 24
/** Bad work (and damage) is claimed up to this many hours after the booking was marked completed */
export const BAD_WORK_WINDOW_HOURS = 72
/** The same partner may come back to fix it within this many hours, if the client accepts */
export const REDO_WINDOW_HOURS = 72
/** SLA: first reply right away (chat agent), a proposed solution within 24 h, resolved within 72 h */
export const SLA_PROPOSAL_HOURS = 24
export const SLA_RESOLUTION_HOURS = 72

export const STRIKE_WINDOW_DAYS = 90
/** Strikes in the window that pause the partner's availability automatically (and open a review) */
export const STRIKES_TO_PAUSE = 2
/** Strikes in the window at which the team decides whether to suspend (never automatic) */
export const STRIKES_TO_REVIEW_SUSPENSION = 3

export function slaDueAt(createdAt: Date) {
  return new Date(createdAt.getTime() + SLA_RESOLUTION_HOURS * H)
}

export function isOverdue(claim: { status: string; slaDueAt: Date | string }, now = new Date()) {
  return isActiveStatus(claim.status) && new Date(claim.slaDueAt).getTime() < now.getTime()
}

// ─── Eligibility ────────────────────────────────────────────────────────────

export type EligibilityBooking = {
  status: string
  partnerId: string | null
  /** The moment of the service (lib/bookings/ops bookingWhen) */
  scheduledAt: Date
  /** When it was marked completed; null if it was not */
  completedAt: Date | null
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

const fmtHours = (h: number) => `${h} horas`

/** Whether a claim of `type` can be opened on this booking now. The reason is Spanish text for the person. */
export function eligibility(booking: EligibilityBooking, type: GuaranteeType, now = new Date()): Eligibility {
  if (!isGuaranteeType(type)) return { ok: false, reason: 'Tipo de reclamo desconocido.' }
  if (booking.status === 'CANCELLED') return { ok: false, reason: 'La reserva está cancelada: la garantía cubre servicios que siguen en pie o ya se hicieron.' }
  if (!booking.partnerId) return { ok: false, reason: 'La reserva todavía no tiene socio asignado.' }
  const t = now.getTime()

  if (type === 'NO_SHOW') {
    const from = booking.scheduledAt.getTime()
    if (t < from) return { ok: false, reason: 'Todavía no es la hora del servicio. Si el socio no llega, puedes reclamar desde la hora programada.' }
    if (t > from + NO_SHOW_WINDOW_HOURS * H) return { ok: false, reason: `Pasaron más de ${fmtHours(NO_SHOW_WINDOW_HOURS)} desde la hora del servicio: el plazo para reclamar que el socio no llegó ya venció.` }
    if (booking.status === 'COMPLETED') return { ok: false, reason: 'La reserva figura como completada. Si el trabajo quedó mal, el reclamo es por trabajo incompleto.' }
    return { ok: true }
  }

  if (type === 'BAD_WORK') {
    if (booking.status !== 'COMPLETED' || !booking.completedAt) return { ok: false, reason: 'El reclamo por trabajo incompleto o distinto se hace cuando la reserva está marcada como completada.' }
    if (t > booking.completedAt.getTime() + BAD_WORK_WINDOW_HOURS * H) return { ok: false, reason: `Pasaron más de ${fmtHours(BAD_WORK_WINDOW_HOURS)} desde que se completó el servicio: el plazo ya venció.` }
    return { ok: true }
  }

  // DAMAGE: during the service, claimed while it is in progress or within the window after completion
  if (booking.status === 'IN_PROGRESS') return { ok: true }
  if (booking.status === 'COMPLETED' && booking.completedAt) {
    if (t > booking.completedAt.getTime() + BAD_WORK_WINDOW_HOURS * H) return { ok: false, reason: `Pasaron más de ${fmtHours(BAD_WORK_WINDOW_HOURS)} desde que se completó el servicio: el plazo ya venció.` }
    return { ok: true }
  }
  return { ok: false, reason: 'Un daño se reclama durante el servicio o después de completado; esta reserva aún no ha empezado.' }
}

// ─── Remedies ───────────────────────────────────────────────────────────────

export type RemedyOption = { remedy: GuaranteeRemedy; label: string; detail: string }

/** A payment counts as online when it went through LoHaggo (MercadoPago) and was approved. */
export function isOnlinePayment(p: { status: string; mercadopagoId?: string | null; partnerConfirmedMethod?: string | null } | null | undefined) {
  if (!p || p.status !== 'APPROVED') return false
  return Boolean(p.mercadopagoId) || p.partnerConfirmedMethod === 'MERCADOPAGO'
}

/** The remedies of the policy for a claim type, in the order they are offered. `reject` always goes last. */
export function remedyOptions(type: GuaranteeType, paidOnline: boolean): RemedyOption[] {
  const out: RemedyOption[] = []
  const reject: RemedyOption = { remedy: 'reject', label: REMEDY_LABEL.reject, detail: 'El reclamo no está cubierto (fuera de plazo, acordado por fuera de LoHaggo, cambio de alcance no registrado, desgaste normal) o no se confirmó.' }
  if (type === 'NO_SHOW') {
    out.push({ remedy: 'reassign', label: REMEDY_LABEL.reassign, detail: 'Se crea una solicitud igual (mismo servicio, dirección y notas), urgente y marcada de garantía, y se avisa a los socios.' })
    out.push({ remedy: 'cancel_free', label: REMEDY_LABEL.cancel_free, detail: 'Se cancela la reserva sin costo para el cliente.' })
    if (paidOnline) out.push({ remedy: 'refund', label: 'Reembolso total', detail: 'Hubo pago en línea: se aprueba el reembolso total y el equipo lo ejecuta.' })
  } else if (type === 'BAD_WORK') {
    out.push({ remedy: 'redo', label: REMEDY_LABEL.redo, detail: `El mismo socio vuelve a corregir sin costo dentro de ${fmtHours(REDO_WINDOW_HOURS)}, si el cliente acepta.` })
    out.push({ remedy: 'reassign', label: REMEDY_LABEL.reassign, detail: 'Si el cliente no acepta o el socio no corrige: solicitud nueva, urgente y marcada de garantía.' })
    if (paidOnline) out.push({ remedy: 'refund', label: 'Revisión de reembolso', detail: 'Hubo pago en línea: el equipo revisa un reembolso parcial o total.' })
    else out.push({ remedy: 'mediation', label: 'Pedir al socio devolver lo acordado', detail: 'Pagó en efectivo o transferencia: LoHaggo pide al socio devolver lo acordado; si no lo hace, strike y pausa.' })
  } else {
    out.push({ remedy: 'mediation', label: REMEDY_LABEL.mediation, detail: 'Una persona del equipo media entre las partes y documenta el caso. LoHaggo no es un seguro y no paga daños.' })
  }
  out.push(reject)
  return out
}

/** Whether a remedy is allowed for this claim. */
export function remedyAllowed(type: GuaranteeType, remedy: GuaranteeRemedy, paidOnline: boolean) {
  return remedyOptions(type, paidOnline).some((o) => o.remedy === remedy)
}

/** The claim's status after a remedy. */
export function statusAfter(type: GuaranteeType, remedy: GuaranteeRemedy): GuaranteeStatus {
  switch (remedy) {
    case 'redo': return 'REDO_SCHEDULED'
    case 'reassign': return 'REASSIGNED'
    case 'refund': return type === 'NO_SHOW' ? 'RESOLVED' : 'REFUND_REVIEW'
    case 'reject': return 'REJECTED'
    default: return 'RESOLVED'
  }
}

/** Default for the strike checkbox: a confirmed no-show or bad work counts; damage and rejections do not. */
export function strikeSuggested(type: GuaranteeType, remedy: GuaranteeRemedy) {
  return remedy !== 'reject' && (type === 'NO_SHOW' || type === 'BAD_WORK')
}

/** What happens to the partner with `strikes` in the last STRIKE_WINDOW_DAYS days (including the new one). */
export function strikeConsequence(strikes: number): 'none' | 'pause' | 'review_suspension' {
  if (strikes >= STRIKES_TO_REVIEW_SUSPENSION) return 'review_suspension'
  if (strikes >= STRIKES_TO_PAUSE) return 'pause'
  return 'none'
}

/** Support-case priority of a new claim. */
export function claimPriority(type: GuaranteeType): 'HIGH' | 'MEDIUM' {
  return type === 'BAD_WORK' ? 'MEDIUM' : 'HIGH'
}

// ─── Texts ──────────────────────────────────────────────────────────────────

export const POLICY_SUMMARY = 'Si el socio no llega o el trabajo queda incompleto, te conseguimos otro socio con prioridad, cancelamos sin costo o, si lo acepta, el mismo socio corrige sin costo. Respondemos de inmediato por chat y resolvemos en máximo 72 horas. Si pagaste en línea con LoHaggo revisamos el reembolso; si pagaste directo al socio, le pedimos devolver lo acordado.'

export const POLICY_URL = '/garantia'
export const POLICY_CONTACT_EMAIL = 'hola@lohaggo.com'

export type PolicySection = { title: string; items: string[] }

/** The full policy, as sections (the public page renders them; `POLICY_FULL` is the same as plain text). */
export const POLICY_SECTIONS: PolicySection[] = [
  {
    title: 'Qué cubre',
    items: [
      'Aplica a reservas hechas por LoHaggo (en la app o por chat con nuestro asistente). No cubre trabajos ni pagos acordados por fuera de LoHaggo.',
      `El socio no llegó, o llegó más de ${NO_SHOW_LATE_MINUTES} minutos tarde sin avisar. Puedes reclamar desde la hora programada y hasta ${NO_SHOW_WINDOW_HOURS} horas después.`,
      `El trabajo quedó incompleto o distinto a lo acordado en tu solicitud o en la propuesta que aceptaste. Puedes reclamar hasta ${BAD_WORK_WINDOW_HOURS} horas después de que la reserva se marque como completada, con una descripción de lo que pasó y, si tienes, fotos.`,
      `Un daño a tu propiedad causado durante el servicio. Puedes reclamar durante el servicio o hasta ${BAD_WORK_WINDOW_HOURS} horas después. Siempre lo atiende una persona del equipo.`,
    ],
  },
  {
    title: 'Cómo lo resolvemos',
    items: [
      'Si el socio no llegó: te conseguimos otro socio con prioridad (creamos una solicitud igual, urgente, y avisamos a los socios) o cancelamos la reserva sin costo, como prefieras. Si pagaste en línea con LoHaggo, te devolvemos el total.',
      `Si el trabajo quedó incompleto o distinto: primero, si lo aceptas, el mismo socio vuelve a corregirlo sin costo dentro de ${REDO_WINDOW_HOURS} horas. Si no lo aceptas o el socio no corrige, te conseguimos otro socio con prioridad. Si pagaste en línea con LoHaggo, revisamos un reembolso parcial o total. Si pagaste en efectivo o por transferencia directo al socio, LoHaggo no tiene ese dinero: le pedimos al socio devolver lo acordado y, si no lo hace, sancionamos su cuenta.`,
      'Si hubo un daño: una persona del equipo media entre tú y el socio y documenta el caso. LoHaggo no es un seguro y no paga daños.',
    ],
  },
  {
    title: 'Tiempos',
    items: [
      'Respuesta inmediata por chat: nuestro asistente toma tu reclamo en el momento.',
      `Propuesta de solución en máximo ${SLA_PROPOSAL_HOURS} horas.`,
      `Caso resuelto en máximo ${SLA_RESOLUTION_HOURS} horas desde que lo reportas.`,
    ],
  },
  {
    title: 'Límites',
    items: [
      'Lo máximo que cubre la garantía es el valor del servicio reservado.',
      'No cubre: materiales comprados aparte, trabajos o pagos acordados por fuera de LoHaggo, cambios de alcance que no quedaron registrados en la solicitud o la propuesta, el desgaste normal, ni reclamos hechos fuera de plazo.',
    ],
  },
  {
    title: 'Qué pasa con el socio',
    items: [
      'Un «no llegó» o un trabajo mal hecho confirmados cuentan como falta en la cuenta del socio.',
      `Con ${STRIKES_TO_PAUSE} faltas en ${STRIKE_WINDOW_DAYS} días, el socio deja de recibir solicitudes mientras revisamos su caso. Con ${STRIKES_TO_REVIEW_SUSPENSION}, el equipo decide si suspende su cuenta.`,
    ],
  },
  {
    title: 'Cómo reclamar',
    items: [
      'Escríbenos por el chat de LoHaggo (WhatsApp, Instagram o Messenger) con la referencia de tu reserva, qué pasó y a qué hora. Si tienes fotos, envíalas por el mismo chat.',
      `También puedes escribir a ${POLICY_CONTACT_EMAIL}.`,
    ],
  },
]

export const POLICY_FULL = [
  'Garantía LoHaggo',
  '',
  ...POLICY_SECTIONS.flatMap((s) => [s.title, ...s.items.map((i) => `- ${i}`), '']),
].join('\n').trim()
