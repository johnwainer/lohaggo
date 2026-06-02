import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('whatsapp-templates')

// Twilio Content SIDs — update here if templates are recreated
export const WA_TEMPLATE_SIDS = {
  bienvenida_socio:            'HX88ef315a8b8249ee92257595e322bfc8',
  booking_confirmation:        'HXe79f5eb260a7216a105a62296c7cf3dd',
  new_service_request:         'HXab6f5597617124f9d020c9b34c5bc2c7',
  recordatorio_inicio_sesion:  'HX1c79ad25a0166eaf2555372d35e0aa6e',
  verificacion_documentos:     'HX817a31ef8bdd44f9203c3b44d8eaa630',
  referir_socios:              'HXfbedddc80b9a6b67318d979bb8d0e5ca',
  nueva_solicitud_socio:       'HXe18c06820756acaa4c0e7429afa615b5',
  solicitud_enviada_cliente:   'HX0e5c753b79f2bae5d43e47cfa8bc653a',
  propuesta_aceptada_socio:    'HX776080bcaaf2bb8df475d545d33b6317',
  reserva_confirmada_cliente:  'HXcc25c4075a6e0673ceb19d4b638e6e29',
  reserva_cancelada:           'HXaea27fe8e72b1566ec5863a717fd33fc',
  reserva_completada_cliente:  'HXbf5623b3a4a150f4f50ffabd5f8d3840',
  reserva_completada_socio:    'HXa55523c6a595e03a93b36b734fb4030e',
  documentos_aprobados_wa:     'HX884290f9a4feb91eb95b8d4b018e6d32',
  documentos_rechazados_wa:    'HX362e6f86f1ff4e2fed5c82056fd90148',
  socio_activado_wa:           'HX7078001d6609526ee800dfe4483a6735',
  // Flujo pago offline + recordatorios (submitted a Meta 2026-06-01, awaiting approval)
  pago_reportado_cliente:      'HXd2f1eb1095382d496492a4c4af3db6a8',
  pago_confirmado_cliente:     'HX9a5305e5b6545567ecd4811cdbc45f28',
  pago_rechazado_cliente:      'HX8c5d079325d9af4c3185056b02a16320',
  calificacion_recibida:       'HX37c3577844de7aea02f215b5467b7bb6',
  recordatorio_calificacion:   'HX44d6f0dfa7e123c08b70c60ae3d52dba',
  solicitud_por_expirar:       'HX6d5f128ce1aa1d6fcd12a59cc03c4466',
  recordatorio_servicio_manana:'HX5c0dfcfc6e33c0b65c73e003425bdbcd',
  servicio_empieza_pronto:     'HX79ef7bd9424beacfcc065e1a1655c652',
  pago_pendiente_recordatorio: 'HX636d2d69f669a521768bc67c13c033ae',
} as const

async function getTwilioCfg() {
  const config = await getMessagingProviderRuntimeConfig()
  return config.twilio
}

/** Sent automatically when a new partner registers */
export async function sendWelcomePartner(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.bienvenida_socio,
      { '1': name },
      cfg
    )
  } catch (err) {
    logger.error('sendWelcomePartner failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Booking confirmation for a partner */
export async function sendBookingConfirmation(
  phone: string,
  name: string,
  serviceType: string,
  dateTime: string
) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.booking_confirmation,
      { '1': name, '2': serviceType, '3': dateTime },
      cfg
    )
  } catch (err) {
    logger.error('sendBookingConfirmation failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** New service request alert for a partner */
export async function sendNewServiceRequest(
  phone: string,
  name: string,
  serviceType: string,
  location: string
) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.new_service_request,
      { '1': name, '2': serviceType, '3': location },
      cfg
    )
  } catch (err) {
    logger.error('sendNewServiceRequest failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Login reminder campaign */
export async function sendLoginReminder(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.recordatorio_inicio_sesion,
      {
        '1': name,
        '2': 'https://lohaggo.com/login',
        '3': 'https://lohaggo.com/olvide-mi-contrasena',
      },
      cfg
    )
  } catch (err) {
    logger.error('sendLoginReminder failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Document verification reminder campaign */
export async function sendVerificationReminder(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.verificacion_documentos,
      {
        '1': name,
        '2': 'https://lohaggo.com/partner/verification',
      },
      cfg
    )
  } catch (err) {
    logger.error('sendVerificationReminder failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** New service request alert to a partner — includes date and link to requests */
export async function sendNuevaSolicitudSocio(
  phone: string,
  partnerName: string,
  serviceType: string,
  when: string
) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.nueva_solicitud_socio,
      { '1': partnerName, '2': serviceType, '3': when },
      cfg
    )
  } catch (err) {
    logger.error('sendNuevaSolicitudSocio failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Confirmation to the client that their request has been submitted */
export async function sendSolicitudEnviadaCliente(phone: string, clientName: string, serviceType: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.solicitud_enviada_cliente,
      { '1': clientName, '2': serviceType },
      cfg
    )
  } catch (err) {
    logger.error('sendSolicitudEnviadaCliente failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Simple one-var WA sends — name only */
export async function sendDocumentosAprobados(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.documentos_aprobados_wa, { '1': name }, cfg)
  } catch (err) {
    logger.error('sendDocumentosAprobados failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendDocumentosRechazados(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.documentos_rechazados_wa, { '1': name }, cfg)
  } catch (err) {
    logger.error('sendDocumentosRechazados failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendSocioActivado(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.socio_activado_wa, { '1': name }, cfg)
  } catch (err) {
    logger.error('sendSocioActivado failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Booking-contextual sends — require service + date */
export async function sendPropuestaAceptadaSocio(phone: string, name: string, service: string, when: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.propuesta_aceptada_socio, { '1': name, '2': service, '3': when }, cfg)
  } catch (err) {
    logger.error('sendPropuestaAceptadaSocio failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendReservaConfirmadaCliente(phone: string, name: string, service: string, when: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.reserva_confirmada_cliente, { '1': name, '2': service, '3': when }, cfg)
  } catch (err) {
    logger.error('sendReservaConfirmadaCliente failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendReservaCancelada(phone: string, name: string, service: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.reserva_cancelada, { '1': name, '2': service }, cfg)
  } catch (err) {
    logger.error('sendReservaCancelada failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendReservaCompletadaCliente(phone: string, name: string, service: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.reserva_completada_cliente, { '1': name, '2': service }, cfg)
  } catch (err) {
    logger.error('sendReservaCompletadaCliente failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

export async function sendReservaCompletadaSocio(phone: string, name: string, service: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(phone, WA_TEMPLATE_SIDS.reserva_completada_socio, { '1': name, '2': service }, cfg)
  } catch (err) {
    logger.error('sendReservaCompletadaSocio failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}

/** Partner referral campaign */
export async function sendReferralInvite(phone: string, name: string) {
  try {
    const cfg = await getTwilioCfg()
    return await sendWhatsAppTemplate(
      phone,
      WA_TEMPLATE_SIDS.referir_socios,
      {
        '1': name,
        '2': 'https://lohaggo.com/unete',
      },
      cfg
    )
  } catch (err) {
    logger.error('sendReferralInvite failed', { phone, err })
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'EXCEPTION' }
  }
}
