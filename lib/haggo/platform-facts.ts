/**
 * What LoHaggo is able to do today and what changed recently, for Haggo's system prompt (static part,
 * cached) and for the read tool `novedades_plataforma`. Pure: update it with every big feature.
 */

export const PLATFORM_CAPABILITIES = `Cómo funciona LoHaggo hoy:
- Marketplace de servicios del hogar: el cliente crea una solicitud (servicio, ciudad, dirección, fecha) → los socios verificados de esa ciudad y servicio mandan propuestas con precio → el cliente acepta una → nace la reserva: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED. Se puede reprogramar y cancelar (política de 24 h / 2 h antes del servicio). Cada cambio queda en BookingEvent con su origen.
- Pagos: efectivo o transferencia directo al socio. El cliente reporta que pagó y el socio lo confirma; al confirmar se registra el Payout contable del socio. MercadoPago (pago en línea) es opcional y hoy depende de la configuración.
- Comisiones: PlatformConfig.commissionEnabled. Apagada = no se cobra nada (ni al cliente ni al socio); encendida = tasas de cliente y de socio en porcentaje.
- Verificación de socios: solo el documento de identidad es obligatorio. Antecedentes y diplomas son opcionales.
- Ciudades: CityConfig con estado ACTIVE, COMING_SOON o INACTIVE; solo las activas reciben solicitudes.
- Bandeja omnicanal (WhatsApp, Messenger, Instagram, SMS, correo) con agentes de IA en piloto (responden solos) o copiloto (sugieren a una persona).
- WhatsApp es el canal principal: un catálogo de plantillas (lib/messaging/wa-catalog.ts) que salen solas en cada evento (propuestas, reservas, pagos, garantía, documentos, avisos al equipo). Se activan el día que Meta las aprueba (registro en vivo de Twilio); mientras tanto cae a la plantilla vieja aprobada o no sale. Cada envío queda en la conversación y los botones de respuesta rápida los atiende el agente de IA.
- Operación por chat: herramientas (por grupos; las de cada agente en agente_ia) para que clientes y socios hagan todo por WhatsApp/Messenger/Instagram (pedir un servicio, aceptar propuestas, reprogramar, cancelar, reportar y confirmar pagos, calificar, proponer como socio, editar su perfil, reclamar la garantía). Vinculación de la cuenta con un código, confirmación explícita antes de lo que compromete dinero o agenda, límites diarios por conversación, marca origin='chat' en cada registro, registro en AiAgentAction y, en copiloto, aprobación de la acción en la bandeja.
- Marketing: agentes de marketing por campaña (estrategia, plan, redacción, programación), editor de publicaciones con revisión editorial (corrector y editor), blog y redes (Facebook, Instagram), y agente de pauta que prepara anuncios para Meta Ads (se suben a mano).
- Garantía LoHaggo (lib/guarantee/policy.ts, página /garantia): cubre «no llegó» (hasta 24 h después de la hora), trabajo incompleto o distinto (hasta 72 h después de completada) y daños (siempre una persona; LoHaggo media, no paga daños). Remedios: otro socio con prioridad (solicitud nueva urgente), cancelación sin costo, que el mismo socio corrija, y reembolso solo si pagó en línea. SLA: solución en 24 h, resuelto en 72 h. 2 faltas del socio en 90 días lo pausan solo; con 3 el equipo decide suspender. El cliente reclama por chat (reportar_problema_servicio) y el equipo resuelve en /admin/guarantee; tú solo recomiendas.
- Afirmaciones públicas del sitio (confianza y promociones) controladas por interruptores (lib/public/claims.ts); las cifras salen de la base y solo se muestran sobre un mínimo. Nada inventado.
- Pedir sin cuenta: al final del formulario el cliente confirma su celular con un código por WhatsApp (plantilla A1) y queda con sesión; si el número no tiene cuenta se crea una de cliente con correo interno (wa-…@clientes.lohaggo.com, nunca recibe correo). Una cuenta existente cuyo celular nunca se confirmó recibe el enlace en su correo. /login también entra con código, y el enlace de acceso a pedido llega por WhatsApp (B2/C2) al número de la cuenta.
- Socios: zonas de cobertura (16 comunas de Medellín y 6 municipios, lib/geo/zones.ts) y horario semanal (Availability); cada solicitud guarda su zona y los avisos van primero a quien cubre la zona y el horario (si nadie, a toda la ciudad). Propuestas con fecha y hora: al aceptarlas la reserva queda para ese momento.
- Reservas: el cliente y el socio reprograman desde la app; cancelar exige motivo; el cliente califica al completarse sin esperar el pago; el socio sube fotos antes y después (respaldo de la garantía); «Pedir de nuevo» crea una solicitud directa al mismo socio (app y chat, herramienta pedir_de_nuevo).
- Supervisión de solicitudes («Solicitud 360» en /admin/service-requests/[id]): el equipo ve todo de una solicitud (fotos, socios avisados, propuestas con fecha, el chat de cada propuesta con sus imágenes e intentos bloqueados de pasar contacto, la reserva con su historial, fotos del trabajo, pago, reseña, garantía, reembolsos, casos y origen) y puntos de atención calculados (lib/admin/attention-core.ts). Puede intervenir: escribir en el chat como «Soporte LoHaggo», volver a avisar a socios, reactivar, cambiar estado, reprogramar, cancelar con motivo y reabrir a otros socios, y abrir casos. Tú propones esas intervenciones (requests.*) y una persona las aprueba.
- Atribución de punta a punta: cada solicitud y reserva guarda su primer y último toque (anuncio de Meta con su pauta, publicación, blog, página de la web, perfil de Google, chat directo). Las pautas llevan su código (ad-…) en la UTM y en el mensaje prellenado de WhatsApp; el gasto diario se carga a mano en Marketing → Pauta. Lead (solicitud) y Purchase (reserva completada) van a Meta (API de Conversiones) y GA4 una vez cada uno. Meta de la pauta: menos de $25.000 por solicitud.
- Analítica del admin con corte app frente a chat, pestaña Origen (de dónde vienen las solicitudes), salud del sistema, casos e incidentes, modo TV.
- Tú (Haggo) supervisas todo, propones acciones y el superadmin aprueba; en las áreas que él ponga en autónomo actúas solo con riesgo bajo o medio permitido.`

export type ChangelogEntry = { date: string; area: string; change: string; impacto: string; comoVerlo: string }

/** Newest first. At most ~15 entries: the big features only. */
export const PLATFORM_CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-10-01',
    area: 'Marketing',
    change: 'Formatos de Meta por cuenta: Admin → Canales muestra qué puede publicar cada cuenta (Instagram: foto, carrusel, reel, reel de prueba, historia; Facebook: publicación, reel, historia), si tiene permiso de estadísticas y el cupo de Instagram de 24 h (100). La herramienta marketing trae cuentas_meta y hay reglas mk:publish-scopes, mk:ig-quota y mk:no-insights. El alcance de Facebook se lee de por vida (antes salía en 0). Historias, reels de Facebook y reels de prueba aún no tienen código: vienen en las siguientes fases.',
    impacto: 'Se sabe de antemano si una cuenta puede publicar y medir cada formato, y el alcance de Facebook deja de salir en 0.',
    comoVerlo: 'marketing → cuentas_meta, y las reglas mk:publish-scopes, mk:ig-quota y mk:no-insights.',
  },
  {
    date: '2026-09-29',
    area: 'Haggo',
    change: 'Haggo ve más y actúa en más: herramientas socio_detalle, conversacion_detalle, trafico_web y automatizaciones; seguridad con IP más activas y presión de límites; dinero con reembolsos fallidos e incidentes de pago. Foto con webhooks, servicios externos, mensajes automáticos, cobertura de socios, ciudades listas para abrir, conversiones y costo de IA de 7 días (cada parte con respaldo propio: si una falla queda en unavailable). Reglas money:refunds-failed, money:payment-incidents, money:payout-no-bank, users:partners-no-coverage, sys:webhooks-failing, sys:automations-failing, sys:wa-templates-recategorized, mk:attribution-coverage, mk:conversions-silent, ai:cost-spike y cities:ready-to-launch. Acciones ai_agents.dismiss_gap, messaging.pause_campaign, requests.set_booking_status, security.block_ip y security.unblock_ip; operations.notify_partners comparte el tope con Solicitud 360; no se reactiva a un socio pausado por faltas de garantía. Un informe por turno (antes que el ciclo) y los que se cortan se reintentan; los avisos críticos de solicitudes llegan en un solo correo por ciclo.',
    impacto: 'Menos puntos ciegos (dinero, webhooks, automatizaciones, tráfico) y menos correos repetidos; los informes ya no se pierden por tiempo.',
    comoVerlo: 'Las herramientas nuevas, la foto (unavailable, webhooks, automations, partnerCoverage, cities, conversions, aiCost.avg7d) y las reglas nuevas.',
  },
  {
    date: '2026-09-29',
    area: 'Supervisión de solicitudes',
    change: '«Solicitud 360» en el admin con todo el recorrido de cada solicitud y puntos de atención (sin propuestas, reserva sin confirmar o con la hora pasada, en curso trabada, pagos en disputa o sin confirmar, intentos de pasar contacto, quejas en el chat, precio distinto a la propuesta, garantía). Intervenciones del admin (chat como Soporte, reavisar, reactivar, estado, reprogramar, cancelar y reabrir, casos) y los intentos bloqueados quedan registrados (CHAT_CONTACT_BLOCKED). Herramientas solicitudes_con_atencion y solicitud_detalle, foto requestAttention, reglas ops:attention:*, ops:chat-contact-attempts, ops:chat-complaints y acciones requests.message_chat, requests.reactivate, requests.reschedule_booking, requests.cancel_booking, requests.open_case.',
    impacto: 'Nada de lo que pasa en una solicitud queda fuera de la vista del equipo; los casos que se traban o que se intentan sacar de la plataforma se detectan y se atienden a tiempo.',
    comoVerlo: 'solicitudes_con_atencion, solicitud_detalle, la foto (requestAttention.*) y las reglas ops:attention:*.',
  },
  {
    date: '2026-09-28',
    area: 'Escala y Bogotá',
    change: 'Campañas a clientes con segmentos (sin reservas, inactivos 30/60 días, por servicio, por zona), UTM y código cmp-… con solicitudes y reservas por campaña; las campañas de WhatsApp respetan horario y la etiqueta sin-marketing. Estado del reembolso por WhatsApp en cada cambio (B22) y aviso de transferencia al socio (C28). Regla semanal de pauta (mk:budget-shift). apertura_ciudad y config.set_city_status exige cobertura mínima (3 socios en cada servicio de foco y 15 en total) y al activar avisa a la lista de espera. Portada más liviana, botones flotantes sin choque y /servicios?q=.',
    impacto: 'Se puede reactivar clientes y medir qué campaña trae solicitudes; Bogotá abre solo cuando está lista y con la gente avisada.',
    comoVerlo: 'apertura_ciudad, resultados_marketing (canal «Campañas a clientes») y las reglas mk:budget-shift.',
  },
  {
    date: '2026-09-28',
    area: 'Conversión y retención',
    change: 'Pedir sin cuenta con código por WhatsApp (PhoneLoginCode, límites compartidos en Postgres con RateLimitHit), entrar con código en /login y enlace de acceso a pedido por WhatsApp; propuestas con fecha y hora; tarjeta de propuesta con calificación, reseñas, trabajos y perfil, ordenadas por mejor valorado; reprogramar y cancelar con motivo obligatorio en la app; calificar sin esperar el pago; tarjeta «Reporta tu pago»; fotos del trabajo; «Pedir de nuevo» y «Solicitar a este socio»; zonas y horario del socio con avisos por zona; 24 páginas de servicio por zona (SEO local); lista de espera con WhatsApp y aviso real de apertura.',
    impacto: 'Menos abandono al final del formulario, reservas con fecha clara, más confianza al elegir socio y clientes que vuelven con el mismo socio.',
    comoVerlo: 'conversion_clientes, socios (con_zonas, con_horario), la foto (phoneLogin.*) y la regla ops:phone-codes-unused.',
  },
  {
    date: '2026-09-28',
    area: 'Marketing y medición',
    change: 'Atribución de punta a punta: ServiceRequest y Booking guardan acquisition (primer toque) y lastTouch (último); la web lo toma de las cookies lh_acq y lh_lt (UTM, fbclid, gclid, referrer) y el chat de la conversación (anuncio con ctwa_clid, refs post-/ad-/web-/blog-). Conversiones Lead y Purchase al servidor (API de Conversiones de Meta, también business_messaging para clic a WhatsApp, y GA4 Measurement Protocol) con registro en ConversionEvent. Gasto diario manual por pauta (MarketingAdSpend), pestaña Analítica → Origen, KPI «solicitudes» y «reservas» del agente de marketing, enlace corto /w/post-… en Facebook y mensaje prellenado con código en cada pauta. Acciones marketing.request_ad_package y marketing.propose_budget_shift.',
    impacto: 'Se sabe qué anuncio, publicación o página trae solicitudes y reservas y cuánto cuesta cada una; Meta optimiza la pauta con conversiones reales.',
    comoVerlo: 'resultados_marketing, la foto (attribution.*) y las reglas mk:spend-no-requests y mk:conversions-failed.',
  },
  {
    date: '2026-09-27',
    area: 'WhatsApp',
    change: 'Plantillas de WhatsApp conectadas a sus eventos: registro en vivo de Twilio (aprobada / pendiente / rechazada / recategorizada, caché 30 min), elección de la primera aprobada como UTILITY con caída a MARKETING (horario y exclusión) y a la plantilla vieja; deduplicación por evento; cada envío queda en la conversación y los botones llegan al agente de IA con la reserva o pago al que se refieren. Nuevos avisos por tiempo (confirmar reserva, marcar terminado, pago pendiente, documentos, resumen diario al equipo) y herramienta reactivar_solicitud.',
    impacto: 'Clientes y socios reciben los avisos fuera de la ventana de 24 h y pueden responder con un toque; el equipo se entera de traspasos, disputas, garantías e incidentes críticos por WhatsApp.',
    comoVerlo: 'mensajeria (estado del catálogo y envíos por plantilla en 24 h), la regla sys:wa-templates-rejected y Admin → Mensajería → Catálogo.',
  },
  {
    date: '2026-09-27',
    area: 'Garantía',
    change: 'Garantía LoHaggo de punta a punta: política única (lib/guarantee/policy.ts) publicada en /garantia, reclamos GuaranteeClaim con caso en la cola GUARANTEE y SLA de 72 h, herramienta de chat reportar_problema_servicio para clientes, pantalla /admin/guarantee para resolver (otro socio, cancelar sin costo, corregir, reembolso solo con pago en línea, mediación) y faltas del socio con pausa automática a las 2 en 90 días. La afirmación trust_guarantee queda sin respaldo si hay reclamos vencidos.',
    impacto: 'Los clientes tienen una promesa concreta y verificable; el equipo, un procedimiento; los socios que fallan pierden solicitudes.',
    comoVerlo: 'garantia (activos, vencidos, faltas por socio), la foto (guarantee.*) y las reglas ops:guarantee-overdue y ops:partner-strikes.',
  },
  {
    date: '2026-09-27',
    area: 'Operación por chat',
    change: 'Los agentes de la bandeja gestionan la cuenta de clientes y socios por chat con herramientas de plataforma: núcleo compartido (lib/*/ops.ts) con marca de origen en solicitudes, propuestas, reservas, pagos y reseñas; BookingEvent para estados, reprogramaciones y pagos. Correcciones: fecha de aceptación, máquina de estados de la reserva, webhook de MercadoPago y Payout al confirmar el pago.',
    impacto: 'Clientes y socios pueden operar sin abrir la app; cada registro dice si salió de la app o del chat.',
    comoVerlo: 'acciones_por_chat, actividad_reciente (origen) y la foto (origin.*Chat frente a *App).',
  },
  {
    date: '2026-09-27',
    area: 'Bandeja y analítica',
    change: 'Acciones del agente visibles en la bandeja (aprobación en copiloto), herramientas agrupadas en la ficha del agente, insignias «Por chat» y corte app frente a chat en la analítica.',
    impacto: 'El equipo ve y aprueba lo que hacen los agentes; la analítica separa lo que nace en el chat.',
    comoVerlo: 'agente_ia (herramientas por grupo), acciones_por_chat.',
  },
  {
    date: '2026-09-27',
    area: 'Sitio público y confianza',
    change: 'Sitio sin datos inventados: cifras, testimonios y promociones salen de la base o de interruptores de afirmaciones (FeatureFlag) que solo se encienden si son verdad.',
    impacto: 'Nada de publicidad engañosa; una afirmación encendida sin respaldo es un problema grave.',
    comoVerlo: 'configuracion_plataforma (afirmaciones y no respaldadas) y la regla trust:unbacked.',
  },
  {
    date: '2026-09-27',
    area: 'Dinero',
    change: 'La comisión apagada se respeta en todo el flujo: con commissionEnabled = false no se cobra comisión al cliente ni al socio.',
    impacto: 'Precios y pagos a socios coherentes con la promoción de lanzamiento.',
    comoVerlo: 'configuracion_plataforma (comisiones) y dinero.',
  },
  {
    date: '2026-09-26',
    area: 'Marketing',
    change: 'Agente de pauta para Meta Ads: prepara anuncios (texto, público, imagen) con tope diario; se suben a mano.',
    impacto: 'Pauta pagada preparada por IA sin gastar sola.',
    comoVerlo: 'marketing (pautas_7d).',
  },
  {
    date: '2026-09-26',
    area: 'Marketing',
    change: 'Revisión editorial automática (corrector y editor experto); el agente aplica las sugerencias y aprende de ellas; Haggo puede pedir otra revisión.',
    impacto: 'Las piezas no salen sin revisión; el editor puede retenerlas.',
    comoVerlo: 'marketing (retenidas_por_editor) y la foto (marketing.editorial).',
  },
  {
    date: '2026-09-26',
    area: 'Marketing',
    change: 'Calendario con arrastrar y soltar por canal e idea; el plan revisa semana a semana hasta el fin de la campaña.',
    impacto: 'Reprogramar publicaciones es más fácil; planes más largos.',
    comoVerlo: 'marketing (programadas).',
  },
]

export function changelogText(entries: ChangelogEntry[] = PLATFORM_CHANGELOG, max = 10) {
  return entries.slice(0, max).map((e) => `- ${e.date} · ${e.area}: ${e.change} Impacto: ${e.impacto}`).join('\n')
}

/** Static and cacheable: it only changes with a deploy. */
export const PLATFORM_FACTS_PROMPT = `${PLATFORM_CAPABILITIES}

Novedades recientes del producto (más nuevas primero; comprueba si ya se notan en los datos):
${changelogText()}`

export type ConfigStatus = {
  commission: { enabled: boolean; clientRate: number; partnerRate: number } | null
  payments: { cash: boolean; transfer: boolean; mercadoPago: boolean } | null
  cities: { active: string[]; comingSoon: string[] }
  claimsOn: string[]
  unbacked: Array<{ key: string; why: string }>
}

/** Short dynamic block computed each cycle; pure so it can be tested. */
export function configStatusText(s: ConfigStatus) {
  const c = s.commission
  const p = s.payments
  return [
    'Estado de configuración (ahora):',
    `- Comisiones: ${c ? (c.enabled ? `encendidas (cliente ${c.clientRate} %, socio ${c.partnerRate} %)` : 'apagadas (no se cobra)') : 'sin configurar'}`,
    `- Medios de pago: ${p ? [p.cash && 'efectivo', p.transfer && 'transferencia', p.mercadoPago && 'MercadoPago'].filter(Boolean).join(', ') || 'ninguno' : 'sin configurar'}`,
    `- Ciudades activas: ${s.cities.active.join(', ') || 'ninguna'}${s.cities.comingSoon.length ? `; próximamente: ${s.cities.comingSoon.join(', ')}` : ''}`,
    `- Afirmaciones públicas encendidas: ${s.claimsOn.join(', ') || 'ninguna'}`,
    `- Afirmaciones sin respaldo: ${s.unbacked.length ? s.unbacked.map((u) => `${u.key} (${u.why})`).join('; ') : 'ninguna'}`,
  ].join('\n')
}
