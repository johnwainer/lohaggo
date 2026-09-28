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
import { expireStaleProposals, leaveTrail, overDailyLimit, proposedInWindow, recordAction, settleAction } from '@/lib/ai/actions'
import { chatOrigin, OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { fmtDate } from '@/lib/ai/platform-data'
import { addRequestPhotos, cancelServiceRequest, createServiceRequest, isRequestExpired, listClientRequests, listOpenRequestsForPartner, partnerAvailabilitySummary, partnersForService, reactivateServiceRequest, requestSummaryForChat } from '@/lib/service-requests/ops'
import { acceptProposal, createProposal, listProposalsForClient, proposalSummaryForChat } from '@/lib/proposals/ops'
import { bookingsFor, bookingSummaryForChat, bookingWhen, rescheduleBooking, transitionBooking } from '@/lib/bookings/ops'
import { confirmPartnerPayment, mercadoPagoLinkFor, paymentSummaryForChat, rejectPartnerPayment, reportClientPayment } from '@/lib/payments/ops'
import { leaveReview } from '@/lib/reviews/ops'
import { addBankAccount, fetchAttachmentForDocument, partnerByUser, partnerStatusSummary, setAvailability, uploadDocument, upsertPartnerService } from '@/lib/partners/ops'
import { confirmLink, startLink } from '@/lib/accounts/link'
import { openGuaranteeClaim } from '@/lib/guarantee/ops'
import { CHAT_MESSAGE_MAX, chatRef, PHOTO_ONLY_TEXT, resolveChatByRef, sendChatMessage, takeUnreadMessages } from '@/lib/chat/ops'
import { detectContactInfo } from '@/lib/chat/contact-guard'
import { CHAT_PHOTO_WINDOW_MS, recentInboundPhotos, storeChatPhotos } from '@/lib/chat/photos'
import { LOGIN_LINK_TTL_MIN, sendLoginLinkFromChat } from '@/lib/accounts/login-link'
import { ACCESS_LINK_TTL_H, sendAccessLink } from '@/lib/accounts/access-link'
import { toE164 } from '@/lib/inbox/contacts'
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
  | 'agregar_fotos'
  | 'enviar_mensaje_reserva'
  | 'ver_mensajes_reserva'
  | 'enviar_enlace_acceso'
  | 'pedir_de_nuevo'

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
    guidance: `Úsala solo después de tener: servicio del catálogo, dirección completa, fecha y hora (o urgente) y una descripción de lo que necesita. Pregunta una cosa a la vez. ${CONFIRM_RULE} ${NEEDS_LINK} Si la persona mandó fotos de lo que necesita en este chat (mensajes «📷 Imagen»), pon incluir_fotos: true y dile que van con la solicitud; nunca digas que hay fotos si no las mandó.`,
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
        incluir_fotos: { type: 'boolean', description: 'true para adjuntar las fotos que la persona mandó en este chat (últimas 24 h)' },
        confirmado,
      },
      required: ['servicio', 'direccion', 'ciudad', 'fecha', 'hora', 'urgente', 'detalles', 'presupuesto', 'socio_ref', 'incluir_fotos', 'confirmado'],
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
    guidance: `${CONFIRM_RULE} Antes de proponer, explícale la política que aplica según la hora del servicio. Pregunta el motivo y pásalo como una frase (al menos 5 letras; el socio lo verá). ${NEEDS_LINK}`,
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
    description: 'Envía la propuesta del socio a una solicitud: precio, nota y, si quiere, el día y la hora en que puede ir (al aceptarla, la reserva queda para ese momento).',
    guidance: `Usa la referencia de ver_oportunidades. El precio debe ser al menos el precio base del servicio. Pregúntale qué día y a qué hora puede ir: si lo dice, pásalo en fecha y hora; si no, déjalos vacíos. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'partner', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { solicitud_ref: REF, precio: { type: 'number', description: 'Precio total en pesos' }, nota: str('Qué incluye, con sus palabras'), fecha: str('Día que propone ir, YYYY-MM-DD, o vacío'), hora: str('Hora que propone, HH:mm (24 h), o vacío'), confirmado }, required: ['solicitud_ref', 'precio', 'nota', 'fecha', 'hora', 'confirmado'], additionalProperties: false }),
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
  pedir_de_nuevo: {
    label: 'Pedir de nuevo al mismo socio',
    description: 'Crea una solicitud directa al socio de una reserva completada, con el mismo servicio y dirección (se pueden cambiar), para la fecha que diga el cliente o urgente.',
    guidance: `Úsala cuando el cliente quiera repetir un servicio con el mismo socio (por ejemplo, pulsó «Pedir de nuevo» en un aviso). Toma la referencia de ver_mis_reservas. Pregunta para cuándo (fecha y hora, o urgente) y si la dirección es la misma. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'client', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        reserva_ref: REF,
        urgente: { type: 'boolean', description: 'true si lo necesita lo antes posible' },
        fecha: str('YYYY-MM-DD, o vacío si es urgente'),
        hora: str('HH:mm (24 h), o vacío'),
        direccion: str('Dirección si cambia, o vacío para usar la de la reserva'),
        detalles: str('Qué necesita esta vez, o vacío'),
        confirmado,
      },
      required: ['reserva_ref', 'urgente', 'fecha', 'hora', 'direccion', 'detalles', 'confirmado'],
      additionalProperties: false,
    }),
  },
  agregar_fotos: {
    label: 'Agregar fotos a una solicitud o reserva',
    description: 'Guarda en la solicitud (y en el chat de la reserva, si ya hay socio) las fotos que el cliente mandó por este chat, para que el socio las vea.',
    guidance: `Úsala cuando el cliente mande fotos de lo que necesita después de crear la solicitud, o pida que se las pases al socio. Solo cuenta las fotos nuevas de este chat (mensajes «📷 Imagen», con o sin texto); si no hay, pídele que las envíe primero. Si mandó la misma foto varias veces o solo quiere algunas, usa cantidad con cuántas de las últimas agregar. Para crear una solicitud nueva con fotos usa crear_solicitud con incluir_fotos. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'booking_chat', platform: true, confirm: true,
    schema: () => ({ type: 'object', properties: { ref: str('Referencia de la solicitud, la propuesta o la reserva (de ver_propuestas o ver_mis_reservas)'), cantidad: { type: 'integer', minimum: 0, maximum: 10, description: 'Cuántas de las últimas fotos agregar (0 = todas las nuevas)' }, confirmado }, required: ['ref', 'cantidad', 'confirmado'], additionalProperties: false }),
  },
  enviar_mensaje_reserva: {
    label: 'Enviar mensaje al chat de la reserva',
    description: 'Escribe en el chat de una propuesta o reserva a nombre de la persona (cliente → socio o socio → cliente), con fotos de este chat si quiere. Queda guardado en la reserva y le llega a la otra parte por WhatsApp o por la app.',
    guidance: `Úsala cuando la persona quiera decirle algo al socio (si es cliente) o al cliente (si es socio) sobre una solicitud o reserva, o responda a un mensaje que le reenviamos («💬 … te escribió sobre … · ref …»: usa esa ref). Escribe el mensaje con sus palabras, sin inventar ni agregar nada. No se pueden enviar teléfonos, correos, redes ni pedir contacto por fuera: si lo intenta, explícale que por seguridad todo va por LoHaggo. Si quiere mandar fotos, que las envíe aquí primero y pon incluir_fotos: true. ${CONFIRM_RULE} ${NEEDS_LINK}`,
    writes: true, group: 'booking_chat', platform: true, confirm: true,
    schema: () => ({
      type: 'object',
      properties: {
        ref: str('Referencia de la reserva, la propuesta o la solicitud'),
        mensaje: str('El mensaje con las palabras de la persona (puede ir vacío si solo manda fotos)'),
        incluir_fotos: { type: 'boolean', description: 'true para enviar también las fotos nuevas que mandó en este chat' },
        confirmado,
      },
      required: ['ref', 'mensaje', 'incluir_fotos', 'confirmado'],
      additionalProperties: false,
    }),
  },
  ver_mensajes_reserva: {
    label: 'Ver mensajes nuevos del chat de la reserva',
    description: 'Mensajes que el socio o el cliente le escribió a la persona en el chat de sus reservas y aún no ha leído (quedan leídos).',
    guidance: `Úsala cuando el contexto diga que tiene mensajes sin leer, cuando responda a nuestro aviso «te escribió sobre…», o cuando pregunte si el socio o el cliente le dijo algo. Léeselos con el nombre de quien escribe y la referencia, y pregúntale si quiere responder (con enviar_mensaje_reserva). ${NEEDS_LINK}`,
    writes: false, group: 'booking_chat', platform: true,
    schema: () => ({ type: 'object', properties: { ref: str('Referencia de una reserva o propuesta en concreto, o vacío para todas') }, required: ['ref'], additionalProperties: false }),
  },
  enviar_enlace_acceso: {
    label: 'Enviar enlace para entrar (magic link)',
    description: 'Envía al correo registrado de la cuenta un enlace para entrar a LoHaggo sin contraseña (vence en 1 hora, un solo uso). El enlace nunca llega a este chat.',
    guidance: 'Úsala cuando la persona no pueda entrar a la app, olvidó su contraseña o pida un enlace para entrar. Si la conversación está vinculada, llámala con dato vacío: va al correo de su cuenta. Si no lo está, pídele el correo o el teléfono con el que se registró. El enlace llega SOLO al correo registrado (así sabemos que es ella): dile que lo abra desde ese correo, que revise spam y que vence en 1 hora. Nunca pidas ni escribas el enlace en el chat. Si no está vinculada, no afirmes que la cuenta existe.',
    writes: true, group: 'identity', platform: true,
    schema: () => ({ type: 'object', properties: { dato: str('Correo o teléfono con el que se registró, o vacío si la conversación está vinculada') }, required: ['dato'], additionalProperties: false }),
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

/** Chat photos not yet sent anywhere: since the last executed photo action of this conversation, max 24 h. */
async function newChatPhotos(conversationId: string) {
  const last = await prisma.aiAgentAction.findFirst({
    where: { conversationId, status: 'executed', tool: { in: ['crear_solicitud', 'agregar_fotos', 'enviar_mensaje_reserva', 'reportar_problema_servicio'] } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const dayAgo = new Date(Date.now() - CHAT_PHOTO_WINDOW_MS)
  return recentInboundPhotos(conversationId, { since: last && last.createdAt > dayAgo ? last.createdAt : dayAgo })
}
const photosText = (n: number) => (n === 1 ? '1 foto' : `${n} fotos`)

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
    const photos = input.incluir_fotos && ctx.conversationId && ctx.mode !== 'playground' ? await newChatPhotos(ctx.conversationId) : []
    const summary = `Crear solicitud de ${service.name} en ${address} (${city}) para ${when}${budget ? `, presupuesto ${cop(budget)}` : ''}${partnerId ? ', dirigida a un socio en concreto' : ''}${photos.length ? `, con ${photosText(photos.length)} del chat` : ''}`
    return {
      summary,
      wouldRecord: 'una solicitud de servicio (ServiceRequest) y las notificaciones a los socios',
      run: async () => {
        const stored = photos.length ? await storeChatPhotos(photos.map((ph) => ph.mediaUrl), 'lohaggo/service-requests') : { urls: [], failed: 0 }
        const sr = await createServiceRequest(actor, {
          serviceId: service.id, address, city, notes: s(input, 'detalles') || undefined, budget: budget || undefined,
          preferredDate: urgent && !fecha ? null : fecha, preferredTime: hora || null, isUrgent: urgent, partnerId, photoUrls: stored.urls,
        }, originFor(ctx))
        const photoNote = stored.urls.length ? ` Van ${photosText(stored.urls.length)}.` : ''
        const failNote = stored.failed ? ` ${photosText(stored.failed)} no se pudieron guardar (formato no válido o muy pesadas): pídele que las reenvíe y usa agregar_fotos.` : ''
        return { text: `Solicitud creada (ref ${shortId(sr.id)}).${photoNote} Los socios verificados de ${city} ya la recibieron; las propuestas llegarán a este chat y a la app. Dile que puede preguntarte por ellas en un rato.${failNote}`, entityType: 'ServiceRequest', entityId: sr.id }
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
    // The motive is required (the partner reads it): ask for it before the yes, not after
    if (s(input, 'motivo').length < 5) return { error: 'Falta el motivo de la cancelación: pregúntale por qué cancela (en una frase) y vuelve a proponer.' }
    return {
      summary: `Cancelar la reserva de ${b.service?.name ?? 'servicio'} (ref ${shortId(b.id)}) por «${s(input, 'motivo')}», aplicando la política de cancelación`,
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
    const fecha = s(input, 'fecha')
    const hora = s(input, 'hora')
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'La fecha va como YYYY-MM-DD (o vacía).' }
    if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return { error: 'La hora va como HH:mm en 24 h (o vacía).' }
    return {
      summary: `Enviar propuesta de ${cop(price)} a la solicitud de ${r.service?.name ?? 'servicio'} (ref ${shortId(r.id)})${fecha ? ` para el ${fecha}${hora ? ` a las ${hora}` : ''}` : ''}${s(input, 'nota') ? ` con la nota «${s(input, 'nota')}»` : ''}`,
      wouldRecord: 'la propuesta (Proposal) y el aviso al cliente',
      run: async () => {
        const p = await createProposal(actor, { serviceRequestId: r.id, price, notes: s(input, 'nota') || undefined, proposedDate: fecha || null, proposedTime: fecha && hora ? hora : null }, originFor(ctx))
        return { text: `Propuesta enviada (ref ${shortId(p.id)}).${fecha ? ' Si el cliente la acepta, la reserva queda para la fecha que propusiste.' : ''} El cliente ya la ve; le avisaremos si la acepta.`, entityType: 'Proposal', entityId: p.id }
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
  pedir_de_nuevo: async (input, ctx, actor) => {
    const b = await bookingByRef(actor, s(input, 'reserva_ref'))
    if (!b || b.userId !== actor.userId) return { error: 'Esa referencia no corresponde a ninguna reserva de este cliente. Consulta ver_mis_reservas.' }
    if (b.status !== 'COMPLETED' || !b.partnerId) return { error: 'Solo se pide de nuevo un servicio ya completado con un socio.' }
    const urgent = input.urgente === true
    const fecha = s(input, 'fecha')
    const hora = s(input, 'hora')
    if (!urgent && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Falta la fecha (YYYY-MM-DD) o marcarla como urgente.' }
    if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return { error: 'La hora va como HH:mm en 24 h (o vacía).' }
    const address = s(input, 'direccion') || b.address
    const service = b.service?.name ?? 'servicio'
    const partnerName = b.partner?.user?.name ?? 'el mismo socio'
    const when = urgent ? 'lo antes posible (urgente)' : `${fecha}${hora ? ` a las ${hora}` : ''}`
    return {
      summary: `Pedir de nuevo ${service} a ${partnerName} en ${address} para ${when}`,
      wouldRecord: 'una solicitud directa a ese socio (ServiceRequest) y su aviso',
      run: async () => {
        const sr = await createServiceRequest(actor, {
          serviceId: b.serviceId, address, city: b.city, partnerId: b.partnerId,
          notes: s(input, 'detalles') || `Pedido de nuevo (reserva ${shortId(b.id)})`,
          preferredDate: urgent && !fecha ? null : fecha, preferredTime: hora || null, isUrgent: urgent,
        }, originFor(ctx))
        return { text: `Solicitud directa creada (ref ${shortId(sr.id)}): ${partnerName} ya recibió el aviso y te mandará su propuesta.`, entityType: 'ServiceRequest', entityId: sr.id }
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
        const stored = photo?.mediaUrl ? await storeChatPhotos([photo.mediaUrl], 'lohaggo/guarantee') : { urls: [], failed: 0 }
        const claim = await openGuaranteeClaim(actor, { bookingId: b.id, type, description, photoUrls: stored.urls }, originFor(ctx))
        const due = fmtDate(claim.slaDueAt)
        if (type === 'DAMAGE') ctx.state.handoff = { reason: 'Garantía: daño a la propiedad (caso de seguridad)' }
        const next = type === 'DAMAGE'
          ? 'Una persona del equipo continúa esta conversación para mediar con el socio y documentar el caso. No prometas dinero: LoHaggo media, no paga daños.'
          : `El equipo propone una solución en máximo ${SLA_PROPOSAL_HOURS} h (otro socio con prioridad, cancelación sin costo o que el mismo socio corrija) y lo resuelve en máximo ${SLA_RESOLUTION_HOURS} h. No prometas dinero ni un remedio en concreto.`
        return { text: `Reclamo de garantía registrado (ref ${shortId(claim.id)}), con plazo de solución hasta ${due}. ${next}`, entityType: 'GuaranteeClaim', entityId: claim.id }
      },
    }
  },

  agregar_fotos: async (input, ctx, actor) => {
    if (actor.role !== 'CLIENT') return { error: 'Solo el cliente agrega fotos a su solicitud. Si es socio y quiere mandar fotos al cliente, usa enviar_mensaje_reserva con incluir_fotos.' }
    const ref = s(input, 'ref').replace(/^#/, '')
    if (!/^[a-z0-9]{4,30}$/i.test(ref)) return { error: 'Esa referencia no es válida. Consulta ver_propuestas o ver_mis_reservas.' }
    const requests = await prisma.serviceRequest.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, service: { select: { name: true } }, proposals: { select: { id: true, status: true, bookings: { select: { id: true } } } } },
    })
    const sr = requests.find((r) => r.id.endsWith(ref) || r.proposals.some((p) => p.id.endsWith(ref) || p.bookings.some((b) => b.id.endsWith(ref))))
    if (!sr) return { error: 'Esa referencia no corresponde a ninguna solicitud ni reserva de esta persona.' }
    const all = ctx.conversationId && ctx.mode !== 'playground' ? await newChatPhotos(ctx.conversationId) : []
    const cantidad = Math.max(0, Math.floor(n(input, 'cantidad')))
    const photos = cantidad ? all.slice(-cantidad) : all
    if (!photos.length && ctx.mode !== 'playground') return { error: 'No hay fotos nuevas en este chat. Pídele que las envíe aquí primero y vuelve a intentarlo.' }
    const accepted = sr.proposals.find((p) => p.status === 'ACCEPTED')
    return {
      summary: `Agregar ${photosText(photos.length || 1)} del chat a la solicitud de ${sr.service.name} (ref ${shortId(sr.id)})${accepted ? ' y enviarlas al socio por el chat de la reserva' : ''}`,
      wouldRecord: 'las fotos en la solicitud (RequestPhoto) y, si hay reserva, en su chat',
      run: async () => {
        const stored = await storeChatPhotos(photos.map((ph) => ph.mediaUrl), 'lohaggo/service-requests')
        if (!stored.urls.length) throw new OpsError('No se pudo guardar ninguna foto (deben ser JPG, PNG o WebP de hasta 8 MB).')
        const added = await addRequestPhotos(actor, sr.id, stored.urls)
        let toPartner = false
        if (accepted) {
          const chat = await resolveChatByRef(actor, accepted.id.slice(-6))
          for (const url of stored.urls.slice(0, added.added)) {
            const r = await sendChatMessage(actor, chat.id, { content: '', imageUrl: url }, originFor(ctx))
            if (!r.blocked) toPartner = true
          }
        }
        const skipped = added.skipped ? ` ${photosText(added.skipped)} no cupieron (máximo 10 por solicitud).` : ''
        const failed = stored.failed ? ` ${photosText(stored.failed)} no se pudieron guardar.` : ''
        return { text: `Listo: ${photosText(added.added)} agregadas a la solicitud${toPartner ? ' y enviadas al socio por el chat de la reserva' : ''}.${skipped}${failed}`, entityType: 'ServiceRequest', entityId: sr.id }
      },
    }
  },

  enviar_mensaje_reserva: async (input, ctx, actor) => {
    let chat: Awaited<ReturnType<typeof resolveChatByRef>>
    try {
      chat = await resolveChatByRef(actor, s(input, 'ref'))
    } catch (err) {
      if (err instanceof OpsError) return { error: `${err.message} Consulta ver_mis_reservas o ver_propuestas para la referencia.` }
      throw err
    }
    const text = s(input, 'mensaje')
    if (text.length > CHAT_MESSAGE_MAX) return { error: `El mensaje es muy largo (máximo ${CHAT_MESSAGE_MAX} caracteres).` }
    const contact = text ? detectContactInfo(text) : { isValid: true as const }
    if (!contact.isValid) return { error: `El mensaje trae ${contact.reason}: por seguridad no se envían datos de contacto por el chat de la reserva. Explícale que toda la comunicación va por LoHaggo y pregúntale cómo quiere decirlo.` }
    const photos = input.incluir_fotos && ctx.conversationId && ctx.mode !== 'playground' ? await newChatPhotos(ctx.conversationId) : []
    if (!text && !photos.length) return { error: 'No hay mensaje ni fotos nuevas para enviar.' }
    const isClient = chat.clientId === actor.userId
    const other = isClient ? `el socio ${chat.partner.user.name}` : `el cliente ${chat.client.name}`
    const service = chat.serviceRequest?.service?.name ?? 'el servicio'
    return {
      summary: `Enviar a ${other}, en el chat de ${service} (ref ${chatRef(chat)}): ${text ? `«${text}»` : ''}${photos.length ? `${text ? ' ' : ''}con ${photosText(photos.length)}` : ''}`,
      wouldRecord: 'el mensaje en el chat de la reserva (ChatMessage, origen chat) y el aviso a la otra parte',
      run: async () => {
        const stored = photos.length ? await storeChatPhotos(photos.map((ph) => ph.mediaUrl), 'lohaggo/chat') : { urls: [], failed: 0 }
        const first = await sendChatMessage(actor, chat.id, { content: text, imageUrl: stored.urls[0] ?? null }, originFor(ctx))
        if (first.blocked) throw new OpsError(`El mensaje se bloqueó por traer ${first.reason}.`)
        for (const url of stored.urls.slice(1)) await sendChatMessage(actor, chat.id, { content: '', imageUrl: url }, originFor(ctx))
        const how = first.delivery === 'whatsapp' ? 'le llegó por WhatsApp' : first.delivery === 'template' ? 'le avisamos por WhatsApp y en la app' : 'le llegó a la app'
        const failed = stored.failed ? ` ${photosText(stored.failed)} no se pudieron enviar (formato no válido o muy pesadas).` : ''
        return { text: `Mensaje enviado a ${other} y guardado en el chat de la reserva (${how}).${failed} Cuando responda, se lo haremos llegar.`, entityType: 'Chat', entityId: chat.id }
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
  if (name === 'ver_mensajes_reserva') {
    if (ctx.mode === 'playground') return 'Simulado en pruebas: aquí aparecerían los mensajes sin leer del chat de sus reservas (quién, referencia y texto).'
    const ref = s(input, 'ref')
    let chatId: string | undefined
    if (ref) {
      try {
        chatId = (await resolveChatByRef(actor, ref)).id
      } catch (err) {
        if (err instanceof OpsError) return err.message
        throw err
      }
    }
    const rows = await takeUnreadMessages(actor, { chatId })
    if (!rows.length) return ref ? 'No tiene mensajes sin leer en ese chat.' : 'No tiene mensajes sin leer en los chats de sus reservas.'
    return rows.map((m) => `- ${m.from} · ${m.service} (ref ${m.ref}) · ${fmtDate(m.at)}: ${m.content === PHOTO_ONLY_TEXT ? '(envió una foto; puede verla en la app)' : `«${m.content}»${m.imageUrl ? ' (con una foto; puede verla en la app)' : ''}`}`).join('\n')
  }
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
    if (name === 'enviar_enlace_acceso') return `Enlace enviado (simulado en pruebas) al correo registrado de la cuenta. Dile que lo abra desde ese correo, que revise spam y que vence en ${LOGIN_LINK_TTL_MIN} minutos.`
    if (name === 'vincular_cuenta') return 'Código enviado (simulado en pruebas) al teléfono o correo de la cuenta. Pídele los 6 dígitos.'
    if (!/^\d{6}$/.test(s(input, 'codigo'))) return 'Código incorrecto (simulado en pruebas): deben ser 6 dígitos.'
    ctx.userId = PLAYGROUND_USER
    return 'Código comprobado (simulado en pruebas): conversación vinculada a una cuenta de cliente de prueba. Ya puedes usar las herramientas de su cuenta.'
  }
  const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { contactId: true, userId: true, workspaceId: true, channel: true, contactPhone: true } })
  if (name === 'enviar_enlace_acceso' && conv?.userId && conv.channel === 'WHATSAPP') {
    // Writing from the account's own number proves the phone: the link goes to this WhatsApp (B2 / C2)
    const owner = await prisma.user.findUnique({ where: { id: conv.userId }, select: { phone: true } })
    if (owner?.phone && toE164(owner.phone) === toE164(conv.contactPhone)) {
      const r = await sendAccessLink(conv.userId, { phoneTrusted: true })
      if (r.ok) {
        await prisma.conversationEvent.create({ data: { conversationId: ctx.conversationId, type: 'login_link', actorType: 'ai', actorId: ctx.agent.id, actorName: ctx.agent.name, detail: `Enlace de acceso por ${r.via === 'whatsapp' ? 'WhatsApp' : 'correo'}` } })
        return r.via === 'whatsapp'
          ? `Enlace enviado a este WhatsApp como mensaje aparte con el botón «Entrar». Vence en ${ACCESS_LINK_TTL_H} horas y solo sirve una vez. No escribas ningún enlace en el chat.`
          : `Enlace enviado al correo registrado de la cuenta (vence en ${ACCESS_LINK_TTL_H} horas). Dile que revise spam. No escribas ningún enlace en el chat.`
      }
      if (r.reason === 'limit') return 'Ya se enviaron varios enlaces a esta cuenta en la última hora: dile que use el último que le llegó.'
    }
  }
  if (name === 'enviar_enlace_acceso') {
    const r = await sendLoginLinkFromChat({ conversationId: ctx.conversationId, userId: conv?.userId ?? null, given: s(input, 'dato'), actor: { id: ctx.agent.id, name: ctx.agent.name } })
    if (!r.ok) {
      if (r.code === 'invalid' && !conv?.userId) return 'Pídele el correo o el teléfono con el que se registró y vuelve a llamarla.'
      if (r.code === 'limit') return `${r.error} No lo intentes de nuevo hoy: dile que use el enlace que ya le llegó o «Olvidé mi contraseña» en lohaggo.com.`
      return `${r.error} Dile que entre en lohaggo.com con «Olvidé mi contraseña», o ofrece que una persona del equipo lo ayude.`
    }
    const where = r.sentTo ? `al correo ${r.sentTo}` : 'al correo registrado en esa cuenta'
    return conv?.userId
      ? `Enlace enviado ${where}. Dile que lo abra desde ese correo (revise spam), que vence en ${LOGIN_LINK_TTL_MIN} minutos y solo sirve una vez. Nunca escribas un enlace en el chat.`
      : `Si esos datos corresponden a una cuenta de LoHaggo, el enlace llegó ${where} (vence en ${LOGIN_LINK_TTL_MIN} minutos, un solo uso). Dile que revise ese correo y spam. No confirmes ni niegues que la cuenta existe.`
  }
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
  // Several proposals of the same tool can wait at once (a message to each of three partners): the one
  // this call is about is the one with the same content, not merely the latest.
  let proposed: Awaited<ReturnType<typeof proposedInWindow>>[number] | null = null
  let open: Awaited<ReturnType<typeof proposedInWindow>> = []
  let acceptedByYes = false
  if (entry.confirm && ctx.mode === 'autopilot' && ctx.conversationId) {
    await expireStaleProposals(ctx.conversationId)
    open = await proposedInWindow(ctx.conversationId, name)
    const match = open.find((p) => sameActionCore(p.input, rawInput)) ?? null
    proposed = match ?? (open.length === 1 ? open[0] : null)
    if (match && ctx.personText && isClearYes(ctx.personText) && match.createdAt < (ctx.turnStartedAt ?? new Date())) {
      acceptedByYes = true
      input = { ...(match.input as Record<string, unknown>), confirmado: true }
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
    // Proposing the same thing again replaces it; other open proposals keep waiting for their yes
    if (proposed && sameActionCore(proposed.input, input)) await settleAction(proposed.id, { status: 'expired' })
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
