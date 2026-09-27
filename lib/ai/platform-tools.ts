/**
 * Platform tools: what an inbox AI agent can do on the linked person's account from a chat (ask for a
 * service, accept a proposal, report a payment, send a proposal as a partner…). Every write goes through
 * the same lib/*\/ops.ts function the app routes call, with origin = chat, so the records are identical to
 * the app's plus the origin stamp. Ids never come from the person's text: tools take the short reference a
 * read tool printed and resolve it inside the person's own records.
 *
 * Flow of a write in autopilot: first call → proposal recorded and the agent asks the person; the yes →
 * `confirmado: true` within the window → runs. Copilot: the call becomes an action a person approves from
 * the inbox. Playground: nothing is written.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { BookingStatus, City, DocumentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CatalogEntry, ToolContext } from '@/lib/ai/tools'
import { askConfirmationText, awaitingApprovalText, confirmationGate, cop, dryRunText, isClearYes, LIMIT_REACHED_TEXT, MISMATCH_CONFIRMATION_TEXT, sameActionCore, sameActionInput, shortId, STALE_CONFIRMATION_TEXT } from '@/lib/ai/actions-core'
import { expireStaleProposals, latestProposed, leaveTrail, overDailyLimit, recordAction, settleAction } from '@/lib/ai/actions'
import { chatOrigin, OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { fmtDate } from '@/lib/ai/platform-data'
import { cancelServiceRequest, createServiceRequest, isRequestExpired, listClientRequests, listOpenRequestsForPartner, partnerAvailabilitySummary, partnersForService, reactivateServiceRequest, requestSummaryForChat } from '@/lib/service-requests/ops'
import { acceptProposal, createProposal, listProposalsForClient, proposalSummaryForChat } from '@/lib/proposals/ops'
import { bookingsFor, bookingSummaryForChat, bookingWhen, rescheduleBooking, transitionBooking } from '@/lib/bookings/ops'
import { confirmPartnerPayment, mercadoPagoLinkFor, paymentSummaryForChat, rejectPartnerPayment, reportClientPayment } from '@/lib/payments/ops'
import { leaveReview } from '@/lib/reviews/ops'
import { addBankAccount, fetchAttachmentForDocument, partnerByUser, partnerStatusSummary, setAvailability, uploadDocument, upsertPartnerService } from '@/lib/partners/ops'
import { confirmLink, startLink } from '@/lib/accounts/link'
import { openGuaranteeClaim } from '@/lib/guarantee/ops'
import { eligibility, SLA_PROPOSAL_HOURS, SLA_RESOLUTION_HOURS, TYPE_LABEL, type GuaranteeType } from '@/lib/guarantee/policy'

export type PlatformToolName =
  | 'vincular_cuenta'
  | 'confirmar_codigo'
  | 'ver_socios_disponibles'
  | 'crear_solicitud'
  | 'ver_propuestas'
  | 'aceptar_propuesta'
  | 'ver_mis_reservas'
  | 'reprogramar_reserva'
  | 'cancelar_reserva'
  | 'reportar_pago'
  | 'confirmar_pago'
  | 'rechazar_pago'
  | 'calificar'
  | 'ver_oportunidades'
  | 'enviar_propuesta'
  | 'cambiar_estado_reserva'
  | 'cambiar_disponibilidad'
  | 'gestionar_servicio'
  | 'registrar_cuenta_bancaria'
  | 'subir_documento'
  | 'reportar_problema_servicio'
  | 'reactivar_solicitud'

const str = (description: string) => ({ type: 'string', description })
const confirmado = { type: 'boolean', description: 'false la primera vez (para proponer); true solo después de que la persona diga claramente que sí' }
const REF = str('Referencia de 6 caracteres tal como la devolvió la herramienta de consulta (nunca inventada)')
const CONFIRM_RULE = 'Primero llámala con confirmado: false: te devuelve el resumen exacto; díselo a la persona y pregúntale si confirma. Solo con un sí claro la vuelves a llamar con confirmado: true y los mismos datos.'
const NEEDS_LINK = 'Requiere que la conversación esté vinculada a su cuenta (si no lo está, usa vincular_cuenta).'

export const PLATFORM_TOOLS: Record<PlatformToolName, CatalogEntry> = {
  vincular_cuenta: {
    label: 'Vincular la conversación a una cuenta',
    description: 'Envía un código de 6 dígitos al teléfono o correo registrado en la cuenta LoHaggo de la persona para vincular esta conversación a su cuenta.',
    guidance: 'Úsala cuando la persona diga que ya tiene cuenta y la conversación no esté vinculada (el contexto lo dice). Pídele el teléfono o el correo con el que se registró y llámala. El código NUNCA llega a este chat: llega al teléfono o correo de la cuenta; pídele que lo escriba aquí y usa confirmar_codigo. La respuesta es la misma exista o no la cuenta: no afirmes que la cuenta existe. Si no tiene cuenta, usa crear_cuenta_cliente o crear_cuenta_socio.',
    writes: true, group: 'identity', platform: true,
    schema: () => ({ type: 'object', properties: { telefono: str('Teléfono que dio la persona, o vacío'), correo: str('Correo que dio la persona, o vacío') }, required: ['telefono', 'correo'], additionalProperties: false }),
  },
  confirmar_codigo: {
    label: 'Confirmar el código de vinculación',
    description: 'Comprueba el código que la persona recibió y, si es correcto, vincula la conversación a su cuenta.',
    guidance: 'Úsala cuando la persona escriba el código de 6 dígitos que recibió tras vincular_cuenta. Si falla, dile cuántos intentos quedan; a los tres fallos, ofrece hablar con una persona.',
    writes: true, group: 'identity', platform: true,
    schema: () => ({ type: 'object', properties: { codigo: str('Los 6 dígitos que escribió la persona') }, required: ['codigo'], additionalProperties: false }),
  },
  ver_socios_disponibles: {
    label: 'Ver socios disponibles para un servicio',
    description: 'Cuántos socios verificados atienden un servicio en una ciudad, con calificación y precio desde.',
    guidance: 'Úsala cuando la persona pregunte quién puede atenderla, cuántos socios hay o desde cuánto cobran, antes de crear la solicitud. Usa el nombre del servicio del catálogo.',
    writes: false, group: 'client', platform: true,
    schema: () => ({ type: 'object', properties: { servicio: str('Nombre del servicio, como en el catálogo'), ciudad: str('Ciudad: Medellín, Bogotá, Cali o Barranquilla') }, required: ['servicio', 'ciudad'], additionalProperties: false }),
  },
  crear_solicitud: {
    label: 'Crear solicitud de servicio',
    description: 'Crea una solicitud de servicio a nombre de la persona, igual que desde la app: los socios verificados de su ciudad la reciben y envían propuestas.',
    guidance: `Úsala solo después de tener: servicio del catálogo, dirección completa, fecha y hora (o urgente) y una descripción de lo que necesita. Pregunta una cosa a la vez. ${CONFIRM_RULE} ${NEEDS_LINK} Si la persona mandó fotos en este chat, no las inventes: solo incluye las que aparezcan en el contexto.`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        servicio: str('Nombre del servicio del catálogo'),
        direccion: str('Dirección completa con barrio'),
        ciudad: str('Ciudad'),
        fecha: str('Fecha preferida YYYY-MM-DD, o vacío si es urgente'),
        hora: str('Hora preferida HH:mm (24 h), o vacío'),
        urgente: { type: 'boolean', description: 'true si lo necesita lo antes posible' },
        detalles: str('Qué necesita, con sus palabras'),
        presupuesto: { type: 'number', description: 'Presupuesto en pesos que mencionó, o 0 si no dijo' },
        socio_ref: str('Referencia del socio si quiere uno en concreto (de ver_socios_disponibles), o vacío'),
        confirmado,
      },
      required: ['servicio', 'direccion', 'ciudad', 'fecha', 'hora', 'urgente', 'detalles', 'presupuesto', 'socio_ref', 'confirmado'],
      additionalProperties: false,
    }),
  },
  ver_propuestas: {
    label: 'Ver propuestas recibidas',
    description: 'Lista las solicitudes abiertas de la persona y las propuestas que le han llegado (socio, calificación, precio, nota) con su referencia.',
    guidance: `Úsala cuando pregunte si ya le llegaron propuestas, cuánto cobran o quién le propuso, y siempre antes de aceptar_propuesta para tener la referencia. ${NEEDS_LINK}`,
    writes: false, group: 'client', platform: true,
    schema: () => ({ type: 'object', properties: {}, required: [], additionalProperties: false }),
  },
  aceptar_propuesta: {
    label: 'Aceptar una propuesta',
    description: 'Acepta la propuesta elegida y crea la reserva con la fecha y hora acordadas, igual que en la app.',
    guidance: `${CONFIRM_RULE} Usa la referencia de ver_propuestas. Si la persona quiere otra fecha u hora distinta a la de su solicitud, pásalas. ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: { propuesta_ref: REF, fecha: str('YYYY-MM-DD si cambia la fecha, o vacío'), hora: str('HH:mm si cambia la hora, o vacío'), confirmado },
      required: ['propuesta_ref', 'fecha', 'hora', 'confirmado'],
      additionalProperties: false,
    }),
  },
  ver_mis_reservas: {
    label: 'Ver reservas',
    description: 'Lista las reservas de la persona (como cliente o como socio) con estado, fecha, precio, pago y referencia.',
    guidance: `Úsala cuando pregunte por el estado de su servicio, cuándo viene el socio, o antes de reprogramar, cancelar, cambiar estado, pagar o calificar. ${NEEDS_LINK}`,
    writes: false, group: 'client', platform: true,
    schema: () => ({ type: 'object', properties: { solo_proximas: { type: 'boolean', description: 'true para ver solo las que están por venir' } }, required: ['solo_proximas'], additionalProperties: false }),
  },
  reprogramar_reserva: {
    label: 'Reprogramar una reserva',
    description: 'Cambia la fecha y hora de una reserva pendiente o confirmada. Si la pide el cliente y ya estaba confirmada, el socio debe volver a confirmarla.',
    guidance: `${CONFIRM_RULE} La nueva fecha debe ser futura. ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, fecha: str('Nueva fecha YYYY-MM-DD'), hora: str('Nueva hora HH:mm'), confirmado }, required: ['reserva_ref', 'fecha', 'hora', 'confirmado'], additionalProperties: false }),
  },
  cancelar_reserva: {
    label: 'Cancelar una reserva',
    description: 'Cancela una reserva pendiente o confirmada aplicando la política de cancelación (reembolso total con más de 24 h; parcial entre 2 y 24 h; sin reembolso con menos de 2 h).',
    guidance: `${CONFIRM_RULE} Antes de proponer, explícale la política que aplica según la hora del servicio. Pregunta el motivo. ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, motivo: str('Motivo con sus palabras'), confirmado }, required: ['reserva_ref', 'motivo', 'confirmado'], additionalProperties: false }),
  },
  reportar_pago: {
    label: 'Reportar el pago (cliente)',
    description: 'El cliente reporta que pagó en efectivo o por transferencia una reserva completada; el socio debe confirmarlo. También da el enlace de MercadoPago si está habilitado.',
    guidance: `Solo para reservas completadas. Pregunta el medio (efectivo o transferencia). Si pide pagar en línea, usa medio "mercadopago" para obtener el enlace (no requiere confirmación). ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'payments', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, medio: { type: 'string', enum: ['efectivo', 'transferencia', 'mercadopago'] }, nota: str('Detalle opcional, o vacío'), confirmado }, required: ['reserva_ref', 'medio', 'nota', 'confirmado'], additionalProperties: false }),
  },
  confirmar_pago: {
    label: 'Confirmar el pago recibido (socio)',
    description: 'El socio confirma que recibió el pago de una reserva completada (efectivo o transferencia); queda aprobado y se programa su pago de plataforma.',
    guidance: `Solo si la persona es el socio de esa reserva. Pregunta el medio que recibió. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'payments', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, medio: { type: 'string', enum: ['efectivo', 'transferencia'] }, confirmado }, required: ['reserva_ref', 'medio', 'confirmado'], additionalProperties: false }),
  },
  rechazar_pago: {
    label: 'Rechazar un pago reportado (socio)',
    description: 'El socio indica que NO recibió el pago que el cliente reportó.',
    guidance: `Solo si el cliente ya reportó y el socio dice que no le llegó. Pide el motivo. ${CONFIRM_RULE} Tras rechazar, traspasa la conversación a una persona: es una disputa. ${NEEDS_LINK}`,
    writes: true, group: 'payments', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, motivo: str('Por qué no reconoce el pago'), confirmado }, required: ['reserva_ref', 'motivo', 'confirmado'], additionalProperties: false }),
  },
  calificar: {
    label: 'Calificar el servicio',
    description: 'Deja la calificación (1 a 5) y un comentario sobre una reserva completada: el cliente califica al socio o el socio al cliente.',
    guidance: `Solo para reservas completadas. Pide la nota de 1 a 5 y un comentario breve. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'payments', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, puntaje: { type: 'integer', minimum: 1, maximum: 5 }, comentario: str('Comentario con sus palabras, o vacío'), confirmado }, required: ['reserva_ref', 'puntaje', 'comentario', 'confirmado'], additionalProperties: false }),
  },
  ver_oportunidades: {
    label: 'Ver oportunidades (socio)',
    description: 'Lista las solicitudes activas que le aplican al socio (servicio, zona, fecha, presupuesto) con su referencia, y su estado como socio.',
    guidance: `Solo para socios. Úsala cuando pregunte qué trabajos hay o antes de enviar_propuesta. Si no está verificado, la respuesta lo dice: explícale qué le falta. ${NEEDS_LINK}`,
    writes: false, group: 'partner', platform: true,
    schema: () => ({ type: 'object', properties: {}, required: [], additionalProperties: false }),
  },
  enviar_propuesta: {
    label: 'Enviar una propuesta (socio)',
    description: 'Envía la propuesta del socio a una solicitud: precio y nota, igual que desde la app.',
    guidance: `Usa la referencia de ver_oportunidades. El precio debe ser al menos el precio base del servicio. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { solicitud_ref: REF, precio: { type: 'number', description: 'Precio total en pesos' }, nota: str('Qué incluye, cuándo puede ir, con sus palabras'), confirmado }, required: ['solicitud_ref', 'precio', 'nota', 'confirmado'], additionalProperties: false }),
  },
  cambiar_estado_reserva: {
    label: 'Cambiar el estado de una reserva (socio)',
    description: 'El socio confirma una reserva pendiente, la marca en curso al llegar o completada al terminar.',
    guidance: `Solo el socio de la reserva. Los pasos son: confirmar → en curso → completada. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { reserva_ref: REF, estado: { type: 'string', enum: ['confirmar', 'en_curso', 'completar'] }, confirmado }, required: ['reserva_ref', 'estado', 'confirmado'], additionalProperties: false }),
  },
  cambiar_disponibilidad: {
    label: 'Cambiar disponibilidad (socio)',
    description: 'Marca al socio como disponible o no disponible para recibir solicitudes.',
    guidance: `Úsala cuando el socio diga que no puede recibir trabajos por un tiempo, o que ya volvió. No requiere confirmación. ${NEEDS_LINK}`,
    writes: true, group: 'partner_profile', platform: true,
    schema: () => ({ type: 'object', properties: { disponible: { type: 'boolean' } }, required: ['disponible'], additionalProperties: false }),
  },
  gestionar_servicio: {
    label: 'Activar, pausar o cambiar precio de un servicio (socio)',
    description: 'Activa un servicio del catálogo para el socio, lo pausa, o cambia su precio (nunca por debajo del precio base).',
    guidance: `Usa el nombre exacto del servicio del catálogo. Cambiar el precio o activar requiere confirmación; pausar también. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner_profile', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { servicio: str('Nombre del servicio del catálogo'), accion: { type: 'string', enum: ['activar', 'pausar', 'precio'] }, precio: { type: 'number', description: 'Nuevo precio en pesos (0 si no aplica)' }, confirmado }, required: ['servicio', 'accion', 'precio', 'confirmado'], additionalProperties: false }),
  },
  registrar_cuenta_bancaria: {
    label: 'Registrar cuenta bancaria o Nequi (socio)',
    description: 'Registra la cuenta donde el socio recibe sus pagos de la plataforma.',
    guidance: `Pide banco, tipo (ahorros o corriente), número, nombre del titular y documento del titular. Léele todo antes de proponer. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner_profile', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        banco: str('Nombre del banco o billetera (Bancolombia, Nequi, Daviplata…)'),
        tipo: { type: 'string', enum: ['ahorros', 'corriente'] },
        numero: str('Número de cuenta o celular Nequi/Daviplata'),
        titular: str('Nombre completo del titular'),
        tipo_documento: { type: 'string', enum: ['CC', 'CE', 'NIT', 'PASSPORT'] },
        documento: str('Número de documento del titular'),
        confirmado,
      },
      required: ['banco', 'tipo', 'numero', 'titular', 'tipo_documento', 'documento', 'confirmado'],
      additionalProperties: false,
    }),
  },
  subir_documento: {
    label: 'Subir documento de verificación (socio)',
    description: 'Toma la última foto o PDF que la persona envió en este chat y la sube como documento de verificación del socio (cédula, antecedentes, diploma…).',
    guidance: `Úsala cuando el socio envíe la foto de su documento. Pregunta qué documento es si no está claro. Solo se sube el último adjunto recibido; si mandó varios, uno por llamada, pidiendo que los envíe de uno en uno. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner_profile', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP', 'ANTECEDENTES', 'DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO', 'CAMARA_COMERCIO'] },
        confirmado,
      },
      required: ['tipo', 'confirmado'],
      additionalProperties: false,
    }),
  },
  reportar_problema_servicio: {
    label: 'Reportar un problema con el servicio (garantía)',
    description: 'El cliente reclama la Garantía LoHaggo sobre una reserva: el socio no llegó (o llegó más de 60 min tarde sin avisar), el trabajo quedó incompleto o distinto a lo acordado, o hubo un daño a su propiedad. Abre el reclamo para el equipo, con la última foto que envió en este chat si la hay.',
    guidance: `Úsala cuando el cliente diga que el socio no llegó, que el trabajo quedó mal o incompleto, o que le dañaron algo. Qué cubre: reservas hechas por LoHaggo (no lo acordado por fuera); «no llegó» se reclama desde la hora del servicio hasta 24 h después; trabajo mal hecho o daño, hasta 72 h después de completada. Antes de proponer: consulta ver_mis_reservas para la referencia y pide una descripción concreta (qué pasó y a qué hora); si tiene fotos, que las envíe por este chat antes de confirmar. NUNCA prometas dinero, reembolsos ni pagos de daños: di que el equipo propone una solución en máximo 24 h y la resuelve en máximo 72 h (otro socio con prioridad, cancelación sin costo o que el mismo socio corrija; el reembolso solo si pagó en línea y lo decide el equipo). Si es un daño, tras registrarlo una persona del equipo continúa. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        reserva_ref: REF,
        tipo: { type: 'string', enum: ['no_llego', 'mal_trabajo', 'dano'], description: 'no_llego: el socio no llegó o llegó más de 60 min tarde sin avisar; mal_trabajo: incompleto o distinto a lo acordado; dano: daño a la propiedad' },
        descripcion: str('Qué pasó y a qué hora, con sus palabras'),
        confirmado,
      },
      required: ['reserva_ref', 'tipo', 'descripcion', 'confirmado'],
      additionalProperties: false,
    }),
  },
  reactivar_solicitud: {
    label: 'Reactivar una solicitud vencida',
    description: 'Vuelve a abrir por 24 horas una solicitud vencida de la persona: recupera las propuestas que tenía y los socios reciben el aviso otra vez (máximo 3 veces por solicitud).',
    guidance: `Úsala cuando la persona pida reactivar una solicitud que venció (por ejemplo, pulsó «Reactivar» en nuestro aviso de WhatsApp: el contexto trae la referencia). No requiere confirmación: la persona ya lo pidió. Si no sabes cuál, deja la referencia vacía y se usa su última solicitud vencida. ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true,
    schema: () => ({ type: 'object', properties: { solicitud_ref: str('Referencia de 6 caracteres de la solicitud (del contexto o de una consulta), o vacío para su última solicitud vencida') }, required: ['solicitud_ref'], additionalProperties: false }),
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CITY_BY_NAME: Record<string, City> = { medellin: 'MEDELLIN', bogota: 'BOGOTA', cali: 'CALI', barranquilla: 'BARRANQUILLA' }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export function cityFromText(text: string, fallback: City = 'MEDELLIN'): City {
  const n = norm(text)
  for (const [k, v] of Object.entries(CITY_BY_NAME)) if (n.includes(k)) return v
  return fallback
}

const METHOD: Record<string, 'CASH' | 'DIRECT_TRANSFER'> = { efectivo: 'CASH', transferencia: 'DIRECT_TRANSFER' }
const STATE: Record<string, BookingStatus> = { confirmar: 'CONFIRMED', en_curso: 'IN_PROGRESS', completar: 'COMPLETED' }

export function parseWhen(fecha: string, hora: string): { scheduledDate: Date; scheduledTime: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{1,2}:\d{2}$/.test(hora)) return null
  const [h, m] = hora.split(':').map(Number)
  if (h > 23 || m > 59) return null
  const scheduledTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const d = new Date(`${fecha}T${scheduledTime}:00-05:00`)
  return Number.isNaN(d.getTime()) ? null : { scheduledDate: d, scheduledTime }
}

export async function findServiceByName(name: string) {
  const services = await prisma.service.findMany({ select: { id: true, name: true, basePrice: true, slug: true } })
  const n = norm(name)
  return services.find((s) => norm(s.name) === n) ?? services.find((s) => norm(s.name).includes(n) || n.includes(norm(s.name))) ?? null
}

/** Playground: after a simulated code, the rest of the flow runs as this pretend client (reads real catalog data, writes nothing). */
export const PLAYGROUND_USER = '__playground__'

async function actorFor(ctx: ToolContext): Promise<Actor | null> {
  if (!ctx.userId) return null
  if (ctx.mode === 'playground' && ctx.userId === PLAYGROUND_USER) return { userId: PLAYGROUND_USER, role: 'CLIENT', partnerId: null, email: null }
  const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, role: true, email: true, isActive: true, partnerProfile: { select: { id: true } } } })
  if (!u || !u.isActive) return null
  return { userId: u.id, role: u.role === 'ADMIN' ? 'ADMIN' : u.partnerProfile ? 'PARTNER' : 'CLIENT', partnerId: u.partnerProfile?.id ?? null, email: u.email }
}

function originFor(ctx: ToolContext): Origin {
  return chatOrigin({ channel: ctx.contact.channel, conversationId: ctx.conversationId ?? 'playground', agentId: ctx.agent.id, agentName: ctx.agent.name })
}

const NOT_LINKED = 'Esta conversación no está vinculada a una cuenta de LoHaggo. Pregúntale si ya tiene cuenta: si sí, usa vincular_cuenta; si no, crear_cuenta_cliente o crear_cuenta_socio.'
const NOT_PARTNER = 'La persona vinculada no es socio (no tiene perfil de socio). Esta herramienta es solo para socios.'
const validRef = (r: string) => /^[a-z0-9]{6}$/i.test(r.trim())

/** The person's own entity whose id ends with the reference the model was shown. */
async function bookingByRef(actor: Actor, ref: string) {
  if (!validRef(ref)) return null
  const rows = await bookingsFor(actor, { take: 200 })
  return rows.find((b) => b.id.endsWith(ref.trim())) ?? null
}
async function proposalByRef(actor: Actor, ref: string) {
  if (!validRef(ref)) return null
  const rows = await listProposalsForClient(actor.userId)
  return rows.find((p) => p.id.endsWith(ref.trim())) ?? null
}
async function requestByRef(partnerId: string, ref: string) {
  if (!validRef(ref)) return null
  const rows = await listOpenRequestsForPartner(partnerId)
  return rows.find((r) => r.id.endsWith(ref.trim())) ?? null
}

/** The last image or PDF the person sent in this conversation. */
async function lastInboundAttachment(conversationId: string) {
  return prisma.conversationMessage.findFirst({
    where: { conversationId, direction: 'INBOUND', mediaUrl: { not: null } },
    orderBy: { sentAt: 'desc' },
    select: { mediaUrl: true, mediaType: true, mediaName: true, sentAt: true },
  })
}

/** The last image the person sent in this conversation in the last 24 h (evidence for a guarantee claim). */
async function lastInboundImage(conversationId: string) {
  const since = new Date(Date.now() - 24 * 3600_000)
  return prisma.conversationMessage.findFirst({
    where: { conversationId, direction: 'INBOUND', mediaUrl: { not: null }, mediaType: { startsWith: 'image' }, sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    select: { mediaUrl: true },
  })
}

const GUARANTEE_TYPE: Record<string, GuaranteeType> = { no_llego: 'NO_SHOW', mal_trabajo: 'BAD_WORK', dano: 'DAMAGE' }

// ─── Plans ──────────────────────────────────────────────────────────────────

type Plan =
  | { error: string }
  | { summary: string; wouldRecord: string; run: () => Promise<{ text: string; entityType: string; entityId: string }> }

type Planner = (input: Record<string, unknown>, ctx: ToolContext, actor: Actor) => Promise<Plan>

const s = (input: Record<string, unknown>, k: string) => String(input[k] ?? '').trim()
const n = (input: Record<string, unknown>, k: string) => Number(input[k]) || 0

const PLANNERS: Partial<Record<PlatformToolName, Planner>> = {
  crear_solicitud: async (input, ctx, actor) => {
    const service = await findServiceByName(s(input, 'servicio'))
    if (!service) return { error: `El servicio «${s(input, 'servicio')}» no está en el catálogo. Consulta el catálogo y usa el nombre exacto.` }
    const city = cityFromText(s(input, 'ciudad'))
    const urgent = Boolean(input.urgente)
    const fecha = s(input, 'fecha')
    const hora = s(input, 'hora')
    if (!urgent && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Falta la fecha (YYYY-MM-DD) o marcar la solicitud como urgente.' }
    const address = s(input, 'direccion')
    if (address.length < 5) return { error: 'Falta la dirección completa.' }
    let partnerId: string | null = null
    const socioRef = s(input, 'socio_ref')
    if (socioRef) {
      const list = await partnersForService(service.id, city)
      partnerId = list.find((p) => p.partnerId.endsWith(socioRef))?.partnerId ?? null
      if (!partnerId) return { error: 'Esa referencia de socio no corresponde a ninguno disponible para este servicio. Vuelve a consultar ver_socios_disponibles.' }
    }
    const budget = n(input, 'presupuesto')
    const when = urgent ? 'lo antes posible (urgente)' : `${fecha}${hora ? ` a las ${hora}` : ''}`
    const summary = `Crear solicitud de ${service.name} en ${address} (${city}) para ${when}${budget ? `, presupuesto ${cop(budget)}` : ''}${partnerId ? ', dirigida a un socio en concreto' : ''}`
    return {
      summary,
      wouldRecord: 'una solicitud de servicio (ServiceRequest) y las notificaciones a los socios',
      run: async () => {
        const sr = await createServiceRequest(actor, {
          serviceId: service.id, address, city, notes: s(input, 'detalles') || undefined, budget: budget || undefined,
          preferredDate: urgent && !fecha ? null : fecha, preferredTime: hora || null, isUrgent: urgent, partnerId, photoUrls: [],
        }, originFor(ctx))
        return { text: `Solicitud creada (ref ${shortId(sr.id)}). Los socios verificados de ${city} ya la recibieron; las propuestas llegarán a este chat y a la app. Dile que puede preguntarte por ellas en un rato.`, entityType: 'ServiceRequest', entityId: sr.id }
      },
    }
  },

  aceptar_propuesta: async (input, ctx, actor) => {
    const p = await proposalByRef(actor, s(input, 'propuesta_ref'))
    if (!p) return { error: 'Esa referencia no corresponde a ninguna propuesta de esta persona. Consulta ver_propuestas y usa la referencia exacta.' }
    if (p.status !== 'PENDING') return { error: 'Esa propuesta ya no está disponible.' }
    const fecha = s(input, 'fecha')
    const hora = s(input, 'hora')
    const when = fecha || hora ? parseWhen(fecha || '', hora || '') : null
    if ((fecha || hora) && !when) return { error: 'Si cambia la fecha u hora, deben venir ambas: fecha YYYY-MM-DD y hora HH:mm.' }
    const partnerName = p.partner?.user?.name ?? 'el socio'
    const summary = `Aceptar la propuesta de ${partnerName} por ${cop(p.price)}${when ? ` para el ${fecha} a las ${when.scheduledTime}` : ' con la fecha y hora de la solicitud'}`
    return {
      summary,
      wouldRecord: 'la propuesta aceptada, las demás rechazadas y una reserva (Booking) pendiente de confirmar por el socio',
      run: async () => {
        const booking = await acceptProposal(actor, p.id, originFor(ctx), when ?? undefined)
        return { text: `Propuesta aceptada. Reserva creada (ref ${shortId(booking.id)}): ${bookingSummaryForChat(booking)}. El socio debe confirmarla; avisaremos por la app y por aquí.`, entityType: 'Booking', entityId: booking.id }
      },
    }
  },

  reprogramar_reserva: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de esta persona. Consulta ver_mis_reservas.' }
    const when = parseWhen(s(input, 'fecha'), s(input, 'hora'))
    if (!when) return { error: 'Fecha u hora inválidas: usa YYYY-MM-DD y HH:mm.' }
    if (when.scheduledDate.getTime() < Date.now() + 3600_000) return { error: 'La nueva fecha debe ser al menos una hora en el futuro.' }
    return {
      summary: `Reprogramar la reserva de ${b.service?.name ?? 'servicio'} (ref ${shortId(b.id)}) para el ${s(input, 'fecha')} a las ${when.scheduledTime}`,
      wouldRecord: 'la nueva fecha en la reserva y su historial (BookingEvent)',
      run: async () => {
        const r = await rescheduleBooking(actor, b.id, when, originFor(ctx))
        const again = r.booking.status === 'PENDING' && b.status === 'CONFIRMED' ? ' Como estaba confirmada, el socio debe volver a confirmar la nueva fecha.' : ''
        return { text: `Reserva reprogramada: ${bookingSummaryForChat(r.booking)}.${again}`, entityType: 'Booking', entityId: b.id }
      },
    }
  },

  cancelar_reserva: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de esta persona. Consulta ver_mis_reservas.' }
    if (b.status === 'COMPLETED' || b.status === 'CANCELLED') return { error: `La reserva ya está ${b.status === 'COMPLETED' ? 'completada' : 'cancelada'}; no se puede cancelar.` }
    return {
      summary: `Cancelar la reserva de ${b.service?.name ?? 'servicio'} (ref ${shortId(b.id)}) por «${s(input, 'motivo') || 'sin motivo'}», aplicando la política de cancelación`,
      wouldRecord: 'la reserva cancelada, su historial y, si había pago aprobado, el caso de reembolso',
      run: async () => {
        await transitionBooking(actor, b.id, 'CANCELLED', originFor(ctx), { reason: s(input, 'motivo') || undefined })
        return { text: 'Reserva cancelada. Se avisó a la otra parte; si había un pago aprobado, el reembolso sigue la política y el equipo lo revisa.', entityType: 'Booking', entityId: b.id }
      },
    }
  },

  reportar_pago: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de esta persona. Consulta ver_mis_reservas.' }
    const medio = s(input, 'medio')
    if (medio === 'mercadopago') return { error: '__MP__' }
    const method = METHOD[medio]
    if (!method) return { error: 'Medio inválido: efectivo o transferencia.' }
    return {
      summary: `Reportar el pago de ${cop(b.totalPrice)} de la reserva ${shortId(b.id)} en ${medio}`,
      wouldRecord: 'el pago (Payment) reportado por el cliente, pendiente de que el socio confirme',
      run: async () => {
        await reportClientPayment(actor, b.id, { method, note: s(input, 'nota') || undefined }, originFor(ctx))
        return { text: 'Pago reportado. El socio debe confirmarlo; cuando lo haga, quedará aprobado y podrá calificar.', entityType: 'Payment', entityId: b.id }
      },
    }
  },

  confirmar_pago: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de este socio. Consulta ver_mis_reservas.' }
    const method = METHOD[s(input, 'medio')]
    if (!method) return { error: 'Medio inválido: efectivo o transferencia.' }
    return {
      summary: `Confirmar que recibió ${cop(b.totalPrice)} en ${s(input, 'medio')} por la reserva ${shortId(b.id)}`,
      wouldRecord: 'el pago confirmado y aprobado, y el pago de plataforma al socio (Payout) pendiente',
      run: async () => {
        await confirmPartnerPayment(actor, b.id, { method }, originFor(ctx))
        return { text: 'Pago confirmado y aprobado. Su pago de plataforma queda programado y el cliente ya puede calificar.', entityType: 'Payment', entityId: b.id }
      },
    }
  },

  rechazar_pago: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de este socio.' }
    return {
      summary: `Rechazar el pago que el cliente reportó en la reserva ${shortId(b.id)} («${s(input, 'motivo')}»)`,
      wouldRecord: 'el pago como rechazado por el socio y el aviso al cliente',
      run: async () => {
        await rejectPartnerPayment(actor, b.id, s(input, 'motivo') || 'No recibido', originFor(ctx))
        ctx.state.handoff = { reason: 'Disputa de pago: el socio rechazó el pago reportado' }
        return { text: 'Pago rechazado y cliente avisado. Esto es una disputa: una persona del equipo continuará; despídete y avísale.', entityType: 'Payment', entityId: b.id }
      },
    }
  },

  calificar: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de esta persona.' }
    const rating = Math.round(n(input, 'puntaje'))
    if (rating < 1 || rating > 5) return { error: 'La calificación va de 1 a 5.' }
    return {
      summary: `Calificar con ${rating} estrella${rating === 1 ? '' : 's'} la reserva ${shortId(b.id)}${s(input, 'comentario') ? ` («${s(input, 'comentario')}»)` : ''}`,
      wouldRecord: 'la reseña (Review) y el promedio actualizado',
      run: async () => {
        const r = await leaveReview(actor, { bookingId: b.id, rating, comment: s(input, 'comentario') || undefined }, originFor(ctx))
        return { text: 'Calificación guardada. Gracias.', entityType: 'Review', entityId: r.id }
      },
    }
  },

  enviar_propuesta: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const r = await requestByRef(actor.partnerId, s(input, 'solicitud_ref'))
    if (!r) return { error: 'Esa referencia no corresponde a ninguna solicitud disponible para este socio. Consulta ver_oportunidades.' }
    const price = n(input, 'precio')
    if (price <= 0) return { error: 'Falta el precio.' }
    return {
      summary: `Enviar propuesta de ${cop(price)} a la solicitud de ${r.service?.name ?? 'servicio'} (ref ${shortId(r.id)})${s(input, 'nota') ? ` con la nota «${s(input, 'nota')}»` : ''}`,
      wouldRecord: 'la propuesta (Proposal) y el aviso al cliente',
      run: async () => {
        const p = await createProposal(actor, { serviceRequestId: r.id, price, notes: s(input, 'nota') || undefined }, originFor(ctx))
        return { text: `Propuesta enviada (ref ${shortId(p.id)}). El cliente ya la ve; le avisaremos si la acepta.`, entityType: 'Proposal', entityId: p.id }
      },
    }
  },

  cambiar_estado_reserva: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de este socio.' }
    const to = STATE[s(input, 'estado')]
    if (!to) return { error: 'Estado inválido: confirmar, en_curso o completar.' }
    const label = { CONFIRMED: 'confirmada', IN_PROGRESS: 'en curso', COMPLETED: 'completada' }[to as 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED']
    return {
      summary: `Marcar la reserva ${shortId(b.id)} (${b.service?.name ?? 'servicio'}) como ${label}`,
      wouldRecord: 'el nuevo estado de la reserva, su historial y el aviso al cliente',
      run: async () => {
        const updated = await transitionBooking(actor, b.id, to, originFor(ctx))
        const next = to === 'COMPLETED' ? ' Cuando el cliente pague, confirma el pago con confirmar_pago.' : ''
        return { text: `Reserva ${label}: ${bookingSummaryForChat(updated)}.${next}`, entityType: 'Booking', entityId: b.id }
      },
    }
  },

  gestionar_servicio: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const service = await findServiceByName(s(input, 'servicio'))
    if (!service) return { error: `El servicio «${s(input, 'servicio')}» no está en el catálogo.` }
    const accion = s(input, 'accion')
    const price = n(input, 'precio')
    if (accion === 'precio' && price < service.basePrice) return { error: `El precio no puede ser menor al precio base del servicio (${cop(service.basePrice)}).` }
    const summary = accion === 'pausar' ? `Pausar el servicio ${service.name}` : accion === 'precio' ? `Cambiar el precio de ${service.name} a ${cop(price)}` : `Activar el servicio ${service.name}${price ? ` con precio ${cop(price)}` : ''}`
    return {
      summary,
      wouldRecord: 'el servicio del socio (PartnerService)',
      run: async () => {
        const ps = await upsertPartnerService(actor, { serviceId: service.id, ...(accion === 'pausar' ? { active: false } : accion === 'precio' ? { price } : { active: true, ...(price ? { price } : {}) }) }, originFor(ctx))
        return { text: `Listo: ${summary.charAt(0).toLowerCase()}${summary.slice(1)}.`, entityType: 'PartnerService', entityId: ps.id }
      },
    }
  },

  registrar_cuenta_bancaria: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    const numero = s(input, 'numero').replace(/\s/g, '')
    if (!numero) return { error: 'Falta el número de cuenta.' }
    return {
      summary: `Registrar la cuenta ${s(input, 'tipo')} de ${s(input, 'banco')} terminada en ${numero.slice(-4)} a nombre de ${s(input, 'titular')} (${s(input, 'tipo_documento')} terminado en ${s(input, 'documento').slice(-4)}) como cuenta para recibir pagos`,
      wouldRecord: 'la cuenta bancaria del socio (PartnerBankAccount)',
      run: async () => {
        const acc = await addBankAccount(actor, {
          bankName: s(input, 'banco'), accountType: s(input, 'tipo') === 'corriente' ? 'CHECKING' : 'SAVINGS', accountNumber: numero,
          accountHolderName: s(input, 'titular'), holderDocumentType: s(input, 'tipo_documento'), holderDocumentNumber: s(input, 'documento'),
        }, originFor(ctx))
        return { text: `Cuenta registrada (termina en ${numero.slice(-4)}). Sus pagos de plataforma irán ahí.`, entityType: 'PartnerBankAccount', entityId: acc.id }
      },
    }
  },

  subir_documento: async (input, ctx, actor) => {
    if (!actor.partnerId) return { error: NOT_PARTNER }
    if (!ctx.conversationId) return { error: 'En pruebas no hay adjuntos que subir.' }
    const att = await lastInboundAttachment(ctx.conversationId)
    if (!att?.mediaUrl) return { error: 'La persona no ha enviado ninguna foto o archivo en este chat. Pídele que envíe la foto del documento.' }
    const type = s(input, 'tipo') as DocumentType
    return {
      summary: `Subir el último archivo que envió (${att.mediaName || att.mediaType || 'imagen'}) como ${type.replace(/_/g, ' ').toLowerCase()} a su verificación`,
      wouldRecord: 'el documento de verificación (VerificationDocument) pendiente de revisión',
      run: async () => {
        const file = await fetchAttachmentForDocument(att.mediaUrl!)
        const doc = await uploadDocument(actor, { type, file }, originFor(ctx))
        return { text: 'Documento subido y en revisión. El equipo lo aprueba normalmente en 1 a 2 días hábiles; le avisaremos.', entityType: 'VerificationDocument', entityId: doc.id }
      },
    }
  },
  reactivar_solicitud: async (input, ctx, actor) => {
    const ref = s(input, 'solicitud_ref')
    if (ref && !validRef(ref)) return { error: 'Referencia inválida: usa los 6 caracteres de la solicitud o déjala vacía.' }
    const { serviceRequests } = await listClientRequests(actor.userId)
    const expired = serviceRequests.filter((r) => isRequestExpired(r))
    const r = ref ? serviceRequests.find((x) => x.id.endsWith(ref.trim())) : expired[0]
    if (!r) return { error: ref ? 'Esa referencia no corresponde a ninguna solicitud de esta persona.' : 'La persona no tiene solicitudes vencidas.' }
    if (!isRequestExpired(r)) return { error: r.status === 'ACTIVE' ? 'Esa solicitud sigue activa: no hace falta reactivarla.' : 'Solo se reactivan solicitudes vencidas; esa ya no se puede.' }
    const service = r.service?.name ?? 'servicio'
    return {
      summary: `Reactivar por 24 horas la solicitud de ${service} (ref ${shortId(r.id)})`,
      wouldRecord: 'la solicitud activa de nuevo, sus propuestas recuperadas y el aviso a los socios',
      run: async () => {
        const res = await reactivateServiceRequest(actor, r.id, originFor(ctx))
        const back = res.restoredProposals ? ` Recuperó ${res.restoredProposals} propuesta${res.restoredProposals === 1 ? '' : 's'}.` : ''
        return { text: `Solicitud reactivada hasta ${fmtDate(res.expiresAt)}; los socios ya recibieron el aviso.${back} Le quedan ${res.remaining} reactivaciones.`, entityType: 'ServiceRequest', entityId: r.id }
      },
    }
  },

  reportar_problema_servicio: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b) return { error: 'Esa referencia no corresponde a ninguna reserva de esta persona. Consulta ver_mis_reservas.' }
    if (b.userId !== actor.userId) return { error: 'Solo el cliente de la reserva puede reclamar la garantía.' }
    const type = GUARANTEE_TYPE[s(input, 'tipo')]
    if (!type) return { error: 'Tipo inválido: no_llego, mal_trabajo o dano.' }
    const description = s(input, 'descripcion')
    if (description.length < 10) return { error: 'Falta una descripción concreta: pregúntale qué pasó exactamente y a qué hora.' }
    const check = eligibility({ status: b.status, partnerId: b.partnerId, scheduledAt: bookingWhen(b), completedAt: b.status === 'COMPLETED' ? b.updatedAt : null }, type)
    if (!check.ok) return { error: `No aplica la garantía: ${check.reason} Explícaselo con tus palabras; si insiste, ofrece hablar con una persona del equipo.` }
    const photo = ctx.conversationId ? await lastInboundImage(ctx.conversationId) : null
    return {
      summary: `Reportar a la garantía «${TYPE_LABEL[type].toLowerCase()}» en la reserva de ${b.service?.name ?? 'servicio'} (ref ${shortId(b.id)}): «${description}»${photo?.mediaUrl ? ', con la última foto que envió' : ''}`,
      wouldRecord: 'el reclamo de garantía (GuaranteeClaim), su caso en la cola de garantía del equipo y el aviso al socio',
      run: async () => {
        const claim = await openGuaranteeClaim(actor, { bookingId: b.id, type, description, photoUrls: photo?.mediaUrl ? [photo.mediaUrl] : [] }, originFor(ctx))
        const due = fmtDate(claim.slaDueAt)
        if (type === 'DAMAGE') ctx.state.handoff = { reason: 'Garantía: daño a la propiedad (caso de seguridad)' }
        const next = type === 'DAMAGE'
          ? 'Una persona del equipo continúa esta conversación para mediar con el socio y documentar el caso. No prometas dinero: LoHaggo media, no paga daños.'
          : `El equipo propone una solución en máximo ${SLA_PROPOSAL_HOURS} h (otro socio con prioridad, cancelación sin costo o que el mismo socio corrija) y lo resuelve en máximo ${SLA_RESOLUTION_HOURS} h. No prometas dinero ni un remedio en concreto.`
        return { text: `Reclamo de garantía registrado (ref ${shortId(claim.id)}), con plazo de solución hasta ${due}. ${next}`, entityType: 'GuaranteeClaim', entityId: claim.id }
      },
    }
  },
}

// ─── Reads ──────────────────────────────────────────────────────────────────

async function runRead(name: PlatformToolName, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  if (name === 'ver_socios_disponibles') {
    const service = await findServiceByName(s(input, 'servicio'))
    if (!service) return `El servicio «${s(input, 'servicio')}» no está en el catálogo.`
    const city = cityFromText(s(input, 'ciudad'))
    const [summary, list] = await Promise.all([partnerAvailabilitySummary(service.id, city), partnersForService(service.id, city)])
    if (!summary.total) return `Por ahora no hay socios verificados de ${service.name} en ${city}. Igual puede crear la solicitud: le avisaremos cuando alguno la tome.`
    const lines = list.slice(0, 8).map((p) => `- ref ${shortId(p.partnerId)}: ${p.name} · ${p.rating ? `${p.rating.toFixed(1)}★ (${p.totalReviews})` : 'sin reseñas'} · desde ${cop(p.price)} · ${p.completedServicesCount} servicios · ${p.isAvailable ? 'disponible' : 'no disponible ahora'}`)
    return `${service.name} en ${city}: ${summary.total} socios verificados, ${summary.available} disponibles ahora, desde ${cop(summary.fromPrice ?? 0)}${summary.avgRating ? `, calificación promedio ${summary.avgRating.toFixed(1)}` : ''}.\n${lines.join('\n')}`
  }
  const actor = await actorFor(ctx)
  if (!actor) return NOT_LINKED
  if (name === 'ver_propuestas') {
    const { serviceRequests: requests } = await listClientRequests(actor.userId)
    const open = requests.filter((r) => r.status === 'ACTIVE' || r.status === 'ACCEPTED').slice(0, 5)
    if (!open.length) return 'No tiene solicitudes abiertas.'
    const parts: string[] = []
    for (const r of open) {
      parts.push(await requestSummaryForChat(r.id))
      const props = (r.proposals ?? []).filter((p) => p.status === 'PENDING' || p.status === 'ACCEPTED')
      parts.push(props.length ? props.map((p) => `  - ref ${shortId(p.id)}: ${proposalSummaryForChat(p)}`).join('\n') : '  (aún sin propuestas)')
    }
    return parts.join('\n')
  }
  if (name === 'ver_mis_reservas') {
    const rows = await bookingsFor(actor, { upcomingOnly: Boolean(input.solo_proximas), take: 10 })
    if (!rows.length) return 'No tiene reservas.'
    return rows.map((b) => `- ref ${shortId(b.id)}: ${bookingSummaryForChat(b)} · ${paymentSummaryForChat(b)}`).join('\n')
  }
  if (name === 'ver_oportunidades') {
    if (!actor.partnerId) return NOT_PARTNER
    const partner = await partnerByUser(actor.userId)
    const status = await partnerStatusSummary(partner.id)
    if (!partner.verified || !partner.isActive) return `${status}\nMientras no esté verificado y activo no recibe solicitudes ni puede proponer.`
    const rows = await listOpenRequestsForPartner(actor.partnerId)
    if (!rows.length) return `${status}\nNo hay solicitudes abiertas que le apliquen ahora.`
    return `${status}\nSolicitudes disponibles:\n${rows.slice(0, 8).map((r) => `- ref ${shortId(r.id)}: ${r.service?.name ?? 'servicio'} · ${r.isUrgent ? 'urgente' : fmtDate(r.preferredDate)}${r.preferredTime ? ` ${r.preferredTime}` : ''} · ${r.address}${r.budget ? ` · presupuesto ${cop(r.budget)}` : ''} · ${r._count?.proposals ?? 0} propuestas · vence ${fmtDate(r.expiresAt)}`).join('\n')}`
  }
  return `Herramienta "${name}" no disponible.`
}

// ─── Identity (direct: runs without proposal; the code goes to the account's own phone or email) ─────

async function runIdentity(name: PlatformToolName, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  if (ctx.mode === 'playground' || !ctx.conversationId) {
    if (name === 'vincular_cuenta') return 'Código enviado (simulado en pruebas) al teléfono o correo de la cuenta. Pídele los 6 dígitos.'
    if (!/^\d{6}$/.test(s(input, 'codigo'))) return 'Código incorrecto (simulado en pruebas): deben ser 6 dígitos.'
    ctx.userId = PLAYGROUND_USER
    return 'Código comprobado (simulado en pruebas): conversación vinculada a una cuenta de cliente de prueba. Ya puedes usar las herramientas de su cuenta.'
  }
  const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { contactId: true, userId: true, workspaceId: true } })
  if (!conv?.contactId) return 'No se pudo vincular: esta conversación no tiene contacto. Pasa el caso a una persona.'
  if (name === 'vincular_cuenta') {
    if (conv.userId) return 'Esta conversación ya está vinculada a una cuenta.'
    if (await overDailyLimit(ctx.conversationId, 'vincular_cuenta')) { ctx.state.handoff = { reason: 'Tope de códigos de vinculación' }; return LIMIT_REACHED_TEXT }
    const phone = s(input, 'telefono')
    const email = s(input, 'correo')
    if (!phone && !email) return 'Falta el teléfono o el correo con el que se registró.'
    const r = await startLink({ conversationId: ctx.conversationId, contactId: conv.contactId, phone: phone || undefined, email: email || undefined, via: phone ? 'phone' : 'email', actor: { agentId: ctx.agent.id, agentName: ctx.agent.name } })
    await recordAction({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agent: ctx.agent, tool: name, summary: `Enviar código de vinculación a ${r.ok ? r.sentTo : 'la cuenta'}`, input, status: r.ok ? 'executed' : 'failed', result: r.ok ? `Enviado a ${r.sentTo}` : r.code })
    if (!r.ok) return r.code === 'limit' ? LIMIT_REACHED_TEXT : 'No se pudo enviar el código ahora. Pasa el caso a una persona.'
    return `Si esos datos corresponden a una cuenta de LoHaggo, el código llegó a ${r.sentTo} (vence en 10 minutos). Pídele que lo escriba aquí. No confirmes ni niegues que la cuenta existe.`
  }
  // confirmar_codigo
  const r = await confirmLink({ conversationId: ctx.conversationId, contactId: conv.contactId, code: s(input, 'codigo') })
  await recordAction({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agent: ctx.agent, tool: name, summary: 'Confirmar código de vinculación', input: { codigo: '••••••' }, status: r.ok ? 'executed' : 'failed', result: r.ok ? 'Vinculada' : r.code, entityType: r.ok ? 'User' : null, entityId: r.ok ? r.userId : null })
  if (!r.ok) {
    if (r.code === 'locked') { ctx.state.handoff = { reason: 'Tres códigos incorrectos' }; return 'Tres intentos fallidos: el código quedó bloqueado. Una persona del equipo continuará; despídete y avísale.' }
    if (r.code === 'expired') return 'No hay un código vigente. Si la persona quiere, vuelve a pedir uno con vincular_cuenta.'
    const remaining = r.code === 'wrong' ? r.remaining : 0
    return `Código incorrecto. Quedan ${remaining} intento${remaining === 1 ? '' : 's'}.`
  }
  ctx.userId = r.userId
  return `Conversación vinculada a la cuenta de ${r.name ?? 'la persona'} (${r.role === 'PARTNER' ? 'socio' : 'cliente'}). Ya puedes usar las herramientas de su cuenta.`
}

// ─── Executor ───────────────────────────────────────────────────────────────

export async function runPlatformTool(name: PlatformToolName, rawInput: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const entry = PLATFORM_TOOLS[name]
  let input = rawInput
  if (entry.group === 'identity') return runIdentity(name, input, ctx)
  if (!entry.writes) return runRead(name, input, ctx)

  const actor = await actorFor(ctx)
  if (!actor) return NOT_LINKED
  const origin = originFor(ctx)

  // Availability toggles right away: no money, no commitment
  if (name === 'cambiar_disponibilidad') {
    if (!actor.partnerId) return NOT_PARTNER
    const on = Boolean(input.disponible)
    const summary = on ? 'Marcar al socio como disponible' : 'Marcar al socio como no disponible'
    if (ctx.mode === 'playground' || !ctx.conversationId) return dryRunText(summary, 'la disponibilidad del socio')
    if (ctx.mode === 'copilot') { await recordAction({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agent: ctx.agent, tool: name, summary, input, status: 'awaiting_approval' }); return awaitingApprovalText(summary) }
    try {
      await setAvailability(actor, on, origin)
      await recordAction({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agent: ctx.agent, tool: name, summary, input, status: 'executed', entityType: 'PartnerProfile', entityId: actor.partnerId })
      await leaveTrail({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agent: ctx.agent, tool: name, summary, entityType: 'PartnerProfile', entityId: actor.partnerId, origin })
      return on ? 'Listo: ahora aparece como disponible y recibe solicitudes.' : 'Listo: ahora aparece como no disponible; no recibirá solicitudes hasta que vuelva a activarse.'
    } catch (err) {
      return failText(err)
    }
  }

  // Tool calls are not in the chat history, so after the person's yes models tend to propose again
  // (confirmado: false) and ask forever. A plain yes to a proposal from an earlier turn confirms exactly
  // what the person was shown.
  let proposed: Awaited<ReturnType<typeof latestProposed>> = null
  let acceptedByYes = false
  if (entry.confirm && ctx.mode === 'autopilot' && ctx.conversationId) {
    await expireStaleProposals(ctx.conversationId)
    proposed = await latestProposed(ctx.conversationId, name)
    if (proposed && ctx.personText && isClearYes(ctx.personText) && proposed.createdAt < (ctx.turnStartedAt ?? new Date()) && sameActionCore(proposed.input, rawInput)) {
      acceptedByYes = true
      input = { ...(proposed.input as Record<string, unknown>), confirmado: true }
    }
  }

  const planner = PLANNERS[name]
  if (!planner) return `Herramienta "${name}" no disponible.`
  const plan = await planner(input, ctx, actor)
  if ('error' in plan) {
    if (plan.error === '__MP__') return mercadoPagoText(actor, s(input, 'reserva_ref'))
    return plan.error
  }

  if (ctx.mode === 'playground' || !ctx.conversationId) return dryRunText(plan.summary, plan.wouldRecord, !entry.confirm || input.confirmado === true)
  const conversationId = ctx.conversationId
  const base = { workspaceId: ctx.workspaceId, conversationId, agent: ctx.agent, tool: name, input }

  if (await overDailyLimit(conversationId, name)) {
    ctx.state.handoff = { reason: `Tope diario de ${name}` }
    return LIMIT_REACHED_TEXT
  }
  if (ctx.mode === 'copilot') {
    await recordAction({ ...base, summary: plan.summary, status: 'awaiting_approval' })
    return awaitingApprovalText(plan.summary)
  }

  const gate = !entry.confirm || acceptedByYes ? 'run' : confirmationGate({ confirmado: input.confirmado === true, proposedAt: proposed?.createdAt ?? null, sameInput: proposed ? sameActionInput(proposed.input, input) : undefined })
  if (gate === 'mismatch') {
    if (proposed) await settleAction(proposed.id, { status: 'expired', result: 'La confirmación traía otros datos' })
    return MISMATCH_CONFIRMATION_TEXT
  }
  if (gate === 'ask') {
    if (proposed) await settleAction(proposed.id, { status: 'expired' })
    await recordAction({ ...base, summary: plan.summary, status: 'proposed' })
    return askConfirmationText(plan.summary)
  }
  if (gate === 'stale') return STALE_CONFIRMATION_TEXT

  try {
    const done = await plan.run()
    if (proposed) await settleAction(proposed.id, { status: 'executed', result: done.text, entityType: done.entityType, entityId: done.entityId })
    else await recordAction({ ...base, summary: plan.summary, status: 'executed', result: done.text, entityType: done.entityType, entityId: done.entityId })
    await leaveTrail({ workspaceId: ctx.workspaceId, conversationId, agent: ctx.agent, tool: name, summary: plan.summary, entityType: done.entityType, entityId: done.entityId, origin })
    return done.text
  } catch (err) {
    const text = failText(err)
    if (proposed) await settleAction(proposed.id, { status: 'failed', result: text })
    else await recordAction({ ...base, summary: plan.summary, status: 'failed', result: text })
    return text
  }
}

function failText(err: unknown) {
  if (err instanceof OpsError) return `No se pudo: ${err.message} Explícaselo a la persona con tus palabras.`
  return 'No se pudo completar la acción ahora. Dile a la persona que el equipo lo revisará y traspasa la conversación si insiste.'
}

async function mercadoPagoText(actor: Actor, ref: string) {
  const b = await bookingByRef(actor, ref)
  if (!b) return 'Esa referencia no corresponde a ninguna reserva de esta persona.'
  try {
    const link = await mercadoPagoLinkFor(actor, b.id)
    return `Enlace de pago en línea por ${cop(link.total)}: ${link.url} . Pásaselo tal cual; al pagar, la reserva queda pagada automáticamente.`
  } catch (err) {
    return failText(err)
  }
}

/**
 * Copilot: a person approved an awaiting action from the inbox. Re-plans with the stored input (so the
 * checks run again on current data) and executes with chat origin.
 */
export async function executeApprovedAction(actionId: string, adminId: string): Promise<{ ok: boolean; text: string }> {
  const action = await prisma.aiAgentAction.findUnique({ where: { id: actionId }, include: { conversation: { select: { id: true, channel: true, workspaceId: true, userId: true, contactName: true, contactPhone: true } } } })
  if (!action || action.status !== 'awaiting_approval') return { ok: false, text: 'La acción ya no está pendiente.' }
  const name = action.tool as PlatformToolName
  const entry = PLATFORM_TOOLS[name]
  const ctx: ToolContext = {
    agent: { id: action.agentId, name: action.agentName ?? 'Agente', tools: [name], crmModules: [], webhookUrl: null },
    workspaceId: action.workspaceId, conversationId: action.conversationId, userId: action.conversation.userId,
    contact: { name: action.conversation.contactName, phone: action.conversation.contactPhone, channel: action.conversation.channel },
    dryRun: false, mode: 'autopilot', state: { handoff: null, chosenOutput: null, chunks: [] },
  }
  const input = (action.input ?? {}) as Record<string, unknown>
  const actor = await actorFor(ctx)
  if (!actor) { await settleAction(actionId, { status: 'failed', result: NOT_LINKED, resolvedById: adminId }); return { ok: false, text: NOT_LINKED } }
  const origin = originFor(ctx)
  try {
    if (name === 'cambiar_disponibilidad') {
      if (!actor.partnerId) throw new OpsError(NOT_PARTNER)
      await setAvailability(actor, Boolean(input.disponible), origin)
      await settleAction(actionId, { status: 'executed', result: 'Disponibilidad cambiada', entityType: 'PartnerProfile', entityId: actor.partnerId, resolvedById: adminId })
      await leaveTrail({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId!, agent: ctx.agent, tool: name, summary: action.summary, entityType: 'PartnerProfile', entityId: actor.partnerId, origin })
      return { ok: true, text: 'Disponibilidad cambiada.' }
    }
    if (!entry?.writes || entry.group === 'identity') throw new OpsError('Esta acción no se aprueba desde la bandeja.')
    const planner = PLANNERS[name]
    if (!planner) throw new OpsError('Herramienta desconocida')
    const plan = await planner(input, ctx, actor)
    if ('error' in plan) throw new OpsError(plan.error === '__MP__' ? 'El enlace de MercadoPago se pide desde el chat.' : plan.error)
    const done = await plan.run()
    await settleAction(actionId, { status: 'executed', result: done.text, entityType: done.entityType, entityId: done.entityId, resolvedById: adminId })
    await leaveTrail({ workspaceId: ctx.workspaceId, conversationId: ctx.conversationId!, agent: ctx.agent, tool: name, summary: action.summary, entityType: done.entityType, entityId: done.entityId, origin })
    return { ok: true, text: done.text }
  } catch (err) {
    const text = err instanceof OpsError ? err.message : 'No se pudo completar la acción'
    await settleAction(actionId, { status: 'failed', result: text, resolvedById: adminId })
    return { ok: false, text }
  }
}
