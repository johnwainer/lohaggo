/**
 * WhatsApp templates, pure part: which template of a list of candidates goes out given Meta's state, the
 * fallback to the older approved templates while Meta reviews the new ones, variable checks and the text
 * the inbox shows for a sent template. No server imports (tests and the admin screen use it).
 */
import { WA_CATALOG, type WaCatalogEntry } from '@/lib/messaging/wa-catalog'

/** What Twilio/Meta say about one template (by friendly name or WhatsApp name). */
export type RegistryEntry = {
  name: string
  sid: string
  /** approved · pending · received · rejected · unsubmitted · paused · disabled */
  status: string
  /** Final category Meta gave it: UTILITY · MARKETING · AUTHENTICATION (null while unknown) */
  category: string | null
  reason: string | null
  /** Body as stored in Twilio (for templates outside the catalog) */
  body: string | null
  /** Variable numbers the template declares */
  vars: string[]
}

export type Candidate = { name: string; vars: Record<string, string> }

export type Selection =
  | { ok: true; name: string; sid: string; category: string; vars: Record<string, string>; body: string | null; via: 'utility' | 'marketing' | 'legacy'; requested: string }
  | { ok: false; reason: 'not_approved' | 'marketing_blocked'; requested: string }

const CATALOG = new Map<string, WaCatalogEntry>(WA_CATALOG.map((t) => [t.name, t]))

export function catalogEntry(name: string): WaCatalogEntry | undefined {
  return CATALOG.get(name)
}

export const isApproved = (e: RegistryEntry | undefined | null): e is RegistryEntry => Boolean(e && e.status === 'approved' && e.sid)
const categoryOf = (e: RegistryEntry) => (e.category || '').toUpperCase()
const isTransactional = (e: RegistryEntry) => categoryOf(e) === 'UTILITY' || categoryOf(e) === 'AUTHENTICATION'

/**
 * Older approved templates a new one can fall back to while Meta reviews it, with the variables mapped from
 * the new template's ones. Only where the old text is still true for the event.
 */
export const LEGACY_FALLBACK: Record<string, { name: string; vars: (v: Record<string, string>) => Record<string, string> }> = {
  lh_socio_nueva_solicitud_v2: { name: 'nueva_solicitud_socio', vars: (v) => ({ '1': v['1'], '2': v['2'], '3': v['4'] }) },
  lh_socio_propuesta_aceptada_v2: { name: 'propuesta_aceptada_socio', vars: (v) => ({ '1': v['1'], '2': v['3'], '3': v['4'] }) },
  lh_socio_perfil_activo: { name: 'socio_activado_wa', vars: (v) => ({ '1': v['1'] }) },
  lh_socio_documento_aprobado: { name: 'documentos_aprobados_wa', vars: (v) => ({ '1': v['1'] }) },
  lh_socio_documento_rechazado_v2: { name: 'documentos_rechazados_wa', vars: (v) => ({ '1': v['1'] }) },
  lh_socio_cuenta_creada: { name: 'bienvenida_socio', vars: (v) => ({ '1': v['1'] }) },
  lh_cliente_servicio_terminado_pago: { name: 'reserva_completada_cliente', vars: (v) => ({ '1': v['1'], '2': v['3'] }) },
  lh_socio_servicio_completado_v2: { name: 'reserva_completada_socio', vars: (v) => ({ '1': v['1'], '2': v['2'] }) },
  lh_cliente_reserva_cancelada_socio: { name: 'reserva_cancelada', vars: (v) => ({ '1': v['1'], '2': v['3'] }) },
  lh_cliente_socio_no_disponible: { name: 'reserva_cancelada', vars: (v) => ({ '1': v['1'], '2': v['3'] }) },
  lh_socio_reserva_cancelada: { name: 'reserva_cancelada', vars: (v) => ({ '1': v['1'], '2': v['2'] }) },
}

/** WhatsApp rejects variables with line breaks, tabs or more than four spaces in a row; the URL suffix goes without a leading slash. */
export function cleanVar(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
}

export function cleanVars(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(vars)) out[k] = cleanVar(v)
  return out
}

/** Variables the template declares that are missing or empty. */
export function missingVars(declared: string[], vars: Record<string, string>): string[] {
  return declared.filter((k) => !cleanVar(vars[k]))
}

export function declaredVars(name: string, registry?: RegistryEntry | null): string[] {
  const c = catalogEntry(name)
  if (c) return Object.keys(c.variables)
  return registry?.vars ?? []
}

/**
 * Picks the template to send from an ordered list of candidates:
 * 1) the first approved as UTILITY (or AUTHENTICATION);
 * 2) otherwise the first approved as MARKETING, only if marketing may go to this person now;
 * 3) otherwise an older approved template mapped from a candidate (LEGACY_FALLBACK), same marketing rule.
 */
export function selectTemplate(candidates: Candidate[], lookup: (name: string) => RegistryEntry | undefined, opts: { allowMarketing: boolean }): Selection {
  const requested = candidates[0]?.name ?? ''
  let blocked = false
  const pick = (e: RegistryEntry, c: Candidate, via: 'utility' | 'marketing' | 'legacy') =>
    ({ ok: true as const, name: e.name, sid: e.sid, category: categoryOf(e) || 'UTILITY', vars: cleanVars(c.vars), body: catalogEntry(c.name)?.body ?? e.body, via, requested })

  for (const c of candidates) {
    const e = lookup(c.name)
    if (isApproved(e) && isTransactional(e)) return pick(e, c, 'utility')
  }
  for (const c of candidates) {
    const e = lookup(c.name)
    if (!isApproved(e) || categoryOf(e) !== 'MARKETING') continue
    if (opts.allowMarketing) return pick(e, c, 'marketing')
    blocked = true
    break
  }
  for (const c of candidates) {
    const legacy = LEGACY_FALLBACK[c.name]
    if (!legacy) continue
    const e = lookup(legacy.name)
    if (!isApproved(e)) continue
    if (categoryOf(e) === 'MARKETING' && !opts.allowMarketing) { blocked = true; continue }
    return { ok: true, name: e.name, sid: e.sid, category: categoryOf(e) || 'UTILITY', vars: cleanVars(legacy.vars(c.vars)), body: e.body, via: 'legacy', requested }
  }
  return { ok: false, reason: blocked ? 'marketing_blocked' : 'not_approved', requested }
}

export function renderText(body: string | null | undefined, vars: Record<string, string>): string {
  return String(body ?? '').replace(/\{\{(\d+)\}\}/g, (_m, k: string) => vars[k] ?? '')
}

/**
 * The inbox copy of a sent template: body with the variables filled in and the buttons as text, so the AI
 * agent sees what the person is answering. Templates outside the catalog show their Twilio body.
 */
export function renderForInbox(name: string, body: string | null, vars: Record<string, string>): string {
  const entry = catalogEntry(name)
  const text = entry?.category === 'AUTHENTICATION'
    ? `Código de verificación de LoHaggo enviado (vence en 10 minutos).`
    : renderText(body ?? entry?.body ?? '', vars).trim() || `[Plantilla: ${name}]`
  const buttons = [...(entry?.quickReplies.map((q) => q.title) ?? []), ...(entry?.url ? [entry.url.title] : [])]
  return buttons.length ? `${text}\n[Botones: ${buttons.join(' · ')}]` : text
}

/** Where each catalog template is sent from (shown in the admin, used by Haggo). */
export const WA_TEMPLATE_USAGE: Record<string, string> = {
  lh_codigo_verificacion: 'Vincular una conversación a una cuenta (código por WhatsApp)',
  lh_cliente_cuenta_creada: 'Registro del cliente (web o bandeja)',
  lh_cliente_acceso_enlace_v2: 'Sin conectar: enlace de acceso a pedido',
  lh_cliente_nueva_propuesta: 'Un socio envía una propuesta',
  lh_cliente_sin_propuestas: 'Solicitud sin propuestas a las 2 h',
  lh_cliente_solicitud_por_vencer_v2: 'Faltan 1-2 h para que venza la solicitud',
  lh_cliente_solicitud_vencida: 'La solicitud venció',
  lh_cliente_solicitud_cancelada: 'El cliente cancela su solicitud',
  lh_cliente_reserva_pendiente: 'El cliente acepta una propuesta',
  lh_cliente_socio_no_disponible: 'El socio rechaza la reserva pendiente (se reabre la solicitud)',
  lh_cliente_reserva_reprogramada: 'El socio o el equipo reprograman la reserva',
  lh_cliente_recordatorio_manana_v2: 'Recordatorio 22-25 h antes del servicio',
  lh_cliente_servicio_pronto_v2: 'Recordatorio 30-90 min antes del servicio',
  lh_cliente_servicio_iniciado: 'El socio marca el servicio en curso',
  lh_cliente_servicio_terminado_pago: 'El socio marca el servicio completado',
  lh_cliente_pago_pendiente: 'Pago sin reportar 24 h después de completado',
  lh_cliente_pago_confirmado_v2: 'El socio confirma que recibió el pago',
  lh_cliente_pago_rechazado_v2: 'El socio rechaza el pago reportado',
  lh_cliente_recordatorio_calificar_v2: 'Sin calificación 24 h después del servicio',
  lh_cliente_reserva_cancelada_socio: 'El socio cancela una reserva confirmada (se reabre la solicitud)',
  lh_cliente_reserva_cancelada_socio_v3: 'El socio cancela una reserva confirmada (se reabre la solicitud)',
  lh_cliente_garantia_recibida: 'Se registra un reclamo de garantía',
  lh_cliente_garantia_resuelta: 'El equipo resuelve el reclamo de garantía',
  lh_cliente_reembolso_estado: 'Sin conectar: cambios de estado de reembolso',
  lh_cliente_volver_a_pedir: '30 días después del último servicio (marketing)',
  lh_cliente_solicitud_sin_terminar: 'Pedido por chat sin terminar hace 24-48 h (marketing)',
  lh_lista_espera_ciudad_abierta: 'Sin conectar: la lista de espera no guarda teléfono',
  lh_socio_cuenta_creada: 'Registro del socio (web o bandeja)',
  lh_socio_acceso_enlace: 'Sin conectar: enlace de acceso a pedido',
  lh_socio_falta_documento: 'Socio sin documento de identidad: días 1, 3 y 7',
  lh_socio_documento_recibido: 'El socio sube un documento',
  lh_socio_documento_aprobado: 'El equipo aprueba un documento que no es la identidad',
  lh_socio_documento_rechazado_v2: 'El equipo rechaza un documento',
  lh_socio_perfil_activo: 'Se aprueba el documento de identidad',
  lh_socio_sin_servicios_v2: 'Verificado sin servicios activos a los 3 días',
  lh_socio_sin_servicios_v3: 'Verificado sin servicios activos a los 3 días',
  lh_socio_falta_cuenta_bancaria: 'Primer servicio completado sin cuenta bancaria',
  lh_socio_falta_cuenta_bancaria_v3: 'Primer servicio completado sin cuenta bancaria',
  lh_socio_nueva_solicitud_v2: 'Nueva solicitud de su servicio en su ciudad',
  lh_socio_nueva_solicitud_v3: 'Nueva solicitud de su servicio en su ciudad',
  lh_socio_solicitud_directa: 'Un cliente le dirige su solicitud',
  lh_socio_solicitud_directa_v3: 'Un cliente le dirige su solicitud',
  lh_socio_propuesta_aceptada_v2: 'El cliente acepta su propuesta',
  lh_socio_propuesta_no_elegida: 'El cliente eligió otra propuesta',
  lh_socio_confirmar_reserva: 'Reserva sin confirmar a las 2 h',
  lh_socio_reserva_reprogramada: 'El cliente reprograma la reserva',
  lh_socio_reserva_cancelada: 'El cliente cancela la reserva',
  lh_socio_recordatorio_manana: 'Recordatorio 22-25 h antes del servicio',
  lh_socio_servicio_pronto: 'Recordatorio 30-90 min antes del servicio',
  lh_socio_marcar_terminado: 'Servicio en curso hace 3 h',
  lh_socio_pago_reportado_v2: 'El cliente reporta que pagó',
  lh_socio_pago_por_confirmar_v2: 'Pago reportado sin confirmar (cada 24 h, hasta 5)',
  lh_socio_servicio_completado_v2: 'El socio marca completado',
  lh_socio_calificacion_recibida_v2: 'Un cliente califica al socio',
  lh_socio_reclamo_garantia: 'Un cliente abre un reclamo de garantía',
  lh_socio_correccion_programada: 'Garantía resuelta con «el mismo socio corrige»',
  lh_socio_falta_registrada: 'Garantía con falta registrada',
  lh_socio_perfil_pausado: 'Garantía: el socio llega al tope de faltas',
  lh_socio_pago_plataforma_enviado: 'Sin conectar: no hay transferencias de plataforma registradas',
  lh_socio_hay_demanda: 'Demanda sin atender de un servicio que no ofrece (marketing, 1 por semana)',
  lh_socio_sin_actividad: 'Verificado sin proponer en 30 días (marketing)',
  lh_admin_conversacion_traspasada: 'La IA traspasa una conversación',
  lh_admin_accion_por_aprobar: 'Acción del copiloto esperando aprobación',
  lh_admin_garantia_nueva: 'Nuevo reclamo de garantía',
  lh_admin_garantia_por_vencer: 'Reclamo a 12 h de vencer o vencido',
  lh_admin_disputa_pago: 'El socio rechaza el pago o no coinciden los métodos',
  lh_admin_reserva_sin_confirmar: 'Reserva sin confirmar a las 6 h',
  lh_admin_solicitud_sin_socios: 'Solicitud sin propuestas a las 4 h',
  lh_admin_documentos_por_revisar: 'Documentos pendientes, cada día a las 9:00',
  lh_admin_incidente_critico: 'Se abre un incidente crítico',
  lh_admin_resumen_diario: 'Resumen de ayer, cada día a las 7:00',
}
