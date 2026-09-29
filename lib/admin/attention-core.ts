/**
 * What needs someone's attention in a service request, from the request to the payment: requests nobody
 * answers, bookings stuck in a state, payments waiting, contact details blocked in the chat, complaints,
 * prices that do not add up. Pure: the admin's «Solicitud 360» and Haggo read the same flags.
 */

export type AttentionSeverity = 'info' | 'warning' | 'critical'

/** Interventions the admin (or Haggo, with approval) can take on a request */
export type Intervention = 'renotify' | 'reactivate' | 'message_client' | 'message_partner' | 'message_both' | 'reschedule' | 'cancel_booking' | 'reopen_to_others' | 'open_case' | 'review_guarantee' | 'review_payment'

export type AttentionFlag = { code: string; severity: AttentionSeverity; title: string; detail: string; suggest: Intervention[] }

export type CaseChatMessage = { side: 'CLIENT' | 'PARTNER' | 'SYSTEM' | 'SUPPORT'; at: Date; content: string }
export type CaseChat = { proposalId: string; messages: CaseChatMessage[]; blockedAttempts: number }

export type CaseInput = {
  now: Date
  basePrice: number | null
  request: {
    status: string
    createdAt: Date
    expiresAt: Date
    isUrgent: boolean
    direct: boolean
    proposals: Array<{ id: string; status: string; price: number; createdAt: Date }>
  }
  booking: null | {
    status: string
    createdAt: Date
    /** Bogotá wall clock of the service */
    at: Date
    totalPrice: number
    proposalPrice: number | null
    /** When it entered its current status (last status event) */
    statusSince: Date
    payment: null | { status: string; confirmationStatus: string | null; clientReportedAt: Date | null }
    reschedules: number
    afterPhotos: number
    cancelledBy: string | null
  }
  chats: CaseChat[]
  guaranteeOpen: number
}

const H = 3600_000
const hoursSince = (now: Date, d: Date) => (now.getTime() - d.getTime()) / H
const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

/** Words that usually mean a complaint or a risk in a chat (checked on the last messages of each side). */
export const COMPLAINT_RE = /(?<![a-záéíóúñ])(estaf[a-zñ]*|robo|rob[oó]|robaron|no lleg[oó]|no vino|nunca lleg[a-zóñ]*|denunci[a-zñ]*|polic[ií]a|me cobr[oó] m[aá]s|cobr[oó] de m[aá]s|m[aá]s caro de lo|mal trabajo|qued[oó] mal|da[ñn][oó]|da[ñn]aron|romp(i[oó]|ieron)|peligro|acos[a-zñ]*|groser[a-zñ]*|irrespet[a-zñ]*|amenaz[a-zñ]*|reembolso|devuelvan)(?![a-záéíóúñ])/i

const ACTIVE_BOOKING = ['PENDING', 'CONFIRMED', 'IN_PROGRESS']

export function attentionFlags(c: CaseInput): AttentionFlag[] {
  const out: AttentionFlag[] = []
  const add = (f: AttentionFlag) => out.push(f)
  const { now, request: r, booking: b } = c
  const pending = r.proposals.filter((p) => p.status === 'PENDING')

  // ── Request ──
  if (r.status === 'ACTIVE' && r.proposals.length === 0) {
    const age = hoursSince(now, r.createdAt)
    const limit = r.isUrgent ? 1 : 3
    if (age >= limit) add({ code: 'request:no-proposals', severity: age >= limit * 4 || r.isUrgent ? 'warning' : 'info', title: `Solicitud sin propuestas hace ${Math.round(age)} h`, detail: r.direct ? 'Es directa a un socio y no ha respondido.' : 'Ningún socio ha propuesto.', suggest: r.direct ? ['message_partner', 'renotify'] : ['renotify', 'message_client'] })
  }
  if (r.status === 'ACTIVE' && pending.length > 0) {
    const left = (r.expiresAt.getTime() - now.getTime()) / H
    if (left > 0 && left <= 3) add({ code: 'request:expiring-with-proposals', severity: 'info', title: `Vence en ${Math.max(1, Math.round(left))} h con ${pending.length} ${pending.length === 1 ? 'propuesta' : 'propuestas'} sin elegir`, detail: 'El cliente no ha aceptado ninguna.', suggest: ['message_client'] })
  }
  if (r.status === 'EXPIRED' && r.proposals.length > 0 && !b) {
    add({ code: 'request:expired-with-proposals', severity: 'info', title: 'Venció con propuestas que el cliente no eligió', detail: `${r.proposals.length} ${r.proposals.length === 1 ? 'propuesta' : 'propuestas'}. Se puede reactivar 24 h.`, suggest: ['reactivate', 'message_client'] })
  }
  // A price far from the rest of the offers (or ten times the base price when there is little to compare)
  const prices = r.proposals.map((p) => p.price).sort((a, b2) => a - b2)
  if (prices.length) {
    const median = prices[Math.floor(prices.length / 2)]
    const vsOthers = prices.length >= 3 ? r.proposals.filter((p) => p.price > median * 3 || p.price < median / 3) : []
    const vsBase = prices.length < 3 && c.basePrice && c.basePrice > 0 ? r.proposals.filter((p) => p.price > c.basePrice! * 10) : []
    const odd = Array.from(new Set([...vsOthers, ...vsBase]))
    if (odd.length) add({ code: 'request:price-outlier', severity: 'info', title: `${odd.length === 1 ? 'Una propuesta' : `${odd.length} propuestas`} con precio muy distinto al resto`, detail: `Mediana ${money(median)}; ${odd.map((p) => money(p.price)).join(', ')}.`, suggest: ['message_partner'] })
  }

  // ── Booking ──
  if (b) {
    const untilService = (b.at.getTime() - now.getTime()) / H
    if (b.status === 'PENDING') {
      const age = hoursSince(now, b.createdAt)
      if (untilService <= 12 && untilService > -2) add({ code: 'booking:unconfirmed-soon', severity: 'critical', title: `Reserva sin confirmar y el servicio es en ${untilService <= 0 ? 'este momento' : `${Math.max(1, Math.round(untilService))} h`}`, detail: 'El socio no ha confirmado.', suggest: ['message_partner', 'reschedule', 'reopen_to_others'] })
      else if (age >= 12) add({ code: 'booking:unconfirmed', severity: 'warning', title: `Reserva sin confirmar hace ${Math.round(age)} h`, detail: 'El socio no ha confirmado.', suggest: ['message_partner'] })
      if (untilService <= -2) add({ code: 'booking:past-pending', severity: 'warning', title: 'La fecha del servicio pasó y la reserva sigue pendiente', detail: 'Nadie la confirmó ni la reprogramó.', suggest: ['message_both', 'reschedule', 'cancel_booking'] })
    }
    if (b.status === 'CONFIRMED' && untilService <= -2) add({ code: 'booking:no-show-risk', severity: 'critical', title: `Pasaron ${Math.round(-untilService)} h de la hora del servicio y no ha empezado`, detail: 'Posible no llegada del socio o reserva sin actualizar.', suggest: ['message_both', 'review_guarantee', 'reopen_to_others'] })
    if (b.status === 'IN_PROGRESS' && hoursSince(now, b.statusSince) >= 10) add({ code: 'booking:stuck-in-progress', severity: 'warning', title: `En curso hace ${Math.round(hoursSince(now, b.statusSince))} h`, detail: 'El socio no la ha marcado como completada.', suggest: ['message_partner'] })
    if (b.status === 'COMPLETED') {
      const pay = b.payment
      const approved = pay?.status === 'APPROVED'
      if (pay?.confirmationStatus === 'DISPUTED') add({ code: 'payment:disputed', severity: 'critical', title: 'Pago en disputa', detail: 'El cliente y el socio reportaron medios distintos.', suggest: ['review_payment', 'message_both', 'open_case'] })
      else if (!approved && pay?.confirmationStatus === 'CLIENT_REPORTED' && pay.clientReportedAt && hoursSince(now, pay.clientReportedAt) >= 48) add({ code: 'payment:unconfirmed', severity: 'warning', title: `El cliente reportó el pago hace ${Math.round(hoursSince(now, pay.clientReportedAt))} h y el socio no lo confirma`, detail: '', suggest: ['message_partner', 'review_payment'] })
      else if (!approved && pay?.confirmationStatus !== 'CLIENT_REPORTED' && hoursSince(now, b.statusSince) >= 48) add({ code: 'payment:not-reported', severity: 'info', title: `Completada hace ${Math.round(hoursSince(now, b.statusSince) / 24)} días sin pago reportado`, detail: '', suggest: ['message_client'] })
      if (b.afterPhotos === 0 && hoursSince(now, b.statusSince) < 24 * 30) add({ code: 'booking:no-after-photos', severity: 'info', title: 'Completada sin fotos del trabajo', detail: 'Sin respaldo si hay un reclamo de garantía.', suggest: ['message_partner'] })
    }
    if (b.proposalPrice != null && Math.abs(b.totalPrice - b.proposalPrice) > 1) add({ code: 'booking:price-mismatch', severity: 'warning', title: 'El precio de la reserva no coincide con la propuesta aceptada', detail: `Reserva ${money(b.totalPrice)} · propuesta ${money(b.proposalPrice)}.`, suggest: ['review_payment', 'open_case'] })
    if (b.reschedules >= 3) add({ code: 'booking:many-reschedules', severity: 'info', title: `Reprogramada ${b.reschedules} veces`, detail: '', suggest: ['message_both'] })
    if (b.status === 'CANCELLED' && b.cancelledBy === 'partner' && r.status !== 'ACTIVE') add({ code: 'booking:partner-cancelled', severity: 'warning', title: 'El socio canceló y la solicitud no quedó abierta', detail: 'El cliente puede haberse quedado sin servicio.', suggest: ['message_client', 'reactivate'] })
  }
  if (c.guaranteeOpen > 0) add({ code: 'guarantee:open', severity: 'warning', title: `${c.guaranteeOpen === 1 ? 'Reclamo' : `${c.guaranteeOpen} reclamos`} de garantía abierto${c.guaranteeOpen === 1 ? '' : 's'}`, detail: 'Se resuelve en Garantía.', suggest: ['review_guarantee'] })

  // ── Chats ──
  const blocked = c.chats.reduce((a, ch) => a + ch.blockedAttempts, 0)
  if (blocked > 0) add({ code: 'chat:contact-attempts', severity: blocked >= 3 ? 'critical' : 'warning', title: `${blocked} ${blocked === 1 ? 'intento' : 'intentos'} de compartir datos de contacto en el chat`, detail: 'Posible intento de sacar el servicio de la plataforma.', suggest: ['message_both', 'open_case'] })
  const complaint = c.chats.some((ch) => ch.messages.slice(-15).some((m) => (m.side === 'CLIENT' || m.side === 'PARTNER') && COMPLAINT_RE.test(m.content)))
  if (complaint) add({ code: 'chat:complaint', severity: 'warning', title: 'El chat tiene palabras de queja o riesgo', detail: 'Revisar la conversación (no llegó, cobro de más, daño, reembolso…).', suggest: ['message_both', 'open_case', 'review_guarantee'] })
  const live = (r.status === 'ACTIVE' || (b && ACTIVE_BOOKING.includes(b.status)))
  if (live) {
    for (const ch of c.chats) {
      const people = ch.messages.filter((m) => m.side === 'CLIENT' || m.side === 'PARTNER')
      const last = people[people.length - 1]
      if (last && hoursSince(now, last.at) >= 12) {
        add({ code: 'chat:unanswered', severity: 'info', title: `${last.side === 'CLIENT' ? 'El cliente' : 'El socio'} escribió hace ${Math.round(hoursSince(now, last.at))} h y no tiene respuesta`, detail: '', suggest: [last.side === 'CLIENT' ? 'message_partner' : 'message_client'] })
        break
      }
    }
  }

  const order: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b2) => order[a.severity] - order[b2.severity])
}

export const INTERVENTION_LABEL: Record<Intervention, string> = {
  renotify: 'Volver a avisar a los socios',
  reactivate: 'Reactivar la solicitud 24 h',
  message_client: 'Escribirle al cliente',
  message_partner: 'Escribirle al socio',
  message_both: 'Escribir a los dos en el chat',
  reschedule: 'Reprogramar',
  cancel_booking: 'Cancelar la reserva',
  reopen_to_others: 'Cancelar y reabrir a otros socios',
  open_case: 'Abrir un caso de soporte',
  review_guarantee: 'Revisar en Garantía',
  review_payment: 'Revisar el pago',
}

export const worstSeverity = (flags: AttentionFlag[]): AttentionSeverity | null => (flags.find((f) => f.severity === 'critical') ? 'critical' : flags.find((f) => f.severity === 'warning') ? 'warning' : flags.length ? 'info' : null)
