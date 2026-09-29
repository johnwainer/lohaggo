/**
 * Haggo stepping into a service request, always proposed and approved by a person: write in the chat as
 * LoHaggo support, reactivate the request, reschedule or cancel the booking (optionally reopening it to
 * other partners) and open a support case. Executed through lib/admin/interventions.ts as the approver.
 */
import { prisma } from '@/lib/prisma'
import { bookingWhen } from '@/lib/bookings/when'
import { canTransition } from '@/lib/bookings/transitions'
import { isRequestExpired } from '@/lib/service-requests/ops'
import { adminBookingStatus, adminReactivate, adminReschedule, openSupportCase, postSupportMessage, type AdminActor } from '@/lib/admin/interventions'
import { ID, done, parseBool, parseText, requireObj, when, type ExecCtx, type HaggoActionDef } from '@/lib/haggo/actions/types'

const asAdmin = (ctx: ExecCtx): AdminActor => ({ userId: ctx.approverId, role: 'ADMIN', email: ctx.approverEmail })
const TO_LABEL = { client: 'al cliente', partner: 'al socio', both: 'al cliente y al socio' } as const
type To = keyof typeof TO_LABEL

const parseRef = (r: Record<string, unknown>, key: string, e: string[]) => {
  const v = r[key]
  if (typeof v === 'string' && ID.test(v)) return v
  e.push(`${key}: identificador inválido`)
  return ''
}

type MessageParams = { requestId: string; proposalId: string; to: To; text: string }

const messageChat: HaggoActionDef<MessageParams> = {
  id: 'requests.message_chat',
  domain: 'operations',
  risk: 'high',
  label: 'Escribir en el chat de una solicitud como Soporte LoHaggo',
  hint: 'Deja un mensaje de Soporte LoHaggo en el chat de una propuesta (lo ven en la app y les llega aviso por WhatsApp): recordar confirmar o reportar el pago, pedir que no compartan datos de contacto, mediar en un desacuerdo, avisar de un cambio. El texto es corto, amable y concreto; nunca prometas dinero ni culpes a nadie. Usa los ids de solicitud_detalle.',
  schema: { type: 'object', properties: { requestId: { type: 'string' }, proposalId: { type: 'string' }, to: { type: 'string', enum: ['client', 'partner', 'both'] }, text: { type: 'string', description: 'El mensaje, 10 a 600 caracteres' } }, required: ['requestId', 'proposalId', 'to', 'text'] },
  sideEffects: ['notifies_customers', 'notifies_partners'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const to = (['client', 'partner', 'both'] as To[]).includes(r.to as To) ? (r.to as To) : (e.push('to: client, partner o both'), 'both' as To)
    return done(e, { requestId: parseRef(r, 'requestId', e), proposalId: parseRef(r, 'proposalId', e), to, text: parseText(r, 'text', e, { min: 10, max: 600 }) ?? '' })
  },
  describe: (p) => `Escribir ${TO_LABEL[p.to]} en el chat: «${p.text.slice(0, 80)}${p.text.length > 80 ? '…' : ''}»`,
  entity: (p) => ({ type: 'ServiceRequest', id: p.requestId }),
  preconditions: async (p) => {
    const prop = await prisma.proposal.findUnique({ where: { id: p.proposalId }, select: { serviceRequestId: true, partner: { select: { user: { select: { name: true } } } }, serviceRequest: { select: { user: { select: { name: true } }, service: { select: { name: true } } } } } })
    if (!prop || prop.serviceRequestId !== p.requestId) return { ok: false, reason: 'Esa propuesta no es de esa solicitud' }
    return { ok: true, before: { service: prop.serviceRequest.service.name, client: prop.serviceRequest.user.name, partner: prop.partner.user.name } }
  },
  preview: async (p, before) => {
    const b = before as { service: string; client: string; partner: string }
    return { summary: `${b.service}: mensaje de Soporte ${TO_LABEL[p.to]} (${p.to === 'partner' ? b.partner : p.to === 'client' ? b.client : `${b.client} y ${b.partner}`})`, diff: [{ field: 'Mensaje', from: '—', to: p.text }] }
  },
  execute: async (p, ctx) => {
    const r = await postSupportMessage(asAdmin(ctx), { requestId: p.requestId, proposalId: p.proposalId, text: p.text, to: p.to })
    return { after: { messageId: r.messageId }, result: `Mensaje de Soporte enviado ${TO_LABEL[p.to]}` }
  },
}

const reactivate: HaggoActionDef<{ requestId: string }> = {
  id: 'requests.reactivate',
  domain: 'operations',
  risk: 'medium',
  label: 'Reactivar una solicitud vencida por 24 h',
  hint: 'Vuelve a abrir por 24 horas una solicitud vencida (recupera las propuestas que tenía y avisa a los socios). Para solicitudes que vencieron con propuestas sin elegir o cuando el socio canceló.',
  schema: { type: 'object', properties: { requestId: { type: 'string' } }, required: ['requestId'] },
  sideEffects: ['notifies_partners'],
  parse: (raw) => { const r = requireObj(raw); if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; const e: string[] = []; return done(e, { requestId: parseRef(r, 'requestId', e) }) },
  describe: () => 'Reactivar la solicitud por 24 horas',
  entity: (p) => ({ type: 'ServiceRequest', id: p.requestId }),
  preconditions: async (p) => {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: p.requestId }, select: { status: true, expiresAt: true, service: { select: { name: true } } } })
    if (!sr) return { ok: false, reason: 'La solicitud no existe' }
    if (!isRequestExpired(sr)) return { ok: false, reason: 'La solicitud no está vencida' }
    return { ok: true, before: { service: sr.service.name, status: sr.status } }
  },
  preview: async (_p, before) => ({ summary: `${(before as { service: string }).service}: activa otra vez 24 h y los socios reciben el aviso`, diff: [{ field: 'Estado', from: 'vencida', to: 'activa 24 h' }] }),
  execute: async (p, ctx) => {
    const r = await adminReactivate(asAdmin(ctx), p.requestId)
    return { after: { expiresAt: r.expiresAt }, result: `Reactivada hasta ${when(r.expiresAt)}` }
  },
}

type RescheduleParams = { requestId: string; bookingId: string; date: string; time: string }

const reschedule: HaggoActionDef<RescheduleParams> = {
  id: 'requests.reschedule_booking',
  domain: 'operations',
  risk: 'high',
  label: 'Reprogramar la reserva de una solicitud',
  hint: 'Mueve la reserva a otro día y hora que el cliente y el socio ya acordaron en el chat (léelo en solicitud_detalle). Nunca inventes la fecha.',
  schema: { type: 'object', properties: { requestId: { type: 'string' }, bookingId: { type: 'string' }, date: { type: 'string', description: 'AAAA-MM-DD' }, time: { type: 'string', description: 'HH:mm' } }, required: ['requestId', 'bookingId', 'date', 'time'] },
  sideEffects: ['notifies_customers', 'notifies_partners'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : (e.push('date: AAAA-MM-DD'), '')
    const time = typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : (e.push('time: HH:mm'), '')
    return done(e, { requestId: parseRef(r, 'requestId', e), bookingId: parseRef(r, 'bookingId', e), date, time })
  },
  describe: (p) => `Reprogramar la reserva para el ${p.date} a las ${p.time}`,
  entity: (p) => ({ type: 'Booking', id: p.bookingId }),
  preconditions: async (p) => {
    const b = await prisma.booking.findUnique({ where: { id: p.bookingId }, select: { status: true, scheduledDate: true, scheduledTime: true, proposal: { select: { serviceRequestId: true } } } })
    if (!b || b.proposal?.serviceRequestId !== p.requestId) return { ok: false, reason: 'Esa reserva no es de esa solicitud' }
    if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return { ok: false, reason: 'Solo se reprograman reservas pendientes o confirmadas' }
    return { ok: true, before: { at: bookingWhen(b).toISOString() } }
  },
  preview: async (p, before) => ({ summary: 'Cliente y socio reciben el aviso del cambio', diff: [{ field: 'Fecha del servicio', from: when((before as { at: string }).at), to: `${p.date} ${p.time}` }] }),
  execute: async (p, ctx) => {
    await adminReschedule(asAdmin(ctx), p)
    return { after: null, result: `Reprogramada para el ${p.date} a las ${p.time}` }
  },
}

type CancelParams = { requestId: string; bookingId: string; reason: string; reopen: boolean }

const cancelBooking: HaggoActionDef<CancelParams> = {
  id: 'requests.cancel_booking',
  domain: 'operations',
  risk: 'high',
  label: 'Cancelar la reserva de una solicitud (y reabrirla a otros socios)',
  hint: 'Cancela la reserva con un motivo que ven el cliente y el socio. Con reopen: true la solicitud vuelve a estar activa 24 h para otros socios (para un socio que no llega o no responde). Si hubo pago en línea se abre el reembolso según la política.',
  schema: { type: 'object', properties: { requestId: { type: 'string' }, bookingId: { type: 'string' }, reason: { type: 'string' }, reopen: { type: 'boolean' } }, required: ['requestId', 'bookingId', 'reason', 'reopen'] },
  sideEffects: ['notifies_customers', 'notifies_partners', 'changes_money'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    return done(e, { requestId: parseRef(r, 'requestId', e), bookingId: parseRef(r, 'bookingId', e), reason: parseText(r, 'reason', e, { min: 10, max: 400 }) ?? '', reopen: parseBool(r, 'reopen', e) })
  },
  describe: (p) => `Cancelar la reserva${p.reopen ? ' y reabrir la solicitud a otros socios' : ''}: «${p.reason.slice(0, 80)}»`,
  entity: (p) => ({ type: 'Booking', id: p.bookingId }),
  preconditions: async (p) => {
    const b = await prisma.booking.findUnique({ where: { id: p.bookingId }, select: { status: true, proposal: { select: { serviceRequestId: true } }, service: { select: { name: true } } } })
    if (!b || b.proposal?.serviceRequestId !== p.requestId) return { ok: false, reason: 'Esa reserva no es de esa solicitud' }
    const check = canTransition(b.status, 'CANCELLED', 'admin')
    if (!check.ok) return { ok: false, reason: check.reason }
    return { ok: true, before: { status: b.status, service: b.service.name } }
  },
  preview: async (p, before) => {
    const b = before as { status: string; service: string }
    return { summary: `${b.service}: reserva cancelada${p.reopen ? '; la solicitud se abre 24 h a otros socios' : ''}`, diff: [{ field: 'Reserva', from: b.status, to: 'CANCELLED' }] }
  },
  execute: async (p, ctx) => {
    await adminBookingStatus(asAdmin(ctx), { requestId: p.requestId, bookingId: p.bookingId, status: 'CANCELLED', reason: p.reason, reopen: p.reopen })
    return { after: null, result: `Reserva cancelada${p.reopen ? ' y solicitud reabierta' : ''}` }
  },
}

type CaseParams = { requestId: string; subject: string; description: string }

const openCase: HaggoActionDef<CaseParams> = {
  id: 'requests.open_case',
  domain: 'operations',
  risk: 'low',
  label: 'Abrir un caso de soporte sobre una solicitud',
  hint: 'Crea un caso en Casos e incidentes para que una persona revise una solicitud (queja en el chat, intentos de sacar el servicio de la plataforma, precio que no cuadra, pago en disputa). No avisa a nadie fuera del equipo.',
  schema: { type: 'object', properties: { requestId: { type: 'string' }, subject: { type: 'string' }, description: { type: 'string' } }, required: ['requestId', 'subject', 'description'] },
  sideEffects: [],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    return done(e, { requestId: parseRef(r, 'requestId', e), subject: parseText(r, 'subject', e, { min: 5, max: 160 }) ?? '', description: parseText(r, 'description', e, { min: 10, max: 2000 }) ?? '' })
  },
  describe: (p) => `Abrir caso: «${p.subject}»`,
  entity: (p) => ({ type: 'ServiceRequest', id: p.requestId }),
  preconditions: async (p) => {
    const open = await prisma.adminSupportCase.count({ where: { requestId: p.requestId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0)
    if (open) return { ok: false, reason: 'Ya hay un caso abierto sobre esa solicitud' }
    const sr = await prisma.serviceRequest.findUnique({ where: { id: p.requestId }, select: { id: true } })
    return sr ? { ok: true, before: null } : { ok: false, reason: 'La solicitud no existe' }
  },
  preview: async (p) => ({ summary: `Caso para el equipo: ${p.subject}`, diff: [] }),
  execute: async (p, ctx) => {
    const r = await openSupportCase(asAdmin(ctx), p)
    return { after: { caseId: r.caseId }, result: 'Caso abierto en Casos e incidentes' }
  },
}

export const REQUEST_ACTIONS = [messageChat, reactivate, reschedule, cancelBooking, openCase] as unknown as HaggoActionDef[]
