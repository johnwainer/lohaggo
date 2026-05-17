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
