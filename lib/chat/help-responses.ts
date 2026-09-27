/**
 * Auto-respuestas de ayuda en el chat 1:1 (cliente ↔ socio).
 *
 * Cuando uno de los participantes pregunta algo común sobre la plataforma
 * (cómo funciona, cómo se paga, etc.) generamos un mensaje SYSTEM que aparece
 * en el chat para ambas partes, con la respuesta adecuada según el ROL del
 * que preguntó.
 *
 * Importante: NO bloquea el mensaje original del usuario, solo añade una
 * respuesta de sistema a continuación.
 */

export type HelpTopic =
  | 'how_it_works'
  | 'how_to_book'
  | 'how_payment_works'
  | 'when_partner_paid'
  | 'is_payment_safe'
  | 'cancel'
  | 'rating'
  | 'why_no_contact'
  | 'support'
  | 'commission'
  | 'verification'
  | 'response_time'
  | 'problem'
  | 'photos'
  | 'how_propose'
  | 'how_receive_requests'

type Role = 'CLIENT' | 'PARTNER'

interface TopicConfig {
  /** Patrones regex para detectar la intención. Se evalúan en orden. */
  patterns: RegExp[]
  /** Respuesta según el rol del que preguntó (genérica si no hay específica). */
  responses: Partial<Record<Role, string>> & { default: string }
}

const TOPICS: Record<HelpTopic, TopicConfig> = {
  how_it_works: {
    patterns: [
      /\bc[oó]mo\s+(funciona|trabaja|opera)\b/i,
      /\bqu[eé]\s+es\s+(esto|lohaggo|haggo|la\s+plataforma|la\s+app)\b/i,
      /\bde\s+qu[eé]\s+(se\s+)?(trata|trataba)\b/i,
      /\bpara\s+qu[eé]\s+sirve\b/i,
      /\bno\s+entiendo\s+(c[oó]mo|nada|esto)\b/i,
    ],
    responses: {
      CLIENT:
        '👋 LoHaggo conecta clientes con profesionales verificados. Tú creas una solicitud, los socios envían propuestas con precio, eliges la que más te conviene, chatean para coordinar y al terminar le pagas directo al socio (efectivo o transferencia) y lo reportas en la app.',
      PARTNER:
        '👋 LoHaggo te conecta con clientes que necesitan tus servicios. Los clientes publican solicitudes en tus categorías, tú envías propuesta con tu precio, si te aceptan coordinan por chat, ejecutas el trabajo y al terminar el cliente te paga directo (efectivo o transferencia a tu cuenta).',
      default:
        'LoHaggo conecta clientes con profesionales verificados. Cliente solicita → socio propone → se acepta → se ejecuta → el cliente paga directo al socio al terminar.',
    },
  },

  how_to_book: {
    patterns: [
      /\bc[oó]mo\s+(reservo|reservar|pido|solicito|solicitar|contrato|contratar|agendo|agendar)\b/i,
      /\bc[oó]mo\s+(hago|hacer)\s+(una|el|la)\s+(reserva|solicitud|pedido)\b/i,
    ],
    responses: {
      CLIENT:
        '📅 Para reservar: 1) Entras a "Solicitar" en el menú inferior. 2) Eliges el servicio. 3) Indicas fecha, hora y dirección. 4) Recibirás propuestas de socios. 5) Aceptas la que prefieras y se confirma la reserva.',
      default:
        'Para reservar, el cliente entra a "Solicitar", elige el servicio, indica fecha/hora/dirección y recibe propuestas para elegir.',
    },
  },

  how_propose: {
    patterns: [
      /\bc[oó]mo\s+(env[ií]o|envio|mando|hago)\s+(una\s+)?(propuesta|oferta|cotizaci[oó]n)\b/i,
      /\bc[oó]mo\s+(cotizo|cotizar|oferto|ofertar)\b/i,
    ],
    responses: {
      PARTNER:
        '💼 Para enviar propuesta: 1) Entras a "Oportunidades" (FAB naranja del menú). 2) Tocas la solicitud que te interesa. 3) Defines tu precio (debe ser igual o mayor al precio base). 4) Añades notas (opcional). 5) Enviar. Si el cliente acepta, se abre la reserva y este chat.',
      default:
        'El socio envía propuesta desde "Oportunidades", indica precio y notas. Si el cliente acepta, se confirma la reserva.',
    },
  },

  how_receive_requests: {
    patterns: [
      /\bc[oó]mo\s+(recibo|me\s+llegan|consigo)\s+(las\s+)?(solicitudes|clientes|pedidos|trabajos|ofertas)\b/i,
      /\bd[oó]nde\s+(veo|encuentro)\s+(las\s+)?(solicitudes|oportunidades|trabajos)\b/i,
    ],
    responses: {
      PARTNER:
        '🔔 Recibes solicitudes en "Oportunidades" (botón naranja central del menú inferior). Te llegan automáticamente las que coinciden con los servicios de tu perfil. Activa las notificaciones para enterarte al instante. Si las recibes pronto, tienes más chance de ganar el trabajo.',
      default: 'Los socios reciben solicitudes en "Oportunidades" según los servicios de su perfil.',
    },
  },

  how_payment_works: {
    patterns: [
      /\bc[oó]mo\s+(se\s+)?(paga|pago|paga[rs]e?|cobra|cobro)\b/i,
      /\bc[oó]mo\s+funciona(n)?\s+(el|los)\s+pagos?\b/i,
      /\bd[oó]nde\s+(pago|cobro)\b/i,
      /\bm[eé]todos?\s+de\s+pago\b/i,
    ],
    responses: {
      CLIENT:
        '💳 El pago lo acuerdas directamente con el socio: efectivo o transferencia bancaria a la cuenta que el socio te indique. Reportas el pago desde la app cuando lo hagas y el socio confirma la recepción al completar el servicio.',
      PARTNER:
        '💰 El cliente te paga directamente en efectivo o por transferencia a tu cuenta bancaria. Configura tus datos bancarios en tu perfil para que el cliente pueda transferirte. Confirmas la recepción del pago desde la app al completar el servicio.',
      default:
        'El pago se realiza directamente entre cliente y socio (efectivo o transferencia). Se reporta y confirma desde la app al completar el servicio.',
    },
  },

  when_partner_paid: {
    patterns: [
      /\bcu[aá]ndo\s+me\s+(paga[ns]?|pagar[aá]n|deposit[ao]n?|llega\s+el\s+pago)\b/i,
      /\b(en\s+)?cu[aá]nto\s+tiempo\s+(me\s+)?(pagan|llega\s+el\s+pago)\b/i,
      /\bcu[aá]ndo\s+(recibo|cobro)\s+(el|mi)\s+(pago|plata|dinero)\b/i,
    ],
    responses: {
      PARTNER:
        '⏱️ El cliente te paga directo al terminar el servicio, en efectivo o por transferencia a tu cuenta. Registra tu cuenta bancaria en "Cuenta → Cuenta bancaria" para que el cliente pueda transferirte, y confirma la recepción del pago desde la app.',
      default: 'El cliente le paga directo al socio al terminar el servicio (efectivo o transferencia).',
    },
  },

  is_payment_safe: {
    patterns: [
      /\bes\s+(seguro|confiable)\s+(el|este)?\s*pago\b/i,
      /\bson\s+seguros?\s+los\s+pagos?\b/i,
      /\bme\s+van\s+a\s+estafar\b/i,
      /\bes\s+confiable\s+(esto|la\s+plataforma|lohaggo)\b/i,
    ],
    responses: {
      default:
        '🔒 El pago se hace directo entre cliente y socio al terminar el servicio (efectivo o transferencia), y se reporta y confirma en la app. No pagues por adelantado fuera de lo acordado. Si hay un problema, nuestro equipo revisa el caso con lo que quedó registrado: por eso pedimos mantener TODO dentro de la app (chat, acuerdos, reporte del pago).',
    },
  },

  cancel: {
    patterns: [
      /\bc[oó]mo\s+(cancelo|cancelar|anulo|anular)\b/i,
      /\bpuedo\s+cancelar\b/i,
      /\bquiero\s+cancelar\b/i,
    ],
    responses: {
      CLIENT:
        '❌ Para cancelar: entra a "Reservas" en el menú inferior, abre la reserva y toca "Cancelar". Si cancelas antes de la confirmación del socio es gratis. Si ya estaba confirmada, revisa la política de cancelación de la reserva (puede aplicar cargo según anticipación).',
      PARTNER:
        '❌ Para cancelar una reserva: entra a "Reservas" en el menú inferior, abre la reserva y toca "Rechazar/Cancelar". Cancelar reservas confirmadas con frecuencia baja tu reputación y puede afectar tu visibilidad en búsquedas. Si tienes un imprevisto, comunícalo al cliente cuanto antes por este chat.',
      default:
        'Las cancelaciones se hacen desde la sección "Reservas". Las políticas varían según el momento y quién cancela.',
    },
  },

  rating: {
    patterns: [
      /\bc[oó]mo\s+(califico|califica[rs]?|valoro|valorar|reseño|reseñar)\b/i,
      /\b(me\s+)?(van\s+a\s+|pueden\s+)?(calificar|valorar|reseñar)\b/i,
      /\bestrella[s]?\b/i,
      /\brese[ñn]a[s]?\b/i,
    ],
    responses: {
      CLIENT:
        '⭐ Cuando el socio marque el servicio como completado podrás calificarlo (1-5 estrellas) y dejar una reseña desde "Reservas". Tu calificación honesta ayuda a otros clientes a elegir bien y al socio a mejorar.',
      PARTNER:
        '⭐ Al finalizar el servicio también puedes calificar al cliente desde "Reservas". Ambas calificaciones son visibles después de que las dos partes hayan calificado. Una buena reputación te da más oportunidades en la plataforma.',
      default:
        'Ambas partes pueden calificarse al finalizar el servicio (1-5 estrellas + reseña). Mejores calificaciones = más confianza y oportunidades.',
    },
  },

  why_no_contact: {
    patterns: [
      /\bpor\s+qu[eé]\s+no\s+(puedo|me\s+deja[ns]?)\s+(compartir|enviar|mandar|dar)\s+(mi\s+)?(tel[eé]fono|n[uú]mero|whatsapp|email|correo|contacto)\b/i,
      /\bpor\s+qu[eé]\s+(bloquea[ns]?|no\s+(se\s+)?puede)\s+(el\s+)?(tel[eé]fono|n[uú]mero|whatsapp|contacto)\b/i,
      /\bno\s+me\s+deja[ns]?\s+(dar|compartir|enviar)\s+(el|mi)\s+(n[uú]mero|tel[eé]fono|whatsapp|correo)\b/i,
    ],
    responses: {
      default:
        '🛡️ Por seguridad de ambas partes, todo (chat, pagos, fotos) debe quedar dentro de LoHaggo. Si salen de la plataforma no queda registro de lo acordado y no podemos ayudarles ante un problema. Si necesitan coordinar algo, háganlo aquí — funciona igual que WhatsApp.',
    },
  },

  support: {
    patterns: [
      /\bsoporte\b/i,
      /\bc[oó]mo\s+(contacto|hablo)\s+con\s+(soporte|atenci[oó]n|ayuda|lohaggo)\b/i,
      /\bnecesito\s+ayuda\b/i,
      /\bayuda\s+por\s+favor\b/i,
      /\bquiero\s+hablar\s+con\s+(alguien|un\s+humano|soporte)\b/i,
      /^\s*ayuda\s*[?!.]*\s*$/i,
      /^\s*help\s*[?!.]*\s*$/i,
    ],
    responses: {
      default:
        '🆘 Para hablar con soporte: escríbenos a hola@lohaggo.com o desde el chat de WhatsApp del botón flotante (esquina inferior derecha). También puedes ir a /contact desde el menú. El equipo responde en horario hábil.',
    },
  },

  commission: {
    patterns: [
      /\bcu[aá]l(es)?\s+(es|son)\s+(la\s+)?(comisi[oó]n|comision|porcentaje|fee)\b/i,
      /\bcu[aá]nto\s+(me\s+)?(cobran|descuentan|se\s+quedan|saca[ns]?\s+lohaggo)\b/i,
      /\bcomisi[oó]n\b/i,
    ],
    responses: {
      PARTNER:
        '💼 La tarifa de LoHaggo, si aplica, se muestra antes de aceptar cada servicio. Registrarte y recibir solicitudes es gratis, sin suscripciones.',
      default:
        'La tarifa de LoHaggo, si aplica, se muestra antes de aceptar cada servicio.',
    },
  },

  verification: {
    patterns: [
      /\best[aá]s?\s+verificad[oa]\b/i,
      /\best[aá]\s+verificad[oa]\b/i,
      /\bc[oó]mo\s+(me\s+)?(verifico|verificar|valido|validar)\b/i,
      /\bverificaci[oó]n\b/i,
      /\bson\s+confiables\s+los\s+socios\b/i,
    ],
    responses: {
      CLIENT:
        '✅ Sí, nuestro equipo verifica el documento de identidad de cada socio antes de que pueda recibir reservas. Verás el badge de "Verificado" en su perfil. Además, tienes el sistema de calificaciones y reseñas para tomar mejor decisión.',
      PARTNER:
        '✅ Para verificar tu perfil entra a "Cuenta → Verificación" y sube tu documento de identidad (cédula/PEP/pasaporte). Si tienes certificados del oficio puedes subirlos también. Nuestro equipo revisa tus documentos y te avisamos al aprobarlos. Sin verificación NO puedes recibir reservas.',
      default:
        'Los socios pasan verificación de identidad antes de poder operar. El cliente puede ver el badge "Verificado" en el perfil del socio.',
    },
  },

  response_time: {
    patterns: [
      /\bcu[aá]nto\s+(tarda[ns]?|demora[ns]?|toma|me\s+responde[ns]?)\b/i,
      /\bcu[aá]ndo\s+(me\s+)?(responde[ns]?|contesta[ns]?|confirma[ns]?)\b/i,
      /\b(en\s+)?cu[aá]nto\s+tiempo\s+(responde[ns]?|llega\s+la\s+respuesta)\b/i,
    ],
    responses: {
      CLIENT:
        '⏱️ Depende de la disponibilidad de los socios y la zona; te avisamos cuando llegue una propuesta. Si es urgente, márcalo en la solicitud (toggle "URGENTE") — aparece destacado para socios cercanos.',
      PARTNER:
        '⏱️ Responde rápido — los clientes valoran muchísimo la rapidez. Recomendamos contestar en menos de 1 hora cuando puedas: responder primero te da más chance de ganar el trabajo.',
      default: 'El tiempo depende de la disponibilidad de los socios. Las solicitudes URGENTES aparecen destacadas.',
    },
  },

  problem: {
    patterns: [
      /\btengo\s+un\s+problema\b/i,
      /\b(hay|tuve|tengo)\s+un[a]?\s+(problema|inconveniente|queja|reclamo|reclamaci[oó]n)\b/i,
      /\balgo\s+sali[oó]\s+mal\b/i,
      /\bme\s+estaf[aó]\b/i,
      /\bno\s+lleg[oó]\s+(el\s+socio|el\s+cliente|nadie)\b/i,
    ],
    responses: {
      default:
        '⚠️ Lamentamos el problema. Primero intenten resolverlo entre ustedes por este chat. Si no es posible, abre soporte: hola@lohaggo.com o WhatsApp (botón flotante). LoHaggo media disputas — por eso es clave que TODO (mensajes, fotos, acuerdos) quede dentro de la plataforma. Adjunten evidencia.',
    },
  },

  photos: {
    patterns: [
      /\bc[oó]mo\s+(subo|env[ií]o|adjunto|mando)\s+(fotos?|im[aá]genes|foto)\b/i,
      /\bpuedo\s+(enviar|mandar|adjuntar|subir)\s+(fotos?|im[aá]genes|im[aá]gen)\b/i,
    ],
    responses: {
      default:
        '📸 Las fotos se adjuntan al crear la solicitud (cliente) — el socio puede verlas en el detalle de la oportunidad. Por ahora el chat no soporta envío de imágenes; si necesitas mostrar algo nuevo, descríbelo aquí y/o pídele al cliente que actualice la solicitud.',
    },
  },
}

export interface HelpDetection {
  topic: HelpTopic
  response: string
}

/**
 * Detecta si el mensaje contiene una pregunta de ayuda y devuelve la respuesta
 * según el rol del que escribió. Devuelve null si no hay match.
 */
export function detectHelpQuery(message: string, askerRole: Role | null | undefined): HelpDetection | null {
  if (!message || message.length < 4 || message.length > 500) return null
  const text = message.trim()

  for (const [topic, config] of Object.entries(TOPICS) as Array<[HelpTopic, TopicConfig]>) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        const response =
          (askerRole && config.responses[askerRole]) ||
          config.responses.default
        return { topic, response }
      }
    }
  }
  return null
}

/**
 * Formatea el mensaje SYSTEM con un encabezado consistente para que el receptor
 * sepa que es info de la plataforma y no del otro usuario.
 */
export function formatHelpSystemMessage(detection: HelpDetection): string {
  return `ℹ️ Info de LoHaggo\n\n${detection.response}`
}
