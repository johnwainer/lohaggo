/**
 * WhatsApp template catalog (source: docs/whatsapp-plantillas.md). Each entry is created in Twilio Content
 * and submitted to Meta by POST /api/admin/messaging/wa-templates/create-catalog. Pure data.
 */

export type WaCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'

export type WaCatalogEntry = {
  /** Catalog code in the doc (B3, C10…) */
  code: string
  name: string
  category: WaCategory
  /** Null for AUTHENTICATION (Meta fixes the text) */
  body: string | null
  /** Sample value per variable number (Meta requires them) */
  variables: Record<string, string>
  quickReplies: Array<{ title: string; id: string }>
  /** URL button; the variable goes only at the end of the URL */
  url: { title: string; url: string } | null
}

export const WA_LANGUAGE = 'es_CO'

export const WA_CATALOG: WaCatalogEntry[] = [
  {
    "code": "A1",
    "name": "lh_codigo_verificacion",
    "category": "AUTHENTICATION",
    "body": null,
    "variables": {
      "1": "482913"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B1",
    "name": "lh_cliente_cuenta_creada",
    "category": "UTILITY",
    "body": "👋 Hola {{1}}, tu cuenta de LoHaggo quedó lista. Desde aquí puedes pedir servicios y ver el estado de tus solicitudes y reservas. Entra con el botón de abajo.",
    "variables": {
      "1": "Ana",
      "2": "auth/magic?token=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Entrar a LoHaggo",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "B2",
    "name": "lh_cliente_acceso_enlace_v2",
    "category": "UTILITY",
    "body": "📲 Hola {{1}}, puedes entrar a tu cuenta de LoHaggo con el botón de abajo para ver tus solicitudes, propuestas y reservas.",
    "variables": {
      "1": "Ana",
      "2": "auth/magic?token=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Entrar a mi cuenta",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "B3",
    "name": "lh_cliente_nueva_propuesta",
    "category": "UTILITY",
    "body": "💡 Hola {{1}}, recibiste una propuesta para *{{2}}*: {{3}} de {{4}}. Puedes verla y aceptarla desde la app o respondiendo aquí.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "$120.000",
      "4": "Carlos",
      "5": "dashboard?tab=requests"
    },
    "quickReplies": [
      {
        "title": "Aceptar esta",
        "id": "proposal_accept"
      },
      {
        "title": "Tengo dudas",
        "id": "proposal_help"
      }
    ],
    "url": {
      "title": "Ver propuestas",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "B4",
    "name": "lh_cliente_sin_propuestas",
    "category": "UTILITY",
    "body": "⏳ Hola {{1}}, tu solicitud de *{{2}}* aún no tiene propuestas. Ya volvimos a avisar a los socios. Si quieres, puedes ajustar la fecha o el presupuesto para recibir más.",
    "variables": {
      "1": "Ana",
      "2": "Pintura"
    },
    "quickReplies": [
      {
        "title": "Ajustar solicitud",
        "id": "request_adjust"
      },
      {
        "title": "Esperar",
        "id": "request_wait"
      }
    ],
    "url": null
  },
  {
    "code": "B5",
    "name": "lh_cliente_solicitud_por_vencer_v2",
    "category": "UTILITY",
    "body": "⏰ Hola {{1}}, tu solicitud de *{{2}}* vence en {{3}} y tiene {{4}} propuestas. Revísalas antes de que venza.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "2 horas",
      "4": "3",
      "5": "dashboard?tab=requests"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver propuestas",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "B6",
    "name": "lh_cliente_solicitud_vencida",
    "category": "UTILITY",
    "body": "📋 Hola {{1}}, tu solicitud de *{{2}}* venció. Puedes reactivarla 24 horas más con un toque o respondiendo este mensaje.",
    "variables": {
      "1": "Ana",
      "2": "Electricidad",
      "3": "dashboard?tab=requests"
    },
    "quickReplies": [
      {
        "title": "Reactivar",
        "id": "request_reactivate"
      }
    ],
    "url": {
      "title": "Ver solicitud",
      "url": "https://www.lohaggo.com/{{3}}"
    }
  },
  {
    "code": "B7",
    "name": "lh_cliente_solicitud_cancelada",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, cancelamos tu solicitud de *{{2}}*. Cuando necesites otro servicio, escríbenos por aquí.",
    "variables": {
      "1": "Ana",
      "2": "Pintura"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B8",
    "name": "lh_cliente_reserva_pendiente",
    "category": "UTILITY",
    "body": "🤝 Hola {{1}}, aceptaste la propuesta de {{2}} para *{{3}}* el {{4}}. Te avisamos apenas confirme la reserva.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "vie 3 oct, 10:00 a. m."
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B9",
    "name": "lh_cliente_socio_no_disponible",
    "category": "UTILITY",
    "body": "🔄 Hola {{1}}, {{2}} no puede atender tu servicio de *{{3}}*. Ya reabrimos tu solicitud para que otros socios te envíen propuestas, sin costo.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "dashboard?tab=requests"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver solicitud",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "B10",
    "name": "lh_cliente_reserva_reprogramada",
    "category": "UTILITY",
    "body": "📅 Hola {{1}}, tu servicio de *{{2}}* quedó para el {{3}}. Estado: {{4}}. Si algo no te sirve, respóndenos aquí.",
    "variables": {
      "1": "Ana",
      "2": "Pintura",
      "3": "sáb 4 oct, 9:00 a. m.",
      "4": "pendiente de confirmar por el socio"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B11",
    "name": "lh_cliente_recordatorio_manana_v2",
    "category": "UTILITY",
    "body": "📅 Hola {{1}}, te recordamos tu servicio de *{{2}}* mañana a las {{3}} con {{4}}. Si necesitas cambiar algo, respóndenos aquí.",
    "variables": {
      "1": "Ana",
      "2": "Limpieza de hogar",
      "3": "9:00 a. m.",
      "4": "Laura"
    },
    "quickReplies": [
      {
        "title": "Todo bien",
        "id": "booking_ok"
      },
      {
        "title": "Reprogramar",
        "id": "booking_reschedule"
      },
      {
        "title": "Cancelar",
        "id": "booking_cancel"
      }
    ],
    "url": null
  },
  {
    "code": "B12",
    "name": "lh_cliente_servicio_pronto_v2",
    "category": "UTILITY",
    "body": "⏳ Hola {{1}}, tu servicio de *{{2}}* empieza a las {{3}}. {{4}} va en camino; si necesitas algo, escríbenos aquí.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "10:00 a. m.",
      "4": "Carlos"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B13",
    "name": "lh_cliente_servicio_iniciado",
    "category": "UTILITY",
    "body": "🛠️ Hola {{1}}, {{2}} inició tu servicio de *{{3}}*. Cuando termine te pediremos confirmar el pago y calificar.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B14",
    "name": "lh_cliente_servicio_terminado_pago",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, {{2}} marcó como terminado tu servicio de *{{3}}* por {{4}}. ¿Cómo le pagaste? Responde aquí y lo registramos.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "$120.000"
    },
    "quickReplies": [
      {
        "title": "Efectivo",
        "id": "pay_cash"
      },
      {
        "title": "Transferencia",
        "id": "pay_transfer"
      },
      {
        "title": "Hubo un problema",
        "id": "guarantee_claim"
      }
    ],
    "url": null
  },
  {
    "code": "B15",
    "name": "lh_cliente_pago_pendiente",
    "category": "UTILITY",
    "body": "💳 Hola {{1}}, falta registrar el pago de tu servicio de *{{2}}* con {{3}}. ¿Cómo le pagaste? Responde aquí.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "Carlos"
    },
    "quickReplies": [
      {
        "title": "Efectivo",
        "id": "pay_cash"
      },
      {
        "title": "Transferencia",
        "id": "pay_transfer"
      },
      {
        "title": "Aún no pago",
        "id": "pay_not_yet"
      }
    ],
    "url": null
  },
  {
    "code": "B16",
    "name": "lh_cliente_pago_confirmado_v2",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, {{2}} confirmó que recibió tu pago de {{3}} por *{{4}}*. ¿Qué tal te fue? Califica el servicio respondiendo aquí.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "$120.000",
      "4": "Plomería"
    },
    "quickReplies": [
      {
        "title": "Excelente",
        "id": "rate_5"
      },
      {
        "title": "Bien",
        "id": "rate_4"
      },
      {
        "title": "Tuve un problema",
        "id": "guarantee_claim"
      }
    ],
    "url": null
  },
  {
    "code": "B17",
    "name": "lh_cliente_pago_rechazado_v2",
    "category": "UTILITY",
    "body": "⚠️ Hola {{1}}, {{2}} indica que no recibió el pago de *{{3}}*. Motivo: {{4}}. Una persona del equipo te escribirá por aquí para resolverlo.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "la transferencia no aparece"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B18",
    "name": "lh_cliente_recordatorio_calificar_v2",
    "category": "UTILITY",
    "body": "⭐ Hola {{1}}, ¿cómo te fue con {{2}} en tu servicio de *{{3}}*? Tu calificación ayuda a otros clientes a elegir.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería"
    },
    "quickReplies": [
      {
        "title": "Excelente",
        "id": "rate_5"
      },
      {
        "title": "Bien",
        "id": "rate_4"
      },
      {
        "title": "Tuve un problema",
        "id": "guarantee_claim"
      }
    ],
    "url": null
  },
  {
    "code": "B19",
    "name": "lh_cliente_reserva_cancelada_socio",
    "category": "UTILITY",
    "body": "⚠️ Hola {{1}}, {{2}} canceló tu servicio de *{{3}}* del {{4}}. Ya reabrimos tu solicitud para que recibas otras propuestas sin costo.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "vie 3 oct"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B20",
    "name": "lh_cliente_garantia_recibida",
    "category": "UTILITY",
    "body": "🛡️ Hola {{1}}, registramos tu reclamo de garantía #{{2}} por *{{3}}*. Te proponemos una solución en máximo 24 horas y la resolvemos en máximo 72.",
    "variables": {
      "1": "Ana",
      "2": "A1B2C3",
      "3": "Plomería"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B21",
    "name": "lh_cliente_garantia_resuelta",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, resolvimos tu reclamo de garantía #{{2}}: {{3}}. Si algo quedó pendiente, respóndenos aquí.",
    "variables": {
      "1": "Ana",
      "2": "A1B2C3",
      "3": "te asignamos a otro socio sin costo"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B22",
    "name": "lh_cliente_reembolso_estado",
    "category": "UTILITY",
    "body": "💳 Hola {{1}}, tu reembolso de {{2}} por *{{3}}* está {{4}}. Te avisamos cuando cambie.",
    "variables": {
      "1": "Ana",
      "2": "$120.000",
      "3": "Plomería",
      "4": "en revisión"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B23",
    "name": "lh_cliente_volver_a_pedir",
    "category": "MARKETING",
    "body": "👋 Hola {{1}}, ¿necesitas de nuevo *{{2}}* u otro servicio para tu hogar? Puedes pedírselo otra vez a {{3}} respondiendo este mensaje.",
    "variables": {
      "1": "Ana",
      "2": "limpieza de hogar",
      "3": "Laura"
    },
    "quickReplies": [
      {
        "title": "Pedir de nuevo",
        "id": "reorder"
      },
      {
        "title": "Otro servicio",
        "id": "new_request"
      },
      {
        "title": "No, gracias",
        "id": "optout_soft"
      }
    ],
    "url": null
  },
  {
    "code": "B24",
    "name": "lh_cliente_solicitud_sin_terminar",
    "category": "MARKETING",
    "body": "👋 Hola {{1}}, quedó pendiente tu solicitud de *{{2}}*. Si todavía la necesitas, responde este mensaje y la terminamos en un minuto.",
    "variables": {
      "1": "Ana",
      "2": "Electricidad"
    },
    "quickReplies": [
      {
        "title": "Terminar solicitud",
        "id": "resume_request"
      },
      {
        "title": "Ya no la necesito",
        "id": "optout_soft"
      }
    ],
    "url": null
  },
  {
    "code": "B25",
    "name": "lh_lista_espera_ciudad_abierta",
    "category": "MARKETING",
    "body": "🎉 Hola {{1}}, LoHaggo ya está disponible en {{2}}. Te avisamos como pediste: ya puedes pedir servicios con profesionales verificados.",
    "variables": {
      "1": "Ana",
      "2": "Bogotá"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "B26",
    "name": "lh_cliente_mensaje_socio",
    "category": "UTILITY",
    "body": "💬 Hola {{1}}, {{2}}, tu socio, te escribió sobre *{{3}}* (referencia {{4}}). Respóndele por aquí mismo y se lo hacemos llegar, o ábrelo en la app.",
    "variables": {
      "1": "Ana",
      "2": "Carlos",
      "3": "Plomería",
      "4": "#a1b2c3",
      "5": "dashboard?tab=bookings"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver mensaje",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "B27",
    "name": "lh_soporte_mensaje_servicio",
    "category": "UTILITY",
    "body": "🛟 Hola {{1}}, el equipo de LoHaggo te dejó un mensaje sobre tu servicio de *{{2}}* (referencia {{3}}). Léelo en la app con el botón de abajo.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "#a1b2c3",
      "4": "dashboard?tab=bookings"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver mensaje",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "B28",
    "name": "lh_cliente_reserva_cancelada_equipo",
    "category": "UTILITY",
    "body": "❌ Hola {{1}}, el equipo de LoHaggo canceló tu reserva de *{{2}}* del {{3}}. Motivo: {{4}}. Si aún necesitas el servicio, puedes pedirlo de nuevo con el botón de abajo.",
    "variables": {
      "1": "Ana",
      "2": "Plomería",
      "3": "viernes 3 de octubre",
      "4": "el socio no pudo asistir",
      "5": "dashboard?tab=requests"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver mis solicitudes",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "C32",
    "name": "lh_socio_reserva_cancelada_equipo",
    "category": "UTILITY",
    "body": "❌ Hola {{1}}, el equipo de LoHaggo canceló el servicio de *{{2}}* del {{3}}. Motivo: {{4}}. No tienes que ir; si tienes dudas, escríbenos por aquí.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "viernes 3 de octubre",
      "4": "el cliente pidió cancelar"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C1",
    "name": "lh_socio_cuenta_creada",
    "category": "UTILITY",
    "body": "👋 Hola {{1}}, tu cuenta de socio en LoHaggo quedó creada. El siguiente paso es subir tu documento de identidad para activar tu perfil; entra con el botón de abajo.",
    "variables": {
      "1": "Carlos",
      "2": "auth/magic?token=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Entrar y verificar",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "C2",
    "name": "lh_socio_acceso_enlace",
    "category": "UTILITY",
    "body": "🔐 Hola {{1}}, aquí tienes tu enlace para entrar a tu panel de socio. Vence en 72 horas y solo sirve una vez. Si no lo pediste, ignora este mensaje.",
    "variables": {
      "1": "Carlos",
      "2": "auth/magic?token=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Entrar",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "C3",
    "name": "lh_socio_falta_documento",
    "category": "UTILITY",
    "body": "📄 Hola {{1}}, tu perfil de socio aún no está activo porque falta tu documento de identidad. Súbelo desde la app o envíanos la foto por aquí y lo cargamos por ti.",
    "variables": {
      "1": "Carlos",
      "2": "partner/verification"
    },
    "quickReplies": [
      {
        "title": "Enviar foto aquí",
        "id": "doc_upload_chat"
      }
    ],
    "url": {
      "title": "Subir documento",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "C4",
    "name": "lh_socio_documento_recibido",
    "category": "UTILITY",
    "body": "📥 Hola {{1}}, recibimos tu {{2}}. El equipo lo revisa y te avisamos por aquí apenas quede aprobado.",
    "variables": {
      "1": "Carlos",
      "2": "cédula de ciudadanía"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C5",
    "name": "lh_socio_documento_aprobado",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, aprobamos tu {{2}}. Ya aparece como insignia en tu perfil de socio.",
    "variables": {
      "1": "Carlos",
      "2": "certificado de antecedentes"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C6",
    "name": "lh_socio_documento_rechazado_v2",
    "category": "UTILITY",
    "body": "⚠️ Hola {{1}}, tu {{2}} necesita corrección: {{3}}. Súbelo de nuevo desde la app o envíanos la foto por aquí.",
    "variables": {
      "1": "Carlos",
      "2": "cédula",
      "3": "la foto está borrosa",
      "4": "partner/verification"
    },
    "quickReplies": [
      {
        "title": "Enviar foto aquí",
        "id": "doc_upload_chat"
      }
    ],
    "url": {
      "title": "Subir de nuevo",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "C7",
    "name": "lh_socio_perfil_activo",
    "category": "UTILITY",
    "body": "🎉 Hola {{1}}, tu perfil de socio quedó verificado y activo. Desde ahora te avisamos por aquí cada vez que un cliente pida {{2}} en tu ciudad.",
    "variables": {
      "1": "Carlos",
      "2": "tus servicios"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C8",
    "name": "lh_socio_sin_servicios_v2",
    "category": "UTILITY",
    "body": "🧰 Hola {{1}}, tu perfil está activo pero no tienes servicios publicados, así que no te llegan solicitudes. Dinos qué servicios ofreces y los activamos por ti.",
    "variables": {
      "1": "Carlos",
      "2": "partner/services"
    },
    "quickReplies": [
      {
        "title": "Activar servicios",
        "id": "services_setup"
      }
    ],
    "url": {
      "title": "Ir a mis servicios",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "C9",
    "name": "lh_socio_falta_cuenta_bancaria",
    "category": "UTILITY",
    "body": "🏦 Hola {{1}}, registra tu cuenta bancaria o Nequi para que los clientes puedan transferirte. Envíanos los datos por aquí o regístrala en la app.",
    "variables": {
      "1": "Carlos",
      "2": "partner/bank-accounts"
    },
    "quickReplies": [
      {
        "title": "Registrar por aquí",
        "id": "bank_setup"
      }
    ],
    "url": {
      "title": "Registrar en la app",
      "url": "https://www.lohaggo.com/{{2}}"
    }
  },
  {
    "code": "C10",
    "name": "lh_socio_nueva_solicitud_v2",
    "category": "UTILITY",
    "body": "🔔 Hola {{1}}, hay una solicitud nueva de *{{2}}* en {{3}} para {{4}}. Envía tu propuesta antes de que otro socio la tome.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "Laureles",
      "4": "hoy, urgente",
      "5": "partner?tab=my-requests"
    },
    "quickReplies": [
      {
        "title": "Proponer por aquí",
        "id": "proposal_chat"
      },
      {
        "title": "No puedo",
        "id": "request_skip"
      }
    ],
    "url": {
      "title": "Ver y proponer",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "C11",
    "name": "lh_socio_solicitud_directa",
    "category": "UTILITY",
    "body": "⭐ Hola {{1}}, un cliente te eligió para *{{2}}* en {{3}}. Envíale tu propuesta; esta solicitud solo te llegó a ti.",
    "variables": {
      "1": "Carlos",
      "2": "Electricidad",
      "3": "Envigado",
      "4": "partner?tab=my-requests"
    },
    "quickReplies": [
      {
        "title": "Proponer por aquí",
        "id": "proposal_chat"
      }
    ],
    "url": {
      "title": "Ver y proponer",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "C12",
    "name": "lh_socio_propuesta_aceptada_v2",
    "category": "UTILITY",
    "body": "🎉 Hola {{1}}, {{2}} aceptó tu propuesta de *{{3}}* para el {{4}}. Confirma la reserva para que el cliente quede tranquilo.",
    "variables": {
      "1": "Carlos",
      "2": "Ana",
      "3": "Plomería",
      "4": "vie 3 oct, 10:00 a. m.",
      "5": "partner?tab=bookings"
    },
    "quickReplies": [
      {
        "title": "Confirmar",
        "id": "booking_confirm"
      },
      {
        "title": "No puedo",
        "id": "booking_decline"
      }
    ],
    "url": {
      "title": "Ver reserva",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "C13",
    "name": "lh_socio_propuesta_no_elegida",
    "category": "UTILITY",
    "body": "📋 Hola {{1}}, el cliente de *{{2}}* eligió otra propuesta esta vez. Te seguimos avisando de nuevas solicitudes por aquí.",
    "variables": {
      "1": "Carlos",
      "2": "Pintura"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C14",
    "name": "lh_socio_confirmar_reserva",
    "category": "UTILITY",
    "body": "⏰ Hola {{1}}, tienes pendiente confirmar el servicio de *{{2}}* del {{3}}. Si no confirmas pronto, reasignaremos al cliente.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "vie 3 oct, 10:00 a. m."
    },
    "quickReplies": [
      {
        "title": "Confirmar",
        "id": "booking_confirm"
      },
      {
        "title": "No puedo",
        "id": "booking_decline"
      }
    ],
    "url": null
  },
  {
    "code": "C15",
    "name": "lh_socio_reserva_reprogramada",
    "category": "UTILITY",
    "body": "📅 Hola {{1}}, el cliente cambió el servicio de *{{2}}* para el {{3}}. ¿Te queda bien la nueva fecha?",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "sáb 4 oct, 9:00 a. m."
    },
    "quickReplies": [
      {
        "title": "Sí, confirmo",
        "id": "booking_confirm"
      },
      {
        "title": "No puedo",
        "id": "booking_decline"
      }
    ],
    "url": null
  },
  {
    "code": "C16",
    "name": "lh_socio_reserva_cancelada",
    "category": "UTILITY",
    "body": "❌ Hola {{1}}, el cliente canceló el servicio de *{{2}}* del {{3}}. No tienes que ir; te seguimos avisando de nuevas solicitudes.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "vie 3 oct"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C17",
    "name": "lh_socio_recordatorio_manana",
    "category": "UTILITY",
    "body": "📅 Hola {{1}}, mañana a las {{2}} tienes el servicio de *{{3}}* en {{4}}. Si surge algo, avísanos por aquí.",
    "variables": {
      "1": "Carlos",
      "2": "10:00 a. m.",
      "3": "Plomería",
      "4": "Laureles",
      "5": "partner?tab=bookings"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver dirección y detalles",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "C18",
    "name": "lh_socio_servicio_pronto",
    "category": "UTILITY",
    "body": "⏳ Hola {{1}}, tu servicio de *{{2}}* es a las {{3}}. Al llegar, márcalo como iniciado respondiendo aquí o desde la app.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "10:00 a. m."
    },
    "quickReplies": [
      {
        "title": "Ya llegué",
        "id": "booking_start"
      },
      {
        "title": "Voy tarde",
        "id": "booking_late"
      }
    ],
    "url": null
  },
  {
    "code": "C19",
    "name": "lh_socio_marcar_terminado",
    "category": "UTILITY",
    "body": "🛠️ Hola {{1}}, ¿ya terminaste el servicio de *{{2}}*? Márcalo como terminado para que el cliente pueda pagarte y calificarte.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería"
    },
    "quickReplies": [
      {
        "title": "Sí, terminé",
        "id": "booking_complete"
      },
      {
        "title": "Aún no",
        "id": "booking_not_done"
      }
    ],
    "url": null
  },
  {
    "code": "C20",
    "name": "lh_socio_pago_reportado_v2",
    "category": "UTILITY",
    "body": "💰 Hola {{1}}, {{2}} reportó que te pagó {{3}} en {{4}} por *{{5}}*. ¿Lo recibiste?",
    "variables": {
      "1": "Carlos",
      "2": "Ana",
      "3": "$120.000",
      "4": "efectivo",
      "5": "Plomería"
    },
    "quickReplies": [
      {
        "title": "Sí, lo recibí",
        "id": "payment_confirm"
      },
      {
        "title": "No lo recibí",
        "id": "payment_reject"
      }
    ],
    "url": null
  },
  {
    "code": "C21",
    "name": "lh_socio_pago_por_confirmar_v2",
    "category": "UTILITY",
    "body": "💰 Hola {{1}}, falta que confirmes el pago de {{2}} por *{{3}}* que reportó {{4}}. Confírmalo para cerrar el servicio.",
    "variables": {
      "1": "Carlos",
      "2": "$120.000",
      "3": "Plomería",
      "4": "Ana"
    },
    "quickReplies": [
      {
        "title": "Sí, lo recibí",
        "id": "payment_confirm"
      },
      {
        "title": "No lo recibí",
        "id": "payment_reject"
      }
    ],
    "url": null
  },
  {
    "code": "C22",
    "name": "lh_socio_servicio_completado_v2",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, cerramos el servicio de *{{2}}* con {{3}}. Recuerda calificar al cliente; tus calificaciones te ayudan a recibir más solicitudes.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "Ana"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C23",
    "name": "lh_socio_calificacion_recibida_v2",
    "category": "UTILITY",
    "body": "⭐ Hola {{1}}, {{2}} te calificó con {{3}} estrellas por *{{4}}*. Puedes ver el comentario en tu panel.",
    "variables": {
      "1": "Carlos",
      "2": "Ana",
      "3": "5",
      "4": "Plomería"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C24",
    "name": "lh_socio_reclamo_garantia",
    "category": "UTILITY",
    "body": "🛡️ Hola {{1}}, el cliente de *{{2}}* reportó: {{3}}. El equipo te escribirá por aquí para acordar la solución en máximo 24 horas.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "el trabajo quedó incompleto"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C25",
    "name": "lh_socio_correccion_programada",
    "category": "UTILITY",
    "body": "🔧 Hola {{1}}, acordamos que corrijas sin costo el servicio de *{{2}}* dentro de las próximas 72 horas. Coordina la hora con el cliente respondiendo aquí.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C26",
    "name": "lh_socio_falta_registrada",
    "category": "UTILITY",
    "body": "⚠️ Hola {{1}}, registramos una falta por el servicio de *{{2}}*: {{3}}. Con 2 faltas en 90 días pausamos el perfil.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "no llegaste a la cita"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C27",
    "name": "lh_socio_perfil_pausado",
    "category": "UTILITY",
    "body": "⏸️ Hola {{1}}, pausamos tu perfil de socio por {{2}}. Una persona del equipo te escribirá por aquí para revisarlo contigo.",
    "variables": {
      "1": "Carlos",
      "2": "dos faltas en los últimos 90 días"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C28",
    "name": "lh_socio_pago_plataforma_enviado",
    "category": "UTILITY",
    "body": "🏦 Hola {{1}}, te transferimos {{2}} por el servicio de *{{3}}* a tu cuenta terminada en {{4}}. Puedes ver el detalle en tu panel.",
    "variables": {
      "1": "Carlos",
      "2": "$108.000",
      "3": "Plomería",
      "4": "4321"
    },
    "quickReplies": [],
    "url": null
  },
  {
    "code": "C29",
    "name": "lh_socio_hay_demanda",
    "category": "MARKETING",
    "body": "📈 Hola {{1}}, hay clientes pidiendo *{{2}}* en {{3}} y pocos socios para atenderlos. Si lo ofreces, actívalo y empieza a recibir solicitudes.",
    "variables": {
      "1": "Carlos",
      "2": "Pintura",
      "3": "Medellín"
    },
    "quickReplies": [
      {
        "title": "Activar servicio",
        "id": "services_setup"
      },
      {
        "title": "No lo ofrezco",
        "id": "optout_soft"
      }
    ],
    "url": null
  },
  {
    "code": "C30",
    "name": "lh_socio_sin_actividad",
    "category": "MARKETING",
    "body": "👋 Hola {{1}}, hace tiempo no envías propuestas en LoHaggo. Hay solicitudes de *{{2}}* esperando; revisa si alguna te sirve.",
    "variables": {
      "1": "Carlos",
      "2": "Plomería",
      "3": "partner?tab=my-requests"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver solicitudes",
      "url": "https://www.lohaggo.com/{{3}}"
    }
  },
  {
    "code": "C31",
    "name": "lh_socio_mensaje_cliente",
    "category": "UTILITY",
    "body": "💬 Hola {{1}}, {{2}}, tu cliente, te escribió sobre *{{3}}* (referencia {{4}}). Respóndele por aquí mismo y se lo hacemos llegar, o ábrelo en tu panel.",
    "variables": {
      "1": "Carlos",
      "2": "Ana",
      "3": "Plomería",
      "4": "#a1b2c3",
      "5": "partner?tab=bookings"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver mensaje",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "D1",
    "name": "lh_admin_conversacion_traspasada",
    "category": "UTILITY",
    "body": "🙋 Hola {{1}}, una conversación de {{2}} necesita a una persona: {{3}}. Atiéndela desde la bandeja.",
    "variables": {
      "1": "Juan",
      "2": "WhatsApp",
      "3": "el cliente pide un reembolso",
      "4": "admin/inbox?c=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Abrir conversación",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "D2",
    "name": "lh_admin_accion_por_aprobar",
    "category": "UTILITY",
    "body": "✅ Hola {{1}}, hay una acción esperando tu aprobación: {{2}}. Revísala y apruébala o recházala.",
    "variables": {
      "1": "Juan",
      "2": "aceptar la propuesta de Carlos por $120.000",
      "3": "admin/inbox?c=abc123"
    },
    "quickReplies": [],
    "url": {
      "title": "Revisar",
      "url": "https://www.lohaggo.com/{{3}}"
    }
  },
  {
    "code": "D3",
    "name": "lh_admin_garantia_nueva",
    "category": "UTILITY",
    "body": "🛡️ Hola {{1}}, nuevo reclamo de garantía #{{2}}: {{3}} en *{{4}}*. Vence en 72 horas.",
    "variables": {
      "1": "Juan",
      "2": "A1B2C3",
      "3": "el socio no llegó",
      "4": "Plomería",
      "5": "admin/guarantee"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver reclamo",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "D4",
    "name": "lh_admin_garantia_por_vencer",
    "category": "UTILITY",
    "body": "⏰ Hola {{1}}, el reclamo de garantía #{{2}} está así: {{3}}. Resuélvelo desde el panel de garantía.",
    "variables": {
      "1": "Juan",
      "2": "A1B2C3",
      "3": "vence en 12 horas",
      "4": "admin/guarantee"
    },
    "quickReplies": [],
    "url": {
      "title": "Resolver",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "D5",
    "name": "lh_admin_disputa_pago",
    "category": "UTILITY",
    "body": "⚠️ Hola {{1}}, hay una disputa de pago en *{{2}}* entre {{3}} y {{4}}. Revisa el caso para resolverlo.",
    "variables": {
      "1": "Juan",
      "2": "Plomería",
      "3": "Ana",
      "4": "Carlos",
      "5": "admin?section=payments"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver caso",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "D6",
    "name": "lh_admin_reserva_sin_confirmar",
    "category": "UTILITY",
    "body": "⏰ Hola {{1}}, la reserva de *{{2}}* del {{3}} lleva 6 horas sin confirmar por {{4}}. Considera reasignarla.",
    "variables": {
      "1": "Juan",
      "2": "Plomería",
      "3": "vie 3 oct",
      "4": "Carlos",
      "5": "admin?section=bookings"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver reserva",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "D7",
    "name": "lh_admin_solicitud_sin_socios",
    "category": "UTILITY",
    "body": "📭 Hola {{1}}, la solicitud de *{{2}}* en {{3}} lleva {{4}} horas sin propuestas. Busca un socio o contacta al cliente.",
    "variables": {
      "1": "Juan",
      "2": "Pintura",
      "3": "Belén",
      "4": "4",
      "5": "admin/service-requests"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver solicitud",
      "url": "https://www.lohaggo.com/{{5}}"
    }
  },
  {
    "code": "D8",
    "name": "lh_admin_documentos_por_revisar",
    "category": "UTILITY",
    "body": "📄 Hola {{1}}, hay {{2}} documentos de socios por revisar; el más antiguo lleva {{3}}. Revísalos para activar a los socios.",
    "variables": {
      "1": "Juan",
      "2": "7",
      "3": "2 días",
      "4": "admin/documents"
    },
    "quickReplies": [],
    "url": {
      "title": "Revisar documentos",
      "url": "https://www.lohaggo.com/{{4}}"
    }
  },
  {
    "code": "D9",
    "name": "lh_admin_incidente_critico",
    "category": "UTILITY",
    "body": "🚨 Hola {{1}}, incidente crítico en LoHaggo: {{2}}. Revisa Salud del sistema.",
    "variables": {
      "1": "Juan",
      "2": "los mensajes de WhatsApp no se están enviando",
      "3": "admin/system"
    },
    "quickReplies": [],
    "url": {
      "title": "Ver incidente",
      "url": "https://www.lohaggo.com/{{3}}"
    }
  },
  {
    "code": "D10",
    "name": "lh_admin_resumen_diario",
    "category": "UTILITY",
    "body": "📊 Hola {{1}}, resumen de ayer en LoHaggo: {{2}} solicitudes, {{3}} reservas y {{4}} en ventas. Haggo tiene {{5}} temas para revisar hoy.",
    "variables": {
      "1": "Juan",
      "2": "8",
      "3": "3",
      "4": "$360.000",
      "5": "2",
      "6": "admin/haggo"
    },
    "quickReplies": [],
    "url": {
      "title": "Abrir Haggo",
      "url": "https://www.lohaggo.com/{{6}}"
    }
  },
{
  "code": "C10",
  "name": "lh_socio_nueva_solicitud_v3",
  "category": "UTILITY",
  "body": "🔔 Hola {{1}}, se creó la solicitud #{{2}} de *{{3}}* en {{4}}, que coincide con los servicios de tu cuenta. Puedes ver los detalles y responder desde tu panel o por aquí.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3",
    "3": "Plomería",
    "4": "Laureles",
    "5": "partner?tab=my-requests"
  },
  "quickReplies": [
    {
      "title": "Proponer por aquí",
      "id": "proposal_chat"
    },
    {
      "title": "No puedo",
      "id": "request_skip"
    }
  ],
  "url": {
    "title": "Ver solicitud",
    "url": "https://www.lohaggo.com/{{5}}"
  }
},
{
  "code": "C11",
  "name": "lh_socio_solicitud_directa_v3",
  "category": "UTILITY",
  "body": "⭐ Hola {{1}}, recibiste la solicitud directa #{{2}} de *{{3}}* en {{4}}. Solo se envió a tu cuenta; puedes ver los detalles y responder desde tu panel.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3",
    "3": "Electricidad",
    "4": "Envigado",
    "5": "partner?tab=my-requests"
  },
  "quickReplies": [
    {
      "title": "Proponer por aquí",
      "id": "proposal_chat"
    }
  ],
  "url": {
    "title": "Ver solicitud",
    "url": "https://www.lohaggo.com/{{5}}"
  }
},
{
  "code": "B19",
  "name": "lh_cliente_reserva_cancelada_socio_v3",
  "category": "UTILITY",
  "body": "⚠️ Hola {{1}}, tu reserva #{{2}} de *{{3}}* del {{4}} fue cancelada por el socio. Tu solicitud volvió a quedar abierta para recibir otras propuestas.",
  "variables": {
    "1": "Ana",
    "2": "A1B2C3",
    "3": "Plomería",
    "4": "vie 3 oct"
  },
  "quickReplies": [],
  "url": null
},
{
  "code": "C8",
  "name": "lh_socio_sin_servicios_v3",
  "category": "UTILITY",
  "body": "🧰 Hola {{1}}, tu cuenta de socio está verificada pero no tiene servicios activos, por lo que no se te asignan solicitudes. Puedes activarlos desde tu panel o respondiendo este mensaje.",
  "variables": {
    "1": "Carlos",
    "2": "partner/services"
  },
  "quickReplies": [
    {
      "title": "Activar servicios",
      "id": "services_setup"
    }
  ],
  "url": {
    "title": "Ir a mis servicios",
    "url": "https://www.lohaggo.com/{{2}}"
  }
},
{
  "code": "C9",
  "name": "lh_socio_falta_cuenta_bancaria_v3",
  "category": "UTILITY",
  "body": "🏦 Hola {{1}}, tu cuenta de socio no tiene una cuenta bancaria registrada para recibir las transferencias de la reserva #{{2}}. Puedes registrarla desde tu panel o respondiendo este mensaje.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3",
    "3": "partner/bank-accounts"
  },
  "quickReplies": [
    {
      "title": "Registrar por aquí",
      "id": "bank_setup"
    }
  ],
  "url": {
    "title": "Registrar en la app",
    "url": "https://www.lohaggo.com/{{3}}"
  }
},
{
  "code": "B1",
  "name": "lh_cliente_cuenta_creada_v3",
  "category": "UTILITY",
  "body": "✅ Hola {{1}}, se creó tu cuenta de cliente en LoHaggo. Desde ella puedes ver el estado de tus solicitudes y reservas.",
  "variables": {
    "1": "Ana",
    "2": "dashboard"
  },
  "quickReplies": [],
  "url": {
    "title": "Ver mi cuenta",
    "url": "https://www.lohaggo.com/{{2}}"
  }
},
{
  "code": "B4",
  "name": "lh_cliente_sin_propuestas_v3",
  "category": "UTILITY",
  "body": "⏳ Hola {{1}}, tu solicitud #{{2}} de *{{3}}* aún no tiene propuestas y la volvimos a enviar a los socios. Puedes ajustar la fecha o el presupuesto respondiendo este mensaje.",
  "variables": {
    "1": "Ana",
    "2": "A1B2C3",
    "3": "Pintura"
  },
  "quickReplies": [
    {
      "title": "Ajustar solicitud",
      "id": "request_adjust"
    },
    {
      "title": "Esperar",
      "id": "request_wait"
    }
  ],
  "url": null
},
{
  "code": "B6",
  "name": "lh_cliente_solicitud_vencida_v3",
  "category": "UTILITY",
  "body": "📋 Hola {{1}}, tu solicitud #{{2}} de *{{3}}* venció sin una propuesta aceptada. Puedes reactivarla por 24 horas respondiendo este mensaje.",
  "variables": {
    "1": "Ana",
    "2": "A1B2C3",
    "3": "Electricidad",
    "4": "dashboard?tab=requests"
  },
  "quickReplies": [
    {
      "title": "Reactivar",
      "id": "request_reactivate"
    }
  ],
  "url": {
    "title": "Ver solicitud",
    "url": "https://www.lohaggo.com/{{4}}"
  }
},
{
  "code": "B7",
  "name": "lh_cliente_solicitud_cancelada_v3",
  "category": "UTILITY",
  "body": "✅ Hola {{1}}, confirmamos la cancelación de tu solicitud #{{2}} de *{{3}}*. No recibirás más propuestas para esta solicitud.",
  "variables": {
    "1": "Ana",
    "2": "A1B2C3",
    "3": "Pintura"
  },
  "quickReplies": [],
  "url": null
},
{
  "code": "C7",
  "name": "lh_socio_perfil_activo_v3",
  "category": "UTILITY",
  "body": "✅ Hola {{1}}, aprobamos tu documento de identidad y tu cuenta de socio #{{2}} quedó verificada. Recibirás avisos de las solicitudes de tus servicios activos.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3"
  },
  "quickReplies": [],
  "url": null
},
{
  "code": "C13",
  "name": "lh_socio_propuesta_no_elegida_v3",
  "category": "UTILITY",
  "body": "📋 Hola {{1}}, la solicitud #{{2}} de *{{3}}* se cerró con otra propuesta. Tu propuesta para esta solicitud ya no está activa.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3",
    "3": "Pintura"
  },
  "quickReplies": [],
  "url": null
},
{
  "code": "C22",
  "name": "lh_socio_servicio_completado_v3",
  "category": "UTILITY",
  "body": "✅ Hola {{1}}, la reserva #{{2}} de *{{3}}* quedó marcada como completada. Falta confirmar el pago y calificar al cliente desde tu panel o respondiendo este mensaje.",
  "variables": {
    "1": "Carlos",
    "2": "A1B2C3",
    "3": "Plomería"
  },
  "quickReplies": [],
  "url": null
},
{
  "code": "D7",
  "name": "lh_admin_solicitud_sin_socios_v3",
  "category": "UTILITY",
  "body": "📭 Hola {{1}}, la solicitud #{{2}} de *{{3}}* en {{4}} sigue sin propuestas después de {{5}} horas de publicada. Revísala en el panel.",
  "variables": {
    "1": "Juan",
    "2": "A1B2C3",
    "3": "Pintura",
    "4": "Belén",
    "5": "4",
    "6": "admin/service-requests"
  },
  "quickReplies": [],
  "url": {
    "title": "Ver solicitud",
    "url": "https://www.lohaggo.com/{{6}}"
  }
}
]

/** The Twilio Content «types» object for an entry: text, quick replies, URL, both (card) or authentication. */
export function contentTypes(t: WaCatalogEntry): Record<string, unknown> {
  if (t.category === 'AUTHENTICATION') {
    return { 'whatsapp/authentication': { add_security_recommendation: true, code_expiration_minutes: 10, actions: [{ type: 'COPY_CODE', copy_code_text: 'Copiar código' }] } }
  }
  const body = t.body ?? ''
  const quick = t.quickReplies.map((q) => ({ title: q.title, id: q.id }))
  if (t.url && quick.length) {
    return { 'twilio/card': { title: body, actions: [...quick.map((q) => ({ type: 'QUICK_REPLY', ...q })), { type: 'URL', title: t.url.title, url: t.url.url }] } }
  }
  if (t.url) return { 'twilio/call-to-action': { body, actions: [{ type: 'URL', title: t.url.title, url: t.url.url }] } }
  if (quick.length) return { 'twilio/quick-reply': { body, actions: quick } }
  return { 'twilio/text': { body } }
}

