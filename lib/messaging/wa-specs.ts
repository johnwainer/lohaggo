/**
 * The WhatsApp template of each event with its variables, built from plain data (names, service, price,
 * dates). Pure: the callers in lib/messaging/wa-events.ts load the data and send. The catalog code (B3,
 * C10…) is the one in docs/whatsapp-plantillas.md.
 */
import type { WaSpec } from '@/lib/messaging/wa-send'
import { firstName, waDay, waDuration, waMoney, waRef, waTime, waWhen, waZone, weekKey } from '@/lib/messaging/wa-format'

type Entity = { type: string; id: string }
const E = (type: string, id: string): Entity => ({ type, id })

function spec(event: string, candidates: Array<[string, Record<string, string | number>]>, entity: Entity | null, extra: Partial<WaSpec> = {}): WaSpec {
  return {
    event,
    candidates: candidates.map(([name, vars]) => ({ name, vars: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])) })),
    entity,
    ...extra,
  }
}

const DAY = 24 * 3600_000
const client = (n: string | null | undefined) => firstName(n, 'CLIENT')
const partner = (n: string | null | undefined) => firstName(n, 'PARTNER')
/** A cancellation reason as a template variable: one line, short, never empty */
const waReason = (r: string | null | undefined) => (r ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'no indicado'
const admin = (n: string | null | undefined) => firstName(n, 'ADMIN')

export const PAYMENT_METHOD_TEXT: Record<string, string> = { CASH: 'efectivo', DIRECT_TRANSFER: 'transferencia', MERCADOPAGO: 'pago en línea' }

export const DOC_LABEL: Record<string, string> = {
  CEDULA_CIUDADANIA: 'cédula de ciudadanía', CEDULA_EXTRANJERIA: 'cédula de extranjería', PASAPORTE: 'pasaporte', PEP: 'permiso especial de permanencia',
  DIPLOMA_BACHILLERATO: 'diploma de bachillerato', DIPLOMA_TECNICO: 'diploma técnico', DIPLOMA_TECNOLOGO: 'diploma de tecnólogo',
  DIPLOMA_PROFESIONAL: 'diploma profesional', DIPLOMA_POSGRADO: 'diploma de posgrado', CERTIFICADO_CURSO: 'certificado de curso',
  ANTECEDENTES: 'certificado de antecedentes', CAMARA_COMERCIO: 'certificado de cámara de comercio',
}
export const docLabel = (type: string) => DOC_LABEL[type] ?? 'documento'

/** What the client reported, told to the partner (C24). */
export const GUARANTEE_REPORT_TEXT: Record<string, string> = {
  NO_SHOW: 'que no llegaste a la cita',
  BAD_WORK: 'que el trabajo quedó incompleto o distinto a lo acordado',
  DAMAGE: 'un daño a su propiedad durante el servicio',
}
/** Why a strike was recorded (C26). */
export const STRIKE_REASON_TEXT: Record<string, string> = {
  NO_SHOW: 'no llegaste a la cita',
  BAD_WORK: 'el trabajo quedó incompleto o distinto a lo acordado',
  DAMAGE: 'daño a la propiedad del cliente',
}
/** How a guarantee claim was solved, told to the client (B21). */
export const GUARANTEE_REMEDY_TEXT: Record<string, string> = {
  redo: 'el socio corregirá el trabajo sin costo en las próximas 72 horas',
  reassign: 'te asignamos otro socio con prioridad y sin costo',
  cancel_free: 'cancelamos tu reserva sin costo',
  refund: 'registramos tu reembolso y te avisamos cuando se haga efectivo',
  mediation: 'nuestro equipo media con el socio y te contará el resultado',
  reject: 'revisamos el caso y no está cubierto por la garantía',
}
/** Admin-facing label of a claim type (D3). */
export const GUARANTEE_TYPE_TEXT: Record<string, string> = { NO_SHOW: 'el socio no llegó', BAD_WORK: 'trabajo incompleto o distinto', DAMAGE: 'daño a la propiedad' }

type BookingData = { id: string; when: Date; service: string; price?: number; clientName?: string | null; partnerName?: string | null; address?: string | null; city?: string | null }

export const WA = {
  A1: (p: { code: string; codeId: string }) => spec('A1', [['lh_codigo_verificacion', { 1: p.code }]], E('ContactLinkCode', p.codeId)),

  /** Login code of the phone login (no account yet, so the entity is the code) */
  A1Login: (p: { code: string; codeId: string }) => spec('A1', [['lh_codigo_verificacion', { 1: p.code }]], E('PhoneLoginCode', p.codeId)),
  B2: (p: { tokenId: string; name: string; suffix: string }) => spec('B2', [['lh_cliente_acceso_enlace_v2', { 1: client(p.name), 2: p.suffix }]], E('MagicToken', p.tokenId)),
  C2: (p: { tokenId: string; name: string; suffix: string }) => spec('C2', [['lh_socio_acceso_enlace', { 1: partner(p.name), 2: p.suffix }]], E('MagicToken', p.tokenId)),
  /** The city of a waitlist entry opened: promotional (only with the entry's WhatsApp consent) */
  B25: (p: { entryId: string; name: string | null; city: string }) => spec('B25', [['lh_lista_espera_ciudad_abierta', { 1: client(p.name ?? ''), 2: p.city }]], E('CityWaitlist', p.entryId), { marketing: true }),
  /** Refund of a cancelled paid booking changed state (one message per state) */
  B22: (p: { refundId: string; clientName: string; amount: number; service: string; state: string }) =>
    spec('B22', [['lh_cliente_reembolso_estado', { 1: client(p.clientName), 2: waMoney(p.amount), 3: p.service, 4: p.state }]], E('RefundCase', p.refundId), { dedupeKey: `B22:RefundCase:${p.refundId}:${p.state}` }),
  B1: (p: { userId: string; name: string; suffix: string }) => spec('B1', [['lh_cliente_cuenta_creada_v3', { 1: client(p.name), 2: p.suffix }], ['lh_cliente_cuenta_creada', { 1: client(p.name), 2: p.suffix }]], E('User', p.userId)),
  B3: (p: { proposalId: string; clientName: string; service: string; price: number; partnerName: string }) =>
    spec('B3', [['lh_cliente_nueva_propuesta', { 1: client(p.clientName), 2: p.service, 3: waMoney(p.price), 4: partner(p.partnerName), 5: 'dashboard?tab=requests' }]], E('Proposal', p.proposalId)),
  B4: (p: { requestId: string; clientName: string; service: string }) => spec('B4', [['lh_cliente_sin_propuestas_v3', { 1: client(p.clientName), 2: waRef(p.requestId), 3: p.service }], ['lh_cliente_sin_propuestas', { 1: client(p.clientName), 2: p.service }]], E('ServiceRequest', p.requestId)),
  B5: (p: { requestId: string; clientName: string; service: string; expiresAt: Date; proposals: number; now?: Date }) =>
    spec('B5', [['lh_cliente_solicitud_por_vencer_v2', { 1: client(p.clientName), 2: p.service, 3: waDuration(p.expiresAt.getTime() - (p.now ?? new Date()).getTime()), 4: p.proposals, 5: 'dashboard?tab=requests' }]], E('ServiceRequest', p.requestId), { dedupeWindowMs: 20 * 3600_000 }),
  B6: (p: { requestId: string; clientName: string; service: string }) =>
    spec('B6', [['lh_cliente_solicitud_vencida_v3', { 1: client(p.clientName), 2: waRef(p.requestId), 3: p.service, 4: 'dashboard?tab=requests' }], ['lh_cliente_solicitud_vencida', { 1: client(p.clientName), 2: p.service, 3: 'dashboard?tab=requests' }]], E('ServiceRequest', p.requestId), { dedupeWindowMs: 20 * 3600_000 }),
  B7: (p: { requestId: string; clientName: string; service: string }) => spec('B7', [['lh_cliente_solicitud_cancelada_v3', { 1: client(p.clientName), 2: waRef(p.requestId), 3: p.service }], ['lh_cliente_solicitud_cancelada', { 1: client(p.clientName), 2: p.service }]], E('ServiceRequest', p.requestId)),
  B8: (b: BookingData) => spec('B8', [['lh_cliente_reserva_pendiente', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service, 4: waWhen(b.when) }]], E('Booking', b.id)),
  B9: (b: BookingData) => spec('B9', [['lh_cliente_socio_no_disponible', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service, 4: 'dashboard?tab=requests' }]], E('Booking', b.id)),
  B10: (b: BookingData & { pending: boolean }) =>
    spec('B10', [['lh_cliente_reserva_reprogramada', { 1: client(b.clientName), 2: b.service, 3: waWhen(b.when), 4: b.pending ? 'pendiente de confirmar por el socio' : 'confirmada' }]], E('Booking', b.id), { dedupeKey: `B10:Booking:${b.id}:${b.when.toISOString()}` }),
  B11: (b: BookingData) => spec('B11', [['lh_cliente_recordatorio_manana_v2', { 1: client(b.clientName), 2: b.service, 3: waTime(b.when), 4: partner(b.partnerName) }]], E('Booking', b.id), { dedupeKey: `B11:Booking:${b.id}:${b.when.toISOString()}` }),
  B12: (b: BookingData) => spec('B12', [['lh_cliente_servicio_pronto_v2', { 1: client(b.clientName), 2: b.service, 3: waTime(b.when), 4: partner(b.partnerName) }]], E('Booking', b.id), { dedupeKey: `B12:Booking:${b.id}:${b.when.toISOString()}` }),
  B13: (b: BookingData) => spec('B13', [['lh_cliente_servicio_iniciado', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service }]], E('Booking', b.id)),
  B14: (b: BookingData) => spec('B14', [['lh_cliente_servicio_terminado_pago', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service, 4: waMoney(b.price) }]], E('Booking', b.id)),
  B15: (b: BookingData) => spec('B15', [['lh_cliente_pago_pendiente', { 1: client(b.clientName), 2: b.service, 3: partner(b.partnerName) }]], E('Booking', b.id)),
  B16: (b: BookingData) => spec('B16', [['lh_cliente_pago_confirmado_v2', { 1: client(b.clientName), 2: partner(b.partnerName), 3: waMoney(b.price), 4: b.service }]], E('Booking', b.id)),
  B17: (b: BookingData & { reason: string; at: Date }) =>
    spec('B17', [['lh_cliente_pago_rechazado_v2', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service, 4: b.reason }]], E('Booking', b.id), { dedupeKey: `B17:Booking:${b.id}:${b.at.getTime()}` }),
  B18: (b: BookingData) => spec('B18', [['lh_cliente_recordatorio_calificar_v2', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service }]], E('Booking', b.id)),
  B19: (b: BookingData) => spec('B19', [
    ['lh_cliente_reserva_cancelada_socio_v3', { 1: client(b.clientName), 2: waRef(b.id), 3: b.service, 4: waDay(b.when) }],
    ['lh_cliente_reserva_cancelada_socio', { 1: client(b.clientName), 2: partner(b.partnerName), 3: b.service, 4: waDay(b.when) }],
  ], E('Booking', b.id)),
  B20: (p: { claimId: string; clientName: string; service: string }) => spec('B20', [['lh_cliente_garantia_recibida', { 1: client(p.clientName), 2: waRef(p.claimId), 3: p.service }]], E('GuaranteeClaim', p.claimId)),
  B21: (p: { claimId: string; clientName: string; remedy: string }) =>
    spec('B21', [['lh_cliente_garantia_resuelta', { 1: client(p.clientName), 2: waRef(p.claimId), 3: GUARANTEE_REMEDY_TEXT[p.remedy] ?? 'el equipo lo resolvió' }]], E('GuaranteeClaim', p.claimId)),
  B23: (p: { userId: string; clientName: string; service: string; partnerName: string; bookingId: string }) =>
    spec('B23', [['lh_cliente_volver_a_pedir', { 1: client(p.clientName), 2: p.service.toLowerCase(), 3: partner(p.partnerName) }]], E('Booking', p.bookingId), { marketing: true, dedupeKey: `B23:User:${p.userId}`, dedupeWindowMs: 60 * DAY }),
  B24: (p: { conversationId: string; name: string | null; service: string }) =>
    spec('B24', [['lh_cliente_solicitud_sin_terminar', { 1: client(p.name), 2: p.service }]], E('Conversation', p.conversationId), { marketing: true, dedupeWindowMs: 14 * DAY }),

  /** The platform transferred the partner's net amount of a paid booking */
  C28: (p: { payoutId: string; partnerName: string; amount: number; service: string; last4: string }) =>
    spec('C28', [['lh_socio_pago_plataforma_enviado', { 1: partner(p.partnerName), 2: waMoney(p.amount), 3: p.service, 4: p.last4 }]], E('Payout', p.payoutId)),
  C1: (p: { userId: string; name: string; suffix: string }) => spec('C1', [['lh_socio_cuenta_creada', { 1: partner(p.name), 2: p.suffix }]], E('User', p.userId)),
  /** `day` 1/3/7 for the automatic reminders; a string tag (e.g. «m20261007») for one sent by hand from the admin */
  C3: (p: { userId: string; name: string; day: 1 | 3 | 7 | string }) =>
    spec('C3', [['lh_socio_falta_documento', { 1: partner(p.name), 2: 'partner/verification' }]], E('User', p.userId), { dedupeKey: `C3:User:${p.userId}:d${p.day}` }),
  /** Invite a verified partner to share their public profile (at most once a month) */
  C33: (p: { partnerId: string; name: string; slug: string }) =>
    spec('C33', [['lh_socio_compartir_perfil', { 1: partner(p.name), 2: `pro/${p.slug}?utm_source=whatsapp&utm_medium=socio&utm_campaign=compartir_perfil` }]], E('PartnerProfile', p.partnerId), { marketing: true, dedupeKey: `C33:PartnerProfile:${p.partnerId}`, dedupeWindowMs: 30 * DAY }),
  C4: (p: { documentId: string; name: string; type: string }) => spec('C4', [['lh_socio_documento_recibido', { 1: partner(p.name), 2: docLabel(p.type) }]], E('VerificationDocument', p.documentId)),
  C5: (p: { documentId: string; name: string; type: string }) => spec('C5', [['lh_socio_documento_aprobado', { 1: partner(p.name), 2: docLabel(p.type) }]], E('VerificationDocument', p.documentId)),
  C6: (p: { documentId: string; name: string; type: string; reason: string }) =>
    spec('C6', [['lh_socio_documento_rechazado_v2', { 1: partner(p.name), 2: docLabel(p.type), 3: p.reason || 'no se pudo validar', 4: 'partner/verification' }]], E('VerificationDocument', p.documentId)),
  C7: (p: { partnerId: string; name: string; services: string[] }) =>
    spec('C7', [['lh_socio_perfil_activo_v3', { 1: partner(p.name), 2: waRef(p.partnerId) }], ['lh_socio_perfil_activo', { 1: partner(p.name), 2: servicesText(p.services) }]], E('PartnerProfile', p.partnerId)),
  C8: (p: { partnerId: string; name: string }) => spec('C8', [
    ['lh_socio_sin_servicios_v3', { 1: partner(p.name), 2: 'partner/services' }],
    ['lh_socio_sin_servicios_v2', { 1: partner(p.name), 2: 'partner/services' }],
  ], E('PartnerProfile', p.partnerId)),
  C9: (p: { partnerId: string; name: string; bookingId: string }) => spec('C9', [
    ['lh_socio_falta_cuenta_bancaria_v3', { 1: partner(p.name), 2: waRef(p.bookingId), 3: 'partner/bank-accounts' }],
    ['lh_socio_falta_cuenta_bancaria', { 1: partner(p.name), 2: 'partner/bank-accounts' }],
  ], E('PartnerProfile', p.partnerId)),
  /** New request for a partner; `direct` when the client chose this partner (C11). */
  C10: (p: { requestId: string; partnerName: string; service: string; address: string | null; city: string; when: string; direct: boolean; round?: number }) => {
    const zone = waZone(p.address, p.city)
    const url = 'partner?tab=my-requests'
    const name = partner(p.partnerName)
    const generic: [string, Record<string, string>] = ['lh_socio_nueva_solicitud_v2', { 1: name, 2: p.service, 3: zone, 4: p.when, 5: url }]
    const extra = { dedupeKey: `${p.direct ? 'C11' : 'C10'}:ServiceRequest:${p.requestId}:${p.round ?? 0}` }
    if (p.direct) {
      return spec('C11', [
        ['lh_socio_solicitud_directa_v3', { 1: name, 2: waRef(p.requestId), 3: p.service, 4: zone, 5: url }],
        ['lh_socio_solicitud_directa', { 1: name, 2: p.service, 3: zone, 4: url }],
        generic,
      ], E('ServiceRequest', p.requestId), extra)
    }
    return spec('C10', [['lh_socio_nueva_solicitud_v3', { 1: name, 2: waRef(p.requestId), 3: p.service, 4: zone, 5: url }], generic], E('ServiceRequest', p.requestId), extra)
  },
  C12: (b: BookingData) => spec('C12', [['lh_socio_propuesta_aceptada_v2', { 1: partner(b.partnerName), 2: client(b.clientName), 3: b.service, 4: waWhen(b.when), 5: 'partner?tab=bookings' }]], E('Booking', b.id)),
  C13: (p: { proposalId: string; partnerName: string; service: string }) => spec('C13', [['lh_socio_propuesta_no_elegida_v3', { 1: partner(p.partnerName), 2: waRef(p.proposalId), 3: p.service }], ['lh_socio_propuesta_no_elegida', { 1: partner(p.partnerName), 2: p.service }]], E('Proposal', p.proposalId)),
  C14: (b: BookingData) => spec('C14', [['lh_socio_confirmar_reserva', { 1: partner(b.partnerName), 2: b.service, 3: waWhen(b.when) }]], E('Booking', b.id), { dedupeKey: `C14:Booking:${b.id}:${b.when.toISOString()}` }),
  C15: (b: BookingData) => spec('C15', [['lh_socio_reserva_reprogramada', { 1: partner(b.partnerName), 2: b.service, 3: waWhen(b.when) }]], E('Booking', b.id), { dedupeKey: `C15:Booking:${b.id}:${b.when.toISOString()}` }),
  /** The LoHaggo team cancelled: its own wording (never «el cliente canceló»), with the reason both sides see */
  B28: (b: BookingData & { reason: string }) => spec('B28', [['lh_cliente_reserva_cancelada_equipo', { 1: client(b.clientName), 2: b.service, 3: waDay(b.when), 4: waReason(b.reason), 5: 'dashboard?tab=requests' }], ['reserva_cancelada', { 1: client(b.clientName), 2: b.service }]], E('Booking', b.id)),
  C32: (b: BookingData & { reason: string }) => spec('C32', [['lh_socio_reserva_cancelada_equipo', { 1: partner(b.partnerName), 2: b.service, 3: waDay(b.when), 4: waReason(b.reason) }]], E('Booking', b.id)),
  C16: (b: BookingData) => spec('C16', [['lh_socio_reserva_cancelada', { 1: partner(b.partnerName), 2: b.service, 3: waDay(b.when) }]], E('Booking', b.id)),
  C17: (b: BookingData) => spec('C17', [['lh_socio_recordatorio_manana', { 1: partner(b.partnerName), 2: waTime(b.when), 3: b.service, 4: waZone(b.address, b.city), 5: 'partner?tab=bookings' }]], E('Booking', b.id), { dedupeKey: `C17:Booking:${b.id}:${b.when.toISOString()}` }),
  C18: (b: BookingData) => spec('C18', [['lh_socio_servicio_pronto', { 1: partner(b.partnerName), 2: b.service, 3: waTime(b.when) }]], E('Booking', b.id), { dedupeKey: `C18:Booking:${b.id}:${b.when.toISOString()}` }),
  C19: (b: BookingData) => spec('C19', [['lh_socio_marcar_terminado', { 1: partner(b.partnerName), 2: b.service }]], E('Booking', b.id)),
  C20: (b: BookingData & { method: string; at: Date }) =>
    spec('C20', [['lh_socio_pago_reportado_v2', { 1: partner(b.partnerName), 2: client(b.clientName), 3: waMoney(b.price), 4: PAYMENT_METHOD_TEXT[b.method] ?? 'efectivo', 5: b.service }]], E('Booking', b.id), { dedupeKey: `C20:Booking:${b.id}:${b.at.getTime()}` }),
  C21: (b: BookingData & { reminder: number }) =>
    spec('C21', [['lh_socio_pago_por_confirmar_v2', { 1: partner(b.partnerName), 2: waMoney(b.price), 3: b.service, 4: client(b.clientName) }]], E('Booking', b.id), { dedupeKey: `C21:Booking:${b.id}:${b.reminder}` }),
  C22: (b: BookingData) => spec('C22', [['lh_socio_servicio_completado_v3', { 1: partner(b.partnerName), 2: waRef(b.id), 3: b.service }], ['lh_socio_servicio_completado_v2', { 1: partner(b.partnerName), 2: b.service, 3: client(b.clientName) }]], E('Booking', b.id)),
  C23: (p: { bookingId: string; partnerName: string; clientName: string; rating: number; service: string }) =>
    spec('C23', [['lh_socio_calificacion_recibida_v2', { 1: partner(p.partnerName), 2: client(p.clientName), 3: p.rating, 4: p.service }]], E('Booking', p.bookingId)),
  C24: (p: { claimId: string; partnerName: string; service: string; type: string }) =>
    spec('C24', [['lh_socio_reclamo_garantia', { 1: partner(p.partnerName), 2: p.service, 3: GUARANTEE_REPORT_TEXT[p.type] ?? 'un problema con el servicio' }]], E('GuaranteeClaim', p.claimId)),
  C25: (p: { claimId: string; partnerName: string; service: string }) => spec('C25', [['lh_socio_correccion_programada', { 1: partner(p.partnerName), 2: p.service }]], E('GuaranteeClaim', p.claimId)),
  C26: (p: { claimId: string; partnerName: string; service: string; type: string }) =>
    spec('C26', [['lh_socio_falta_registrada', { 1: partner(p.partnerName), 2: p.service, 3: STRIKE_REASON_TEXT[p.type] ?? 'incumplimiento del servicio' }]], E('GuaranteeClaim', p.claimId)),
  C27: (p: { claimId: string; partnerName: string; strikes: number }) =>
    spec('C27', [['lh_socio_perfil_pausado', { 1: partner(p.partnerName), 2: `${p.strikes} faltas en los últimos 90 días` }]], E('GuaranteeClaim', p.claimId)),
  C29: (p: { partnerId: string; partnerName: string; service: string; city: string; now?: Date }) =>
    spec('C29', [['lh_socio_hay_demanda', { 1: partner(p.partnerName), 2: p.service, 3: p.city }]], E('PartnerProfile', p.partnerId), { marketing: true, dedupeKey: `C29:PartnerProfile:${p.partnerId}:${weekKey(p.now)}` }),
  C30: (p: { partnerId: string; partnerName: string; service: string }) =>
    spec('C30', [['lh_socio_sin_actividad', { 1: partner(p.partnerName), 2: p.service, 3: 'partner?tab=my-requests' }]], E('PartnerProfile', p.partnerId), { marketing: true, dedupeWindowMs: 30 * DAY }),

  B26: (p: { chatId: string; clientName: string; partnerName: string; service: string; ref: string }) =>
    spec('B26', [['lh_cliente_mensaje_socio', { 1: client(p.clientName), 2: partner(p.partnerName), 3: p.service, 4: `#${p.ref}`, 5: 'dashboard?tab=bookings' }]], E('Chat', p.chatId), { dedupeKey: `B26:Chat:${p.chatId}`, dedupeWindowMs: 30 * 60_000 }),
  /** A note from the LoHaggo team in the chat of a service (client or partner); one per message */
  B27: (p: { messageId: string; name: string; side: 'CLIENT' | 'PARTNER'; service: string; ref: string }) =>
    spec('B27', [['lh_soporte_mensaje_servicio', { 1: p.side === 'CLIENT' ? client(p.name) : partner(p.name), 2: p.service, 3: `#${p.ref}`, 4: p.side === 'CLIENT' ? 'dashboard?tab=bookings' : 'partner?tab=bookings' }]], E('ChatMessage', p.messageId)),
  C31: (p: { chatId: string; partnerName: string; clientName: string; service: string; ref: string }) =>
    spec('C31', [['lh_socio_mensaje_cliente', { 1: partner(p.partnerName), 2: client(p.clientName), 3: p.service, 4: `#${p.ref}`, 5: 'partner?tab=bookings' }]], E('Chat', p.chatId), { dedupeKey: `C31:Chat:${p.chatId}`, dedupeWindowMs: 30 * 60_000 }),

  D1: (p: { adminName: string; conversationId: string; channel: string; reason: string; at: Date }) =>
    spec('D1', [['lh_admin_conversacion_traspasada', { 1: admin(p.adminName), 2: CHANNEL_TEXT[p.channel] ?? p.channel, 3: p.reason, 4: `admin/inbox?c=${p.conversationId}` }]], E('Conversation', p.conversationId), { dedupeWindowMs: 2 * 3600_000 }),
  D2: (p: { adminName: string; actionId: string; conversationId: string; summary: string }) =>
    spec('D2', [['lh_admin_accion_por_aprobar', { 1: admin(p.adminName), 2: p.summary, 3: `admin/inbox?c=${p.conversationId}` }]], E('AiAgentAction', p.actionId)),
  D3: (p: { adminName: string; claimId: string; type: string; service: string }) =>
    spec('D3', [['lh_admin_garantia_nueva', { 1: admin(p.adminName), 2: waRef(p.claimId), 3: GUARANTEE_TYPE_TEXT[p.type] ?? 'problema con el servicio', 4: p.service, 5: 'admin/guarantee' }]], E('GuaranteeClaim', p.claimId)),
  D4: (p: { adminName: string; claimId: string; dueAt: Date; now?: Date }) => {
    const left = p.dueAt.getTime() - (p.now ?? new Date()).getTime()
    const overdue = left <= 0
    return spec('D4', [['lh_admin_garantia_por_vencer', { 1: admin(p.adminName), 2: waRef(p.claimId), 3: overdue ? `venció hace ${waDuration(-left)}` : `vence en ${waDuration(left)}`, 4: 'admin/guarantee' }]], E('GuaranteeClaim', p.claimId), { dedupeKey: `D4:GuaranteeClaim:${p.claimId}:${overdue ? 'overdue' : 'soon'}` })
  },
  D5: (p: { adminName: string; bookingId: string; service: string; clientName: string; partnerName: string; at: Date }) =>
    spec('D5', [['lh_admin_disputa_pago', { 1: admin(p.adminName), 2: p.service, 3: client(p.clientName), 4: partner(p.partnerName), 5: 'admin?section=payments' }]], E('Booking', p.bookingId), { dedupeKey: `D5:Booking:${p.bookingId}:${p.at.getTime()}` }),
  D6: (b: BookingData & { adminName: string }) =>
    spec('D6', [['lh_admin_reserva_sin_confirmar', { 1: admin(b.adminName), 2: b.service, 3: waDay(b.when), 4: partner(b.partnerName), 5: 'admin?section=bookings' }]], E('Booking', b.id)),
  D7: (p: { adminName: string; requestId: string; service: string; address: string | null; city: string; hours: number }) =>
    spec('D7', [['lh_admin_solicitud_sin_socios_v3', { 1: admin(p.adminName), 2: waRef(p.requestId), 3: p.service, 4: waZone(p.address, p.city), 5: p.hours, 6: 'admin/service-requests' }], ['lh_admin_solicitud_sin_socios', { 1: admin(p.adminName), 2: p.service, 3: waZone(p.address, p.city), 4: p.hours, 5: 'admin/service-requests' }]], E('ServiceRequest', p.requestId)),
  D8: (p: { adminName: string; pending: number; oldestMs: number; dateKey: string }) =>
    spec('D8', [['lh_admin_documentos_por_revisar', { 1: admin(p.adminName), 2: p.pending, 3: waDuration(p.oldestMs), 4: 'admin/documents' }]], null, { dedupeKey: `D8:${p.dateKey}` }),
  D9: (p: { adminName: string; incidentId: string; title: string }) =>
    spec('D9', [['lh_admin_incidente_critico', { 1: admin(p.adminName), 2: p.title, 3: 'admin/system' }]], E('AdminIncident', p.incidentId)),
  D10: (p: { adminName: string; requests: number; bookings: number; sales: number; findings: number; dateKey: string }) =>
    spec('D10', [['lh_admin_resumen_diario', { 1: admin(p.adminName), 2: p.requests, 3: p.bookings, 4: waMoney(p.sales), 5: p.findings, 6: 'admin/haggo' }]], null, { dedupeKey: `D10:${p.dateKey}` }),

  /** Approved legacy templates still in use (not in the catalog). */
  reservaConfirmada: (b: BookingData) => spec('reserva_confirmada', [['reserva_confirmada_cliente', { 1: client(b.clientName), 2: b.service, 3: waWhen(b.when) }]], E('Booking', b.id), { dedupeKey: `reserva_confirmada:Booking:${b.id}:${b.when.toISOString()}` }),
  reservaCancelada: (b: BookingData) => spec('reserva_cancelada', [['reserva_cancelada', { 1: client(b.clientName), 2: b.service }]], E('Booking', b.id)),
  solicitudEnviada: (p: { requestId: string; clientName: string; service: string }) => spec('solicitud_enviada', [['solicitud_enviada_cliente', { 1: client(p.clientName), 2: p.service }]], E('ServiceRequest', p.requestId)),
}

export const CHANNEL_TEXT: Record<string, string> = { WHATSAPP: 'WhatsApp', SMS: 'SMS', MESSENGER: 'Messenger', INSTAGRAM: 'Instagram', EMAIL: 'correo', FACEBOOK_COMMENT: 'comentarios de Facebook', INSTAGRAM_COMMENT: 'comentarios de Instagram' }

/** «Plomería», «Plomería y Pintura», «Plomería, Pintura y Electricidad», or «tus servicios». */
export function servicesText(names: string[]): string {
  const list = names.filter(Boolean).slice(0, 3)
  if (!list.length) return 'tus servicios'
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`
}
