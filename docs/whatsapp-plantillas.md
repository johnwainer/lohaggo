# Plantillas de WhatsApp de LoHaggo (Twilio Content API + Meta)

Catálogo completo de plantillas para todo el proceso: pedir un servicio, propuestas, reserva, pago, garantía, alta y operación de socios, y avisos al equipo. Estado revisado en Twilio el 2026-09-27.

## Reglas para crearlas (léelas antes de empezar)

1. **Motivo de los rechazos anteriores:** Meta rechazó 9 plantillas con «Variables can't be at the start or end of the template». Ninguna plantilla puede empezar ni terminar con `{{n}}`, ni tener dos variables seguidas sin texto entre ellas. Todas las de esta lista ya cumplen esto; no cambies el orden de las frases.
2. **Idioma:** `es_CO`. Trato de tú.
3. **Categoría:** la indicada en cada una. UTILITY solo para avisos ligados a una acción o transacción de la persona (sin promociones ni «¡aprovecha!»). Si Meta reclasifica una UTILITY como MARKETING, avísale al dueño: no la uses como está; ajusta el texto quitando cualquier tono promocional y vuelve a enviarla con otro nombre.
4. **Nombres:** usa exactamente el nombre de la lista (prefijo `lh_` y sufijo `_v2` en las que reemplazan a una anterior). No reutilices nombres rechazados.
5. **Valores de ejemplo:** cada variable debe llevar el ejemplo indicado (Meta lo exige para aprobar).
6. **Botones:**
   - Botón de enlace (URL): base fija `https://www.lohaggo.com/` y la variable SOLO como sufijo final de la URL (p. ej. `https://www.lohaggo.com/{{5}}`), con el ejemplo indicado.
   - Respuestas rápidas (quick reply): máximo 3 por plantilla, con el `id` indicado. La respuesta llega a la bandeja como mensaje entrante y la atiende el agente de IA.
   - Si una plantilla mezcla enlace y respuestas rápidas, créala con `twilio/card` (o el tipo que Twilio indique para mezclar acciones en WhatsApp). Si solo tiene respuestas rápidas: `twilio/quick-reply`. Solo enlace: `twilio/call-to-action`. Sin botones: `twilio/text`.
7. **Sin encabezado ni pie** salvo que se indique. El emoji inicial es parte del texto (no es variable, por eso sí puede ir al inicio).
8. **Entrega:** al terminar, devuelve una tabla `nombre → Content SID (HX…) → estado de Meta (approved / pending / rejected + motivo) → categoría final`. Con eso se conectan en el código (`lib/messaging/whatsapp-templates.ts`).

## Estado actual (no crear de nuevo)

Aprobadas y se conservan tal cual:

| Nombre | Categoría | Uso |
|---|---|---|
| solicitud_enviada_cliente | UTILITY | Cliente: solicitud enviada |
| reserva_confirmada_cliente | UTILITY | Cliente: reserva confirmada |
| reserva_cancelada | UTILITY | Cliente: reserva cancelada |
| reserva_completada_cliente | UTILITY | Cliente: servicio terminado, pide reseña |
| propuesta_aceptada_socio | UTILITY | Socio: su propuesta fue aceptada |
| documentos_rechazados_wa | UTILITY | Socio: documento con corrección |
| lohaggo_socios_verificacion | UTILITY | Socio: invitación a verificar perfil |
| booking_confirmation | UTILITY | (legado, sin uso) |
| lanzamiento_ciudad, lohaggo_bienvenida_general, lohaggo_clientes_*, lohaggo_socios_*, referir_socios, recordatorio_inicio_sesion, invitacion_app, lohaggo_novedades_app, socios_sin_servicios, verificacion_documentos | MARKETING | Campañas; se conservan |

Rechazadas (se reemplazan por las `_v2` de esta lista): pago_reportado_cliente, pago_confirmado_cliente, pago_rechazado_cliente, calificacion_recibida, recordatorio_calificacion, solicitud_por_expirar, recordatorio_servicio_manana, servicio_empieza_pronto, pago_pendiente_recordatorio.

Aprobadas pero como MARKETING siendo transaccionales (se reemplazan por versión UTILITY de esta lista): nueva_solicitud_socio, new_service_request, bienvenida_socio, socio_activado_wa, documentos_aprobados_wa, reserva_completada_socio.

---

## A. Autenticación

### A1 · lh_codigo_verificacion
- **Categoría:** AUTHENTICATION (plantilla de autenticación de WhatsApp con botón «Copiar código»; en Twilio `whatsapp/authentication`).
- **Para:** clientes y socios.
- **Cuándo:** vincular una conversación de chat a una cuenta (el agente de IA envía un código de 6 dígitos), y en el futuro iniciar sesión con código por WhatsApp.
- **Texto:** el formato fijo de Meta: «{{1}} es tu código de verificación.» con aviso de seguridad y vencimiento de 10 minutos.
- **Ejemplo:** `{{1}}` = 482913.

---

## B. Clientes

### B1 · lh_cliente_cuenta_creada
- **Categoría:** UTILITY
- **Cuándo:** se crea la cuenta del cliente (desde la web o desde el chat).
- **Texto:**
  > 👋 Hola {{1}}, tu cuenta de LoHaggo quedó lista. Desde aquí puedes pedir servicios y ver el estado de tus solicitudes y reservas. Entra con el botón de abajo.
- **Variables:** {{1}} nombre = «Ana»
- **Botón URL:** «Entrar a LoHaggo» → `https://www.lohaggo.com/{{2}}` · ejemplo `auth/magic?token=abc123`

### B2 · lh_cliente_acceso_enlace_v2
- **Categoría:** UTILITY
- **Cuándo:** la persona pide un enlace para entrar (olvidó la contraseña o entra desde el chat). La primera versión, con lenguaje de «inicio de sesión», fue rechazada por Meta.
- **Texto:**
  > 📲 Hola {{1}}, puedes entrar a tu cuenta de LoHaggo con el botón de abajo para ver tus solicitudes, propuestas y reservas.
- **Variables:** {{1}} = «Ana»
- **Botón URL:** «Entrar a mi cuenta» → `https://www.lohaggo.com/{{2}}` · ejemplo `auth/magic?token=abc123`

### B3 · lh_cliente_nueva_propuesta
- **Categoría:** UTILITY
- **Cuándo:** un socio envía una propuesta a la solicitud del cliente. Es el aviso que más convierte.
- **Texto:**
  > 💡 Hola {{1}}, recibiste una propuesta para *{{2}}*: {{3}} de {{4}}. Puedes verla y aceptarla desde la app o respondiendo aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Plomería» · {{3}} «$120.000» · {{4}} «Carlos»
- **Botones:** URL «Ver propuestas» → `https://www.lohaggo.com/{{5}}` (ejemplo `dashboard?tab=requests`) · quick reply «Aceptar esta» (id `proposal_accept`) · quick reply «Tengo dudas» (id `proposal_help`)

### B4 · lh_cliente_sin_propuestas
- **Categoría:** UTILITY
- **Cuándo:** 2 horas después de crear la solicitud sin ninguna propuesta (ya se reavisó a los socios).
- **Texto:**
  > ⏳ Hola {{1}}, tu solicitud de *{{2}}* aún no tiene propuestas. Ya volvimos a avisar a los socios. Si quieres, puedes ajustar la fecha o el presupuesto para recibir más.
- **Variables:** {{1}} «Ana» · {{2}} «Pintura»
- **Botones:** quick reply «Ajustar solicitud» (id `request_adjust`) · quick reply «Esperar» (id `request_wait`)

### B5 · lh_cliente_solicitud_por_vencer_v2 (reemplaza solicitud_por_expirar)
- **Categoría:** UTILITY
- **Cuándo:** faltan 1 a 2 horas para que venza la solicitud y el cliente no ha aceptado.
- **Texto:**
  > ⏰ Hola {{1}}, tu solicitud de *{{2}}* vence en {{3}} y tiene {{4}} propuestas. Revísalas antes de que venza.
- **Variables:** {{1}} «Ana» · {{2}} «Plomería» · {{3}} «2 horas» · {{4}} «3»
- **Botón URL:** «Ver propuestas» → `https://www.lohaggo.com/{{5}}` · ejemplo `dashboard?tab=requests`

### B6 · lh_cliente_solicitud_vencida
- **Categoría:** UTILITY
- **Cuándo:** la solicitud venció sin propuesta aceptada.
- **Texto:**
  > 📋 Hola {{1}}, tu solicitud de *{{2}}* venció. Puedes reactivarla 24 horas más con un toque o respondiendo este mensaje.
- **Variables:** {{1}} «Ana» · {{2}} «Electricidad»
- **Botones:** quick reply «Reactivar» (id `request_reactivate`) · URL «Ver solicitud» → `https://www.lohaggo.com/{{3}}` (ejemplo `dashboard?tab=requests`)

### B7 · lh_cliente_solicitud_cancelada
- **Categoría:** UTILITY
- **Cuándo:** el cliente cancela una solicitud abierta.
- **Texto:**
  > ✅ Hola {{1}}, cancelamos tu solicitud de *{{2}}*. Cuando necesites otro servicio, escríbenos por aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Pintura»

### B8 · lh_cliente_reserva_pendiente
- **Categoría:** UTILITY
- **Cuándo:** el cliente acepta una propuesta; la reserva queda esperando que el socio confirme.
- **Texto:**
  > 🤝 Hola {{1}}, aceptaste la propuesta de {{2}} para *{{3}}* el {{4}}. Te avisamos apenas confirme la reserva.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería» · {{4}} «vie 3 oct, 10:00 a. m.»

### B9 · lh_cliente_socio_no_disponible
- **Categoría:** UTILITY
- **Cuándo:** el socio rechaza o cancela la reserva; la solicitud se reabre para otras propuestas.
- **Texto:**
  > 🔄 Hola {{1}}, {{2}} no puede atender tu servicio de *{{3}}*. Ya reabrimos tu solicitud para que otros socios te envíen propuestas, sin costo.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería»
- **Botón URL:** «Ver solicitud» → `https://www.lohaggo.com/{{4}}` · ejemplo `dashboard?tab=requests`

### B10 · lh_cliente_reserva_reprogramada
- **Categoría:** UTILITY
- **Cuándo:** cambia la fecha u hora de la reserva (la pidió el cliente o el socio).
- **Texto:**
  > 📅 Hola {{1}}, tu servicio de *{{2}}* quedó para el {{3}}. Estado: {{4}}. Si algo no te sirve, respóndenos aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Pintura» · {{3}} «sáb 4 oct, 9:00 a. m.» · {{4}} «pendiente de confirmar por el socio»

### B11 · lh_cliente_recordatorio_manana_v2 (reemplaza recordatorio_servicio_manana)
- **Categoría:** UTILITY
- **Cuándo:** entre 22 y 25 horas antes del servicio.
- **Texto:**
  > 📅 Hola {{1}}, te recordamos tu servicio de *{{2}}* mañana a las {{3}} con {{4}}. Si necesitas cambiar algo, respóndenos aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Limpieza de hogar» · {{3}} «9:00 a. m.» · {{4}} «Laura»
- **Botones:** quick reply «Todo bien» (id `booking_ok`) · quick reply «Reprogramar» (id `booking_reschedule`) · quick reply «Cancelar» (id `booking_cancel`)

### B12 · lh_cliente_servicio_pronto_v2 (reemplaza servicio_empieza_pronto)
- **Categoría:** UTILITY
- **Cuándo:** entre 30 y 90 minutos antes del servicio.
- **Texto:**
  > ⏳ Hola {{1}}, tu servicio de *{{2}}* empieza a las {{3}}. {{4}} va en camino; si necesitas algo, escríbenos aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Plomería» · {{3}} «10:00 a. m.» · {{4}} «Carlos»

### B13 · lh_cliente_servicio_iniciado
- **Categoría:** UTILITY
- **Cuándo:** el socio marca el servicio en curso.
- **Texto:**
  > 🛠️ Hola {{1}}, {{2}} inició tu servicio de *{{3}}*. Cuando termine te pediremos confirmar el pago y calificar.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería»

### B14 · lh_cliente_servicio_terminado_pago
- **Categoría:** UTILITY
- **Cuándo:** el socio marca el servicio completado. Reemplaza el uso de reserva_completada_cliente en el flujo de pago.
- **Texto:**
  > ✅ Hola {{1}}, {{2}} marcó como terminado tu servicio de *{{3}}* por {{4}}. ¿Cómo le pagaste? Responde aquí y lo registramos.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería» · {{4}} «$120.000»
- **Botones:** quick reply «Efectivo» (id `pay_cash`) · quick reply «Transferencia» (id `pay_transfer`) · quick reply «Hubo un problema» (id `guarantee_claim`)

### B15 · lh_cliente_pago_pendiente
- **Categoría:** UTILITY
- **Cuándo:** 24 horas después de completado sin que el cliente reporte el pago.
- **Texto:**
  > 💳 Hola {{1}}, falta registrar el pago de tu servicio de *{{2}}* con {{3}}. ¿Cómo le pagaste? Responde aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Plomería» · {{3}} «Carlos»
- **Botones:** quick reply «Efectivo» (id `pay_cash`) · quick reply «Transferencia» (id `pay_transfer`) · quick reply «Aún no pago» (id `pay_not_yet`)

### B16 · lh_cliente_pago_confirmado_v2 (reemplaza pago_confirmado_cliente)
- **Categoría:** UTILITY
- **Cuándo:** el socio confirma que recibió el pago.
- **Texto:**
  > ✅ Hola {{1}}, {{2}} confirmó que recibió tu pago de {{3}} por *{{4}}*. ¿Qué tal te fue? Califica el servicio respondiendo aquí.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «$120.000» · {{4}} «Plomería»
- **Botones:** quick reply «Excelente» (id `rate_5`) · quick reply «Bien» (id `rate_4`) · quick reply «Tuve un problema» (id `guarantee_claim`)

### B17 · lh_cliente_pago_rechazado_v2 (reemplaza pago_rechazado_cliente)
- **Categoría:** UTILITY
- **Cuándo:** el socio dice que no recibió el pago reportado (disputa).
- **Texto:**
  > ⚠️ Hola {{1}}, {{2}} indica que no recibió el pago de *{{3}}*. Motivo: {{4}}. Una persona del equipo te escribirá por aquí para resolverlo.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería» · {{4}} «la transferencia no aparece»

### B18 · lh_cliente_recordatorio_calificar_v2 (reemplaza recordatorio_calificacion)
- **Categoría:** UTILITY
- **Cuándo:** 24 horas después del servicio sin calificación.
- **Texto:**
  > ⭐ Hola {{1}}, ¿cómo te fue con {{2}} en tu servicio de *{{3}}*? Tu calificación ayuda a otros clientes a elegir.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería»
- **Botones:** quick reply «Excelente» (id `rate_5`) · quick reply «Bien» (id `rate_4`) · quick reply «Tuve un problema» (id `guarantee_claim`)

### B19 · lh_cliente_reserva_cancelada_socio
- **Categoría:** UTILITY
- **Cuándo:** el socio cancela una reserva confirmada (el cliente no la canceló).
- **Texto:**
  > ⚠️ Hola {{1}}, {{2}} canceló tu servicio de *{{3}}* del {{4}}. Ya reabrimos tu solicitud para que recibas otras propuestas sin costo.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería» · {{4}} «vie 3 oct»

### B20 · lh_cliente_garantia_recibida
- **Categoría:** UTILITY
- **Cuándo:** se registra un reclamo de garantía (por chat o por la app).
- **Texto:**
  > 🛡️ Hola {{1}}, registramos tu reclamo de garantía #{{2}} por *{{3}}*. Te proponemos una solución en máximo 24 horas y la resolvemos en máximo 72.
- **Variables:** {{1}} «Ana» · {{2}} «A1B2C3» · {{3}} «Plomería»

### B21 · lh_cliente_garantia_resuelta
- **Categoría:** UTILITY
- **Cuándo:** el equipo resuelve el reclamo.
- **Texto:**
  > ✅ Hola {{1}}, resolvimos tu reclamo de garantía #{{2}}: {{3}}. Si algo quedó pendiente, respóndenos aquí.
- **Variables:** {{1}} «Ana» · {{2}} «A1B2C3» · {{3}} «te asignamos a otro socio sin costo»

### B22 · lh_cliente_reembolso_estado
- **Categoría:** UTILITY
- **Cuándo:** cambia el estado de un reembolso (solo pagos en línea).
- **Texto:**
  > 💳 Hola {{1}}, tu reembolso de {{2}} por *{{3}}* está {{4}}. Te avisamos cuando cambie.
- **Variables:** {{1}} «Ana» · {{2}} «$120.000» · {{3}} «Plomería» · {{4}} «en revisión»

### B23 · lh_cliente_volver_a_pedir
- **Categoría:** MARKETING
- **Cuándo:** 30 días después del último servicio completado, si no ha vuelto a pedir.
- **Texto:**
  > 👋 Hola {{1}}, ¿necesitas de nuevo *{{2}}* u otro servicio para tu hogar? Puedes pedírselo otra vez a {{3}} respondiendo este mensaje.
- **Variables:** {{1}} «Ana» · {{2}} «limpieza de hogar» · {{3}} «Laura»
- **Botones:** quick reply «Pedir de nuevo» (id `reorder`) · quick reply «Otro servicio» (id `new_request`) · quick reply «No, gracias» (id `optout_soft`)

### B24 · lh_cliente_solicitud_sin_terminar
- **Categoría:** MARKETING
- **Cuándo:** la persona empezó a pedir un servicio por chat y no terminó, y ya pasaron más de 24 horas (fuera de la ventana gratuita).
- **Texto:**
  > 👋 Hola {{1}}, quedó pendiente tu solicitud de *{{2}}*. Si todavía la necesitas, responde este mensaje y la terminamos en un minuto.
- **Variables:** {{1}} «Ana» · {{2}} «Electricidad»
- **Botones:** quick reply «Terminar solicitud» (id `resume_request`) · quick reply «Ya no la necesito» (id `optout_soft`)

### B25 · lh_lista_espera_ciudad_abierta
- **Categoría:** MARKETING
- **Cuándo:** una ciudad de la lista de espera pasa a activa (se envía a los inscritos que dieron su número; hoy la lista guarda correo, así que es para cuando se capture teléfono).
- **Texto:**
  > 🎉 Hola {{1}}, LoHaggo ya está disponible en {{2}}. Te avisamos como pediste: ya puedes pedir servicios con profesionales verificados.
- **Variables:** {{1}} «Ana» · {{2}} «Bogotá»

---

## C. Socios

### B26 · lh_cliente_mensaje_socio
- **Categoría:** UTILITY
- **Cuándo:** el socio escribió en el chat de la reserva (desde la app o por WhatsApp) y el cliente no ha escrito por WhatsApp en las últimas 24 h. Máximo uno cada 30 min por chat. Cuando el cliente responde, el agente le muestra el mensaje y le pasa su respuesta al socio.
- **Texto:**
  > 💬 Hola {{1}}, {{2}}, tu socio, te escribió sobre *{{3}}* (referencia {{4}}). Respóndele por aquí mismo y se lo hacemos llegar, o ábrelo en la app.
- **Variables:** {{1}} «Ana» · {{2}} «Carlos» · {{3}} «Plomería» · {{4}} «#a1b2c3»
- **Botones:** URL «Ver mensaje» → `https://www.lohaggo.com/{{5}}` (ejemplo `dashboard?tab=bookings`)


### B27 · lh_soporte_mensaje_servicio
- Categoría: UTILITY · Para: cliente o socio · Cuándo: el equipo escribe en el chat de un servicio desde «Solicitud 360» (una por mensaje).
- Texto: «🛟 Hola {{1}}, el equipo de LoHaggo te dejó un mensaje sobre tu servicio de *{{2}}* (referencia {{3}}). Léelo en la app con el botón de abajo.»
- Botón: «Ver mensaje» → https://www.lohaggo.com/{{4}}

### C1 · lh_socio_cuenta_creada (reemplaza bienvenida_socio, que quedó MARKETING)
- **Categoría:** UTILITY
- **Cuándo:** un socio se registra (web /unete o chat).
- **Texto:**
  > 👋 Hola {{1}}, tu cuenta de socio en LoHaggo quedó creada. El siguiente paso es subir tu documento de identidad para activar tu perfil; entra con el botón de abajo.
- **Variables:** {{1}} «Carlos»
- **Botón URL:** «Entrar y verificar» → `https://www.lohaggo.com/{{2}}` · ejemplo `auth/magic?token=abc123`

### C2 · lh_socio_acceso_enlace
- **Categoría:** UTILITY
- **Cuándo:** el socio pide un enlace para entrar.
- **Texto:**
  > 🔐 Hola {{1}}, aquí tienes tu enlace para entrar a tu panel de socio. Vence en 72 horas y solo sirve una vez. Si no lo pediste, ignora este mensaje.
- **Variables:** {{1}} «Carlos»
- **Botón URL:** «Entrar» → `https://www.lohaggo.com/{{2}}` · ejemplo `auth/magic?token=abc123`

### C3 · lh_socio_falta_documento
- **Categoría:** UTILITY
- **Cuándo:** secuencia a los días 1, 3 y 7 si el socio no ha subido su documento de identidad.
- **Texto:**
  > 📄 Hola {{1}}, tu perfil de socio aún no está activo porque falta tu documento de identidad. Súbelo desde la app o envíanos la foto por aquí y lo cargamos por ti.
- **Variables:** {{1}} «Carlos»
- **Botones:** URL «Subir documento» → `https://www.lohaggo.com/{{2}}` (ejemplo `partner/verification`) · quick reply «Enviar foto aquí» (id `doc_upload_chat`)

### C4 · lh_socio_documento_recibido
- **Categoría:** UTILITY
- **Cuándo:** el socio sube un documento (app o chat).
- **Texto:**
  > 📥 Hola {{1}}, recibimos tu {{2}}. El equipo lo revisa y te avisamos por aquí apenas quede aprobado.
- **Variables:** {{1}} «Carlos» · {{2}} «cédula de ciudadanía»

### C5 · lh_socio_documento_aprobado (reemplaza documentos_aprobados_wa, que quedó MARKETING)
- **Categoría:** UTILITY
- **Cuándo:** el equipo aprueba un documento que no es el de identidad (estudios, antecedentes, cámara de comercio).
- **Texto:**
  > ✅ Hola {{1}}, aprobamos tu {{2}}. Ya aparece como insignia en tu perfil de socio.
- **Variables:** {{1}} «Carlos» · {{2}} «certificado de antecedentes»

### C6 · lh_socio_documento_rechazado_v2
- **Categoría:** UTILITY
- **Cuándo:** el equipo rechaza un documento; incluye el motivo (la actual documentos_rechazados_wa no lo tiene).
- **Texto:**
  > ⚠️ Hola {{1}}, tu {{2}} necesita corrección: {{3}}. Súbelo de nuevo desde la app o envíanos la foto por aquí.
- **Variables:** {{1}} «Carlos» · {{2}} «cédula» · {{3}} «la foto está borrosa»
- **Botones:** URL «Subir de nuevo» → `https://www.lohaggo.com/{{4}}` (ejemplo `partner/verification`) · quick reply «Enviar foto aquí» (id `doc_upload_chat`)

### C7 · lh_socio_perfil_activo (reemplaza socio_activado_wa, que quedó MARKETING)
- **Categoría:** UTILITY
- **Cuándo:** se aprueba el documento de identidad y el perfil queda verificado.
- **Texto:**
  > 🎉 Hola {{1}}, tu perfil de socio quedó verificado y activo. Desde ahora te avisamos por aquí cada vez que un cliente pida {{2}} en tu ciudad.
- **Variables:** {{1}} «Carlos» · {{2}} «tus servicios»

### C8 · lh_socio_sin_servicios_v2
- **Categoría:** UTILITY
- **Cuándo:** socio verificado sin ningún servicio activo (3 días después de activarse).
- **Texto:**
  > 🧰 Hola {{1}}, tu perfil está activo pero no tienes servicios publicados, así que no te llegan solicitudes. Dinos qué servicios ofreces y los activamos por ti.
- **Variables:** {{1}} «Carlos»
- **Botones:** quick reply «Activar servicios» (id `services_setup`) · URL «Ir a mis servicios» → `https://www.lohaggo.com/{{2}}` (ejemplo `partner/services`)

### C9 · lh_socio_falta_cuenta_bancaria
- **Categoría:** UTILITY
- **Cuándo:** el socio completa su primer servicio y no tiene cuenta bancaria o Nequi registrada.
- **Texto:**
  > 🏦 Hola {{1}}, registra tu cuenta bancaria o Nequi para que los clientes puedan transferirte. Envíanos los datos por aquí o regístrala en la app.
- **Variables:** {{1}} «Carlos»
- **Botones:** quick reply «Registrar por aquí» (id `bank_setup`) · URL «Registrar en la app» → `https://www.lohaggo.com/{{2}}` (ejemplo `partner/bank-accounts`)

### C10 · lh_socio_nueva_solicitud_v2 (reemplaza nueva_solicitud_socio y new_service_request, que quedaron MARKETING)
- **Categoría:** UTILITY
- **Cuándo:** llega una solicitud de un servicio que el socio ofrece en su ciudad. Es el aviso más importante para los socios.
- **Texto:**
  > 🔔 Hola {{1}}, hay una solicitud nueva de *{{2}}* en {{3}} para {{4}}. Envía tu propuesta antes de que otro socio la tome.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «Laureles» · {{4}} «hoy, urgente»
- **Botones:** URL «Ver y proponer» → `https://www.lohaggo.com/{{5}}` (ejemplo `partner?tab=my-requests`) · quick reply «Proponer por aquí» (id `proposal_chat`) · quick reply «No puedo» (id `request_skip`)

### C11 · lh_socio_solicitud_directa
- **Categoría:** UTILITY
- **Cuándo:** un cliente dirige su solicitud a ese socio en concreto.
- **Texto:**
  > ⭐ Hola {{1}}, un cliente te eligió para *{{2}}* en {{3}}. Envíale tu propuesta; esta solicitud solo te llegó a ti.
- **Variables:** {{1}} «Carlos» · {{2}} «Electricidad» · {{3}} «Envigado»
- **Botones:** URL «Ver y proponer» → `https://www.lohaggo.com/{{4}}` (ejemplo `partner?tab=my-requests`) · quick reply «Proponer por aquí» (id `proposal_chat`)

### C12 · lh_socio_propuesta_aceptada_v2
- **Categoría:** UTILITY
- **Cuándo:** el cliente acepta su propuesta; la reserva queda pendiente de que el socio confirme. (La actual propuesta_aceptada_socio no pide confirmar.)
- **Texto:**
  > 🎉 Hola {{1}}, {{2}} aceptó tu propuesta de *{{3}}* para el {{4}}. Confirma la reserva para que el cliente quede tranquilo.
- **Variables:** {{1}} «Carlos» · {{2}} «Ana» · {{3}} «Plomería» · {{4}} «vie 3 oct, 10:00 a. m.»
- **Botones:** quick reply «Confirmar» (id `booking_confirm`) · quick reply «No puedo» (id `booking_decline`) · URL «Ver reserva» → `https://www.lohaggo.com/{{5}}` (ejemplo `partner?tab=bookings`)

### C13 · lh_socio_propuesta_no_elegida
- **Categoría:** UTILITY
- **Cuándo:** el cliente eligió a otro socio o la solicitud venció.
- **Texto:**
  > 📋 Hola {{1}}, el cliente de *{{2}}* eligió otra propuesta esta vez. Te seguimos avisando de nuevas solicitudes por aquí.
- **Variables:** {{1}} «Carlos» · {{2}} «Pintura»

### C14 · lh_socio_confirmar_reserva
- **Categoría:** UTILITY
- **Cuándo:** 2 horas después de aceptada la propuesta, si el socio aún no confirma (a las 6 horas se escala al equipo).
- **Texto:**
  > ⏰ Hola {{1}}, tienes pendiente confirmar el servicio de *{{2}}* del {{3}}. Si no confirmas pronto, reasignaremos al cliente.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «vie 3 oct, 10:00 a. m.»
- **Botones:** quick reply «Confirmar» (id `booking_confirm`) · quick reply «No puedo» (id `booking_decline`)

### C15 · lh_socio_reserva_reprogramada
- **Categoría:** UTILITY
- **Cuándo:** el cliente cambia la fecha u hora; si estaba confirmada, el socio debe reconfirmar.
- **Texto:**
  > 📅 Hola {{1}}, el cliente cambió el servicio de *{{2}}* para el {{3}}. ¿Te queda bien la nueva fecha?
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «sáb 4 oct, 9:00 a. m.»
- **Botones:** quick reply «Sí, confirmo» (id `booking_confirm`) · quick reply «No puedo» (id `booking_decline`)

### C16 · lh_socio_reserva_cancelada
- **Categoría:** UTILITY
- **Cuándo:** el cliente cancela la reserva.
- **Texto:**
  > ❌ Hola {{1}}, el cliente canceló el servicio de *{{2}}* del {{3}}. No tienes que ir; te seguimos avisando de nuevas solicitudes.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «vie 3 oct»

### C17 · lh_socio_recordatorio_manana
- **Categoría:** UTILITY
- **Cuándo:** entre 22 y 25 horas antes del servicio.
- **Texto:**
  > 📅 Hola {{1}}, mañana a las {{2}} tienes el servicio de *{{3}}* en {{4}}. Si surge algo, avísanos por aquí.
- **Variables:** {{1}} «Carlos» · {{2}} «10:00 a. m.» · {{3}} «Plomería» · {{4}} «Laureles»
- **Botón URL:** «Ver dirección y detalles» → `https://www.lohaggo.com/{{5}}` · ejemplo `partner?tab=bookings`

### C18 · lh_socio_servicio_pronto
- **Categoría:** UTILITY
- **Cuándo:** entre 30 y 90 minutos antes del servicio.
- **Texto:**
  > ⏳ Hola {{1}}, tu servicio de *{{2}}* es a las {{3}}. Al llegar, márcalo como iniciado respondiendo aquí o desde la app.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «10:00 a. m.»
- **Botones:** quick reply «Ya llegué» (id `booking_start`) · quick reply «Voy tarde» (id `booking_late`)

### C19 · lh_socio_marcar_terminado
- **Categoría:** UTILITY
- **Cuándo:** 3 horas después de iniciado, si el servicio sigue en curso.
- **Texto:**
  > 🛠️ Hola {{1}}, ¿ya terminaste el servicio de *{{2}}*? Márcalo como terminado para que el cliente pueda pagarte y calificarte.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería»
- **Botones:** quick reply «Sí, terminé» (id `booking_complete`) · quick reply «Aún no» (id `booking_not_done`)

### C20 · lh_socio_pago_reportado_v2 (reemplaza pago_reportado_cliente)
- **Categoría:** UTILITY
- **Cuándo:** el cliente reporta que pagó.
- **Texto:**
  > 💰 Hola {{1}}, {{2}} reportó que te pagó {{3}} en {{4}} por *{{5}}*. ¿Lo recibiste?
- **Variables:** {{1}} «Carlos» · {{2}} «Ana» · {{3}} «$120.000» · {{4}} «efectivo» · {{5}} «Plomería»
- **Botones:** quick reply «Sí, lo recibí» (id `payment_confirm`) · quick reply «No lo recibí» (id `payment_reject`)

### C21 · lh_socio_pago_por_confirmar_v2 (reemplaza pago_pendiente_recordatorio)
- **Categoría:** UTILITY
- **Cuándo:** 24 horas después del reporte del cliente sin confirmación del socio (hasta 5 recordatorios).
- **Texto:**
  > 💰 Hola {{1}}, falta que confirmes el pago de {{2}} por *{{3}}* que reportó {{4}}. Confírmalo para cerrar el servicio.
- **Variables:** {{1}} «Carlos» · {{2}} «$120.000» · {{3}} «Plomería» · {{4}} «Ana»
- **Botones:** quick reply «Sí, lo recibí» (id `payment_confirm`) · quick reply «No lo recibí» (id `payment_reject`)

### C22 · lh_socio_servicio_completado_v2 (reemplaza reserva_completada_socio, que quedó MARKETING)
- **Categoría:** UTILITY
- **Cuándo:** el socio marca completado (o el cliente reporta pago), para cerrar el ciclo.
- **Texto:**
  > ✅ Hola {{1}}, cerramos el servicio de *{{2}}* con {{3}}. Recuerda calificar al cliente; tus calificaciones te ayudan a recibir más solicitudes.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «Ana»

### C23 · lh_socio_calificacion_recibida_v2 (reemplaza calificacion_recibida)
- **Categoría:** UTILITY
- **Cuándo:** un cliente califica al socio.
- **Texto:**
  > ⭐ Hola {{1}}, {{2}} te calificó con {{3}} estrellas por *{{4}}*. Puedes ver el comentario en tu panel.
- **Variables:** {{1}} «Carlos» · {{2}} «Ana» · {{3}} «5» · {{4}} «Plomería»

### C24 · lh_socio_reclamo_garantia
- **Categoría:** UTILITY
- **Cuándo:** un cliente abre un reclamo de garantía sobre un servicio del socio.
- **Texto:**
  > 🛡️ Hola {{1}}, el cliente de *{{2}}* reportó: {{3}}. El equipo te escribirá por aquí para acordar la solución en máximo 24 horas.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «el trabajo quedó incompleto»

### C25 · lh_socio_correccion_programada
- **Categoría:** UTILITY
- **Cuándo:** el equipo resuelve la garantía con «el mismo socio corrige sin costo».
- **Texto:**
  > 🔧 Hola {{1}}, acordamos que corrijas sin costo el servicio de *{{2}}* dentro de las próximas 72 horas. Coordina la hora con el cliente respondiendo aquí.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería»

### C26 · lh_socio_falta_registrada
- **Categoría:** UTILITY
- **Cuándo:** se confirma una falta (no llegó o trabajo mal hecho).
- **Texto:**
  > ⚠️ Hola {{1}}, registramos una falta por el servicio de *{{2}}*: {{3}}. Con 2 faltas en 90 días pausamos el perfil.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería» · {{3}} «no llegaste a la cita»

### C27 · lh_socio_perfil_pausado
- **Categoría:** UTILITY
- **Cuándo:** el perfil se pausa por faltas o por decisión del equipo.
- **Texto:**
  > ⏸️ Hola {{1}}, pausamos tu perfil de socio por {{2}}. Una persona del equipo te escribirá por aquí para revisarlo contigo.
- **Variables:** {{1}} «Carlos» · {{2}} «dos faltas en los últimos 90 días»

### C28 · lh_socio_pago_plataforma_enviado
- **Categoría:** UTILITY
- **Cuándo:** LoHaggo transfiere al socio un pago de un servicio pagado en línea.
- **Texto:**
  > 🏦 Hola {{1}}, te transferimos {{2}} por el servicio de *{{3}}* a tu cuenta terminada en {{4}}. Puedes ver el detalle en tu panel.
- **Variables:** {{1}} «Carlos» · {{2}} «$108.000» · {{3}} «Plomería» · {{4}} «4321»

### C29 · lh_socio_hay_demanda
- **Categoría:** MARKETING
- **Cuándo:** hay solicitudes de un servicio sin socios suficientes y el socio no lo tiene activo.
- **Texto:**
  > 📈 Hola {{1}}, hay clientes pidiendo *{{2}}* en {{3}} y pocos socios para atenderlos. Si lo ofreces, actívalo y empieza a recibir solicitudes.
- **Variables:** {{1}} «Carlos» · {{2}} «Pintura» · {{3}} «Medellín»
- **Botones:** quick reply «Activar servicio» (id `services_setup`) · quick reply «No lo ofrezco» (id `optout_soft`)

### C30 · lh_socio_sin_actividad
- **Categoría:** MARKETING
- **Cuándo:** socio verificado sin proponer en 30 días.
- **Texto:**
  > 👋 Hola {{1}}, hace tiempo no envías propuestas en LoHaggo. Hay solicitudes de *{{2}}* esperando; revisa si alguna te sirve.
- **Variables:** {{1}} «Carlos» · {{2}} «Plomería»
- **Botón URL:** «Ver solicitudes» → `https://www.lohaggo.com/{{3}}` · ejemplo `partner?tab=my-requests`

---

## D. Equipo (administradores)

Se envían a los teléfonos de los administradores que hayan aceptado recibir alertas por WhatsApp. Todas UTILITY.

### C31 · lh_socio_mensaje_cliente
- **Categoría:** UTILITY
- **Cuándo:** el cliente escribió en el chat de la reserva (desde la app o por WhatsApp) y el socio no ha escrito por WhatsApp en las últimas 24 h. Máximo uno cada 30 min por chat.
- **Texto:**
  > 💬 Hola {{1}}, {{2}}, tu cliente, te escribió sobre *{{3}}* (referencia {{4}}). Respóndele por aquí mismo y se lo hacemos llegar, o ábrelo en tu panel.
- **Variables:** {{1}} «Carlos» · {{2}} «Ana» · {{3}} «Plomería» · {{4}} «#a1b2c3»
- **Botones:** URL «Ver mensaje» → `https://www.lohaggo.com/{{5}}` (ejemplo `partner?tab=bookings`)

### D1 · lh_admin_conversacion_traspasada
- **Cuándo:** el agente de IA pasa una conversación a una persona.
- **Texto:**
  > 🙋 Hola {{1}}, una conversación de {{2}} necesita a una persona: {{3}}. Atiéndela desde la bandeja.
- **Variables:** {{1}} «Juan» · {{2}} «WhatsApp» · {{3}} «el cliente pide un reembolso»
- **Botón URL:** «Abrir conversación» → `https://www.lohaggo.com/{{4}}` · ejemplo `admin/inbox?c=abc123`

### D2 · lh_admin_accion_por_aprobar
- **Cuándo:** un agente de bandeja en copiloto propone una acción (crear solicitud, aceptar propuesta…), o Haggo deja una propuesta de riesgo alto.
- **Texto:**
  > ✅ Hola {{1}}, hay una acción esperando tu aprobación: {{2}}. Revísala y apruébala o recházala.
- **Variables:** {{1}} «Juan» · {{2}} «aceptar la propuesta de Carlos por $120.000»
- **Botón URL:** «Revisar» → `https://www.lohaggo.com/{{3}}` · ejemplo `admin/inbox?c=abc123`

### D3 · lh_admin_garantia_nueva
- **Cuándo:** se abre un reclamo de garantía (prioridad alta en daños y no llegó).
- **Texto:**
  > 🛡️ Hola {{1}}, nuevo reclamo de garantía #{{2}}: {{3}} en *{{4}}*. Vence en 72 horas.
- **Variables:** {{1}} «Juan» · {{2}} «A1B2C3» · {{3}} «el socio no llegó» · {{4}} «Plomería»
- **Botón URL:** «Ver reclamo» → `https://www.lohaggo.com/{{5}}` · ejemplo `admin/guarantee`

### D4 · lh_admin_garantia_por_vencer
- **Cuándo:** un reclamo de garantía abierto está a 12 horas de vencer o ya venció.
- **Texto:**
  > ⏰ Hola {{1}}, el reclamo de garantía #{{2}} está así: {{3}}. Resuélvelo desde el panel de garantía.
- **Variables:** {{1}} «Juan» · {{2}} «A1B2C3» · {{3}} «vence en 12 horas»
- **Botón URL:** «Resolver» → `https://www.lohaggo.com/{{4}}` · ejemplo `admin/guarantee`

### D5 · lh_admin_disputa_pago
- **Cuándo:** cliente y socio no coinciden en el pago (el socio rechaza el reporte o reportan métodos distintos).
- **Texto:**
  > ⚠️ Hola {{1}}, hay una disputa de pago en *{{2}}* entre {{3}} y {{4}}. Revisa el caso para resolverlo.
- **Variables:** {{1}} «Juan» · {{2}} «Plomería» · {{3}} «Ana» · {{4}} «Carlos»
- **Botón URL:** «Ver caso» → `https://www.lohaggo.com/{{5}}` · ejemplo `admin?section=payments`

### D6 · lh_admin_reserva_sin_confirmar
- **Cuándo:** una reserva lleva 6 horas sin que el socio confirme (escalamiento).
- **Texto:**
  > ⏰ Hola {{1}}, la reserva de *{{2}}* del {{3}} lleva 6 horas sin confirmar por {{4}}. Considera reasignarla.
- **Variables:** {{1}} «Juan» · {{2}} «Plomería» · {{3}} «vie 3 oct» · {{4}} «Carlos»
- **Botón URL:** «Ver reserva» → `https://www.lohaggo.com/{{5}}` · ejemplo `admin?section=bookings`

### D7 · lh_admin_solicitud_sin_socios
- **Cuándo:** una solicitud lleva 4 horas sin propuestas pese al reenvío.
- **Texto:**
  > 📭 Hola {{1}}, la solicitud de *{{2}}* en {{3}} lleva {{4}} horas sin propuestas. Busca un socio o contacta al cliente.
- **Variables:** {{1}} «Juan» · {{2}} «Pintura» · {{3}} «Belén» · {{4}} «4»
- **Botón URL:** «Ver solicitud» → `https://www.lohaggo.com/{{5}}` · ejemplo `admin/service-requests`

### D8 · lh_admin_documentos_por_revisar
- **Cuándo:** resumen diario (9:00 a. m.) si hay documentos pendientes.
- **Texto:**
  > 📄 Hola {{1}}, hay {{2}} documentos de socios por revisar; el más antiguo lleva {{3}}. Revísalos para activar a los socios.
- **Variables:** {{1}} «Juan» · {{2}} «7» · {{3}} «2 días»
- **Botón URL:** «Revisar documentos» → `https://www.lohaggo.com/{{4}}` · ejemplo `admin/documents`

### D9 · lh_admin_incidente_critico
- **Cuándo:** Haggo o Salud del sistema abren un incidente crítico (proveedor de IA caído, WhatsApp sin enviar, pagos fallando).
- **Texto:**
  > 🚨 Hola {{1}}, incidente crítico en LoHaggo: {{2}}. Revisa Salud del sistema.
- **Variables:** {{1}} «Juan» · {{2}} «los mensajes de WhatsApp no se están enviando»
- **Botón URL:** «Ver incidente» → `https://www.lohaggo.com/{{3}}` · ejemplo `admin/system`

### D10 · lh_admin_resumen_diario
- **Cuándo:** informe diario de Haggo (7:00 a. m.).
- **Texto:**
  > 📊 Hola {{1}}, resumen de ayer en LoHaggo: {{2}} solicitudes, {{3}} reservas y {{4}} en ventas. Haggo tiene {{5}} temas para revisar hoy.
- **Variables:** {{1}} «Juan» · {{2}} «8» · {{3}} «3» · {{4}} «$360.000» · {{5}} «2»
- **Botón URL:** «Abrir Haggo» → `https://www.lohaggo.com/{{6}}` · ejemplo `admin/haggo`

---

## Versiones _v3 (2026-09-27)

Meta pasó a MARKETING cinco plantillas enviadas como UTILITY (`lh_socio_nueva_solicitud_v2`, `lh_socio_solicitud_directa`, `lh_cliente_reserva_cancelada_socio`, `lh_socio_sin_servicios_v2`, `lh_socio_falta_cuenta_bancaria`). Se crearon versiones `_v3` con texto estrictamente transaccional (citan el número de solicitud o reserva, sin urgencia ni beneficios). El código usa la `_v3` cuando está aprobada como UTILITY y, mientras tanto, la anterior.

| Código | Nombre | Texto |
|---|---|---|
| C10 | lh_socio_nueva_solicitud_v3 | 🔔 Hola {{1}}, se creó la solicitud #{{2}} de *{{3}}* en {{4}}, que coincide con los servicios de tu cuenta. Puedes ver los detalles y responder desde tu panel o por aquí. |
| C11 | lh_socio_solicitud_directa_v3 | ⭐ Hola {{1}}, recibiste la solicitud directa #{{2}} de *{{3}}* en {{4}}. Solo se envió a tu cuenta; puedes ver los detalles y responder desde tu panel. |
| B19 | lh_cliente_reserva_cancelada_socio_v3 | ⚠️ Hola {{1}}, tu reserva #{{2}} de *{{3}}* del {{4}} fue cancelada por el socio. Tu solicitud volvió a quedar abierta para recibir otras propuestas. |
| C8 | lh_socio_sin_servicios_v3 | 🧰 Hola {{1}}, tu cuenta de socio está verificada pero no tiene servicios activos, por lo que no se te asignan solicitudes. Puedes activarlos desde tu panel o respondiendo este mensaje. |
| C9 | lh_socio_falta_cuenta_bancaria_v3 | 🏦 Hola {{1}}, tu cuenta de socio no tiene una cuenta bancaria registrada para recibir las transferencias de la reserva #{{2}}. Puedes registrarla desde tu panel o respondiendo este mensaje. |
| B1 | lh_cliente_cuenta_creada_v3 | ✅ Hola {{1}}, se creó tu cuenta de cliente en LoHaggo. Desde ella puedes ver el estado de tus solicitudes y reservas. |
| B4 | lh_cliente_sin_propuestas_v3 | ⏳ Hola {{1}}, tu solicitud #{{2}} de *{{3}}* aún no tiene propuestas y la volvimos a enviar a los socios. Puedes ajustar la fecha o el presupuesto respondiendo este mensaje. |
| B6 | lh_cliente_solicitud_vencida_v3 | 📋 Hola {{1}}, tu solicitud #{{2}} de *{{3}}* venció sin una propuesta aceptada. Puedes reactivarla por 24 horas respondiendo este mensaje. |
| B7 | lh_cliente_solicitud_cancelada_v3 | ✅ Hola {{1}}, confirmamos la cancelación de tu solicitud #{{2}} de *{{3}}*. No recibirás más propuestas para esta solicitud. |
| C7 | lh_socio_perfil_activo_v3 | ✅ Hola {{1}}, aprobamos tu documento de identidad y tu cuenta de socio #{{2}} quedó verificada. Recibirás avisos de las solicitudes de tus servicios activos. |
| C13 | lh_socio_propuesta_no_elegida_v3 | 📋 Hola {{1}}, la solicitud #{{2}} de *{{3}}* se cerró con otra propuesta. Tu propuesta para esta solicitud ya no está activa. |
| C22 | lh_socio_servicio_completado_v3 | ✅ Hola {{1}}, la reserva #{{2}} de *{{3}}* quedó marcada como completada. Falta confirmar el pago y calificar al cliente desde tu panel o respondiendo este mensaje. |
| D7 | lh_admin_solicitud_sin_socios_v3 | 📭 Hola {{1}}, la solicitud #{{2}} de *{{3}}* en {{4}} sigue sin propuestas después de {{5}} horas de publicada. Revísala en el panel. |

## Resumen

| Grupo | Nuevas | Categoría |
|---|---|---|
| Autenticación | 1 | AUTHENTICATION |
| Clientes | 22 UTILITY + 3 MARKETING | |
| Socios | 28 UTILITY + 2 MARKETING | |
| Equipo | 10 | UTILITY |
| **Total a crear** | **66** | |

Prioridad de creación (si hay que escalonar), por impacto en el flujo:
1. B3 nueva propuesta, C10 nueva solicitud socio, C12 propuesta aceptada, B8 reserva pendiente, C14 confirmar reserva, B9 socio no disponible, A1 código.
2. B14 terminado y pago, C20 pago reportado, C21 pago por confirmar, B16 pago confirmado, B18 calificar, B11/C17 recordatorio mañana, B12/C18 servicio pronto.
3. Garantía (B20, B21, C24, C25, D3, D4), alta de socios (C1, C3, C4, C6, C7, C8), equipo (D1, D2, D5, D6).
4. El resto.


### B28 · lh_cliente_reserva_cancelada_equipo
- Categoría: UTILITY · Para: cliente · Cuándo: el equipo cancela la reserva (admin o Haggo aprobado) sin reabrirla.
- Texto: «❌ Hola {{1}}, el equipo de LoHaggo canceló tu reserva de *{{2}}* del {{3}}. Motivo: {{4}}. Si aún necesitas el servicio, puedes pedirlo de nuevo con el botón de abajo.»
- Botón: «Ver mis solicitudes» → https://www.lohaggo.com/{{5}}

### C32 · lh_socio_reserva_cancelada_equipo
- Categoría: UTILITY · Para: socio · Cuándo: el equipo cancela la reserva.
- Texto: «❌ Hola {{1}}, el equipo de LoHaggo canceló el servicio de *{{2}}* del {{3}}. Motivo: {{4}}. No tienes que ir; si tienes dudas, escríbenos por aquí.»
