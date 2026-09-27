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
- Operación por chat: 20 herramientas para que clientes y socios hagan todo por WhatsApp/Messenger/Instagram (pedir un servicio, aceptar propuestas, reprogramar, cancelar, reportar y confirmar pagos, calificar, proponer como socio, editar su perfil). Vinculación de la cuenta con un código, confirmación explícita antes de lo que compromete dinero o agenda, límites diarios por conversación, marca origin='chat' en cada registro, registro en AiAgentAction y, en copiloto, aprobación de la acción en la bandeja.
- Marketing: agentes de marketing por campaña (estrategia, plan, redacción, programación), editor de publicaciones con revisión editorial (corrector y editor), blog y redes (Facebook, Instagram), y agente de pauta que prepara anuncios para Meta Ads (se suben a mano).
- Afirmaciones públicas del sitio (confianza y promociones) controladas por interruptores (lib/public/claims.ts); las cifras salen de la base y solo se muestran sobre un mínimo. Nada inventado.
- Analítica del admin con corte app frente a chat, salud del sistema, casos e incidentes, modo TV.
- Tú (Haggo) supervisas todo, propones acciones y el superadmin aprueba; en las áreas que él ponga en autónomo actúas solo con riesgo bajo o medio permitido.`

export type ChangelogEntry = { date: string; area: string; change: string; impacto: string; comoVerlo: string }

/** Newest first. At most ~15 entries: the big features only. */
export const PLATFORM_CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-27',
    area: 'Operación por chat',
    change: 'Los agentes de la bandeja gestionan la cuenta de clientes y socios por chat con 20 herramientas: núcleo compartido (lib/*/ops.ts) con marca de origen en solicitudes, propuestas, reservas, pagos y reseñas; BookingEvent para estados, reprogramaciones y pagos. Correcciones: fecha de aceptación, máquina de estados de la reserva, webhook de MercadoPago y Payout al confirmar el pago.',
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
  {
    date: '2026-09-26',
    area: 'Admin',
    change: 'Todo el admin se ve bien en celular (barra superior, tablas y tarjetas adaptadas).',
    impacto: 'El superadmin puede operar desde el teléfono.',
    comoVerlo: 'No se mide en datos.',
  },
  {
    date: '2026-09-26',
    area: 'Haggo',
    change: 'Fase 5: avisos por correo al superadmin y hallazgos en el modo TV.',
    impacto: 'Lo grave llega al correo aunque nadie mire el admin.',
    comoVerlo: 'Ajustes de Haggo.',
  },
  {
    date: '2026-09-25',
    area: 'Haggo',
    change: 'Fases 1 a 4: Haggo observa, conversa, propone acciones y actúa solo donde se le permite, verificando el resultado.',
    impacto: 'Supervisión continua de toda la plataforma.',
    comoVerlo: 'hallazgos_abiertos.',
  },
  {
    date: '2026-09-25',
    area: 'IA',
    change: 'OpenAI como segundo proveedor de IA de texto con cambio automático si Claude falla.',
    impacto: 'Los agentes siguen respondiendo si un proveedor cae.',
    comoVerlo: 'salud_sistema y costos_ia (por proveedor).',
  },
  {
    date: '2026-09-25',
    area: 'Admin',
    change: 'Analítica de negocio, salud del sistema y limpieza del admin.',
    impacto: 'Embudo, oferta y demanda, personas y atención en un solo lugar.',
    comoVerlo: 'tendencias_negocio, oferta_y_demanda, salud_sistema.',
  },
  {
    date: '2026-09-24',
    area: 'Marketing',
    change: 'Agente de marketing autónomo por campaña y publicaciones omnicanal (blog, Facebook, Instagram) con programación y estadísticas.',
    impacto: 'Contenido constante sin trabajo manual.',
    comoVerlo: 'marketing y agentes_marketing.',
  },
  {
    date: '2026-09-24',
    area: 'Bandeja',
    change: 'Modo copiloto de los agentes de IA, comentarios de Facebook e Instagram atendidos por IA y creación de cuentas desde la bandeja.',
    impacto: 'Más conversaciones atendidas por IA con una persona supervisando.',
    comoVerlo: 'atencion y agente_ia.',
  },
  {
    date: '2026-09-23',
    area: 'Bandeja',
    change: 'Agentes de IA conversacionales en la bandeja omnicanal, con Messenger e Instagram.',
    impacto: 'Atención 24/7 por chat.',
    comoVerlo: 'atencion y conversaciones_en_espera.',
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
