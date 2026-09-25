import { prisma } from '@/lib/prisma'
import { notifyNewServiceRequest } from '@/lib/notifications/notificationService'
import { MAX_REMINDERS, REMINDER_INTERVAL_HOURS, openIncident, remindCashPayment, setFeatureFlag, setIncidentStatus, setPartnerAvailability } from '@/lib/ops/platform-ops'
import { resetProvider, getProviderStates, reasonLabel } from '@/lib/ai/providers/state'
import { getAiSettings, saveAiSettings } from '@/lib/ai/settings'
import { PROVIDERS, PROVIDER_LABEL, type ProviderId } from '@/lib/ai/providers/types'
import { done, parseBool, parseId, parseText, requireObj, type HaggoActionDef } from '@/lib/haggo/actions/types'

/** Partners are reminded about one request at most this many times by Haggo. */
export const MAX_REQUEST_REMINDERS = 2

const notifyPartners: HaggoActionDef<{ serviceRequestId: string }> = {
  id: 'operations.notify_partners',
  domain: 'operations',
  risk: 'medium',
  label: 'Avisar a socios de una solicitud sin propuestas',
  hint: `Vuelve a avisar a los socios disponibles del servicio y la ciudad de una solicitud que sigue sin propuestas. No le escribe al cliente. Máximo ${MAX_REQUEST_REMINDERS} veces por solicitud.`,
  schema: { type: 'object', properties: { serviceRequestId: { type: 'string' } }, required: ['serviceRequestId'] },
  sideEffects: ['notifies_partners'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { serviceRequestId: parseId(r, 'serviceRequestId', e) }) },
  describe: () => 'Avisar otra vez a los socios disponibles',
  entity: (p) => ({ type: 'ServiceRequest', id: p.serviceRequestId }),
  preconditions: async (p) => {
    const r = await prisma.serviceRequest.findUnique({ where: { id: p.serviceRequestId }, select: { status: true, city: true, serviceId: true, service: { select: { name: true } }, _count: { select: { proposals: true } } } })
    if (!r) return { ok: false, reason: 'La solicitud no existe' }
    if (r.status !== 'ACTIVE') return { ok: false, reason: 'La solicitud ya no está activa' }
    if (r._count.proposals) return { ok: false, reason: 'La solicitud ya tiene propuestas' }
    const sent = await prisma.haggoAction.count({ where: { tool: 'operations.notify_partners', entityId: p.serviceRequestId, status: { in: ['executed', 'executing'] } } })
    if (sent >= MAX_REQUEST_REMINDERS) return { ok: false, reason: `Ya se avisó ${sent} veces a los socios por esta solicitud` }
    const partners = await prisma.partnerService.count({ where: { serviceId: r.serviceId, active: true, partner: { isActive: true, verified: true, isAvailable: true, city: r.city } } })
    if (!partners) return { ok: false, reason: 'No hay socios disponibles para ese servicio en esa ciudad: avisar no sirve' }
    return { ok: true, before: { service: r.service.name, city: r.city, partners, sent } }
  },
  preview: async (_p, before) => {
    const b = before as { service: string; city: string; partners: number; sent: number }
    return { summary: `${b.partners} socios de ${b.service} en ${b.city} reciben el aviso (notificación y WhatsApp)`, diff: [{ field: 'Avisos de Haggo por esta solicitud', from: b.sent, to: b.sent + 1 }] }
  },
  execute: async (p, ctx) => {
    // Counted again right before sending: two cards approved in a row cannot exceed the cap
    const sent = await prisma.haggoAction.count({ where: { tool: 'operations.notify_partners', entityId: p.serviceRequestId, status: { in: ['executed', 'executing'] }, id: { not: ctx.actionId } } })
    if (sent >= MAX_REQUEST_REMINDERS) throw new Error(`Ya se avisó ${sent} veces a los socios por esta solicitud`)
    const n = await notifyNewServiceRequest(p.serviceRequestId, { partnersOnly: true })
    return { after: { notified: n }, result: `${n} socios avisados` }
  },
}

const openInc: HaggoActionDef<{ title: string; description: string; severity: string }> = {
  id: 'operations.open_incident',
  domain: 'operations',
  risk: 'low',
  label: 'Abrir un incidente',
  hint: 'Registra en Casos e incidentes un problema que alguien del equipo debe atender.',
  schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } }, required: ['title', 'description', 'severity'] },
  sideEffects: [],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const severity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(r.severity)) ? String(r.severity) : (e.push('severity: LOW, MEDIUM, HIGH o CRITICAL'), '')
    return done(e, { title: parseText(r, 'title', e, { min: 5, max: 200 }) as string, description: parseText(r, 'description', e, { min: 10, max: 2000 }) as string, severity })
  },
  describe: (p) => `Abrir el incidente «${p.title}»`,
  entity: () => null,
  preconditions: async (p) => {
    const dup = await prisma.adminIncident.findFirst({ where: { title: p.title, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
    if (dup) return { ok: false, reason: 'Ya hay un incidente abierto con ese título' }
    return { ok: true, before: null }
  },
  preview: async (p) => ({ summary: `Incidente ${p.severity}: ${p.title}`, diff: [] }),
  execute: async (p) => {
    const inc = await openIncident({ type: 'haggo', title: p.title, description: p.description, severity: p.severity, source: 'haggo', route: '/admin/haggo' })
    return { after: { incidentId: inc.id }, result: 'Incidente abierto' }
  },
  unchanged: async (_p, after) => (await prisma.adminIncident.findUnique({ where: { id: (after as { incidentId: string }).incidentId }, select: { status: true } }))?.status !== 'RESOLVED',
  undo: async (_p, _b, after) => { await setIncidentStatus((after as { incidentId: string }).incidentId, 'RESOLVED', 'Haggo (deshecho)') },
}

const resolveInc: HaggoActionDef<{ incidentId: string }> = {
  id: 'operations.resolve_incident',
  domain: 'operations',
  risk: 'low',
  label: 'Cerrar un incidente',
  hint: 'Marca como resuelto un incidente cuya causa ya no existe (con evidencia de que se resolvió).',
  schema: { type: 'object', properties: { incidentId: { type: 'string' } }, required: ['incidentId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { incidentId: parseId(r, 'incidentId', e) }) },
  describe: () => 'Cerrar el incidente',
  entity: (p) => ({ type: 'AdminIncident', id: p.incidentId }),
  preconditions: async (p) => {
    const i = await prisma.adminIncident.findUnique({ where: { id: p.incidentId }, select: { status: true, title: true } })
    if (!i) return { ok: false, reason: 'El incidente no existe' }
    if (i.status === 'RESOLVED') return { ok: false, reason: 'Ya está resuelto' }
    return { ok: true, before: { status: i.status, title: i.title } }
  },
  preview: async (_p, before) => ({ summary: `«${(before as { title: string }).title}» se marca resuelto`, diff: [{ field: 'Estado', from: (before as { status: string }).status, to: 'RESOLVED' }] }),
  execute: async (p, ctx) => { await setIncidentStatus(p.incidentId, 'RESOLVED', `Haggo (aprobado por ${ctx.approverEmail ?? 'superadmin'})`); return { after: { status: 'RESOLVED' }, result: 'Resuelto' } },
  unchanged: async (p) => (await prisma.adminIncident.findUnique({ where: { id: p.incidentId }, select: { status: true } }))?.status === 'RESOLVED',
  undo: async (p, before) => { await setIncidentStatus(p.incidentId, (before as { status: string }).status, 'Haggo (deshecho)') },
}

const parseProvider = (r: Record<string, unknown>, key: string, e: string[]) => (PROVIDERS.includes(r[key] as ProviderId) ? (r[key] as ProviderId) : (e.push(`${key}: anthropic u openai`), 'anthropic' as ProviderId))

const resetAi: HaggoActionDef<{ provider: ProviderId }> = {
  id: 'system.reset_ai_provider',
  domain: 'system',
  risk: 'low',
  label: 'Volver a probar un proveedor de IA',
  hint: 'Quita la marca de caído a un proveedor (por ejemplo, tras recargar crédito) para que la siguiente llamada lo pruebe.',
  schema: { type: 'object', properties: { provider: { type: 'string', enum: [...PROVIDERS] } }, required: ['provider'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { provider: parseProvider(r, 'provider', e) }) },
  describe: (p) => `Volver a probar ${PROVIDER_LABEL[p.provider]}`,
  entity: (p) => ({ type: 'AiProviderState', id: p.provider }),
  preconditions: async (p) => {
    const s = (await getProviderStates(true))[p.provider]
    if (s.status === 'ok') return { ok: false, reason: 'El proveedor ya está funcionando' }
    return { ok: true, before: { status: s.status, reason: reasonLabel(s.reason) } }
  },
  preview: async (p, before) => ({ summary: `${PROVIDER_LABEL[p.provider]} se prueba en la siguiente llamada`, diff: [{ field: 'Estado', from: `${(before as { status: string }).status} (${(before as { reason: string | null }).reason ?? '—'})`, to: 'ok' }] }),
  execute: async (p) => { await resetProvider(p.provider); return { after: { status: 'ok' }, result: 'Se probará en la siguiente llamada' } },
}

const providerOrder: HaggoActionDef<{ first: ProviderId }> = {
  id: 'system.set_provider_order',
  domain: 'system',
  risk: 'medium',
  label: 'Cambiar el proveedor de IA principal',
  hint: 'Elige qué proveedor de IA de texto se usa primero (el otro queda de respaldo).',
  schema: { type: 'object', properties: { first: { type: 'string', enum: [...PROVIDERS] } }, required: ['first'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { first: parseProvider(r, 'first', e) }) },
  describe: (p) => `Usar ${PROVIDER_LABEL[p.first]} como proveedor principal`,
  entity: () => ({ type: 'AiSettings', id: 'platform' }),
  preconditions: async (p) => {
    const s = await getAiSettings(true)
    if (s.providerOrder[0] === p.first) return { ok: false, reason: 'Ya es el principal' }
    if (!(p.first === 'openai' ? s.openaiKey : s.anthropicKey)) return { ok: false, reason: 'Ese proveedor no tiene clave' }
    return { ok: true, before: { order: s.providerOrder } }
  },
  preview: async (p, before) => ({ summary: `${PROVIDER_LABEL[p.first]} pasa a ser el principal`, diff: [{ field: 'Orden', from: (before as { order: string[] }).order.join(' → '), to: [p.first, ...PROVIDERS.filter((x) => x !== p.first)].join(' → ') }] }),
  execute: async (p, ctx) => {
    const order = [p.first, ...PROVIDERS.filter((x) => x !== p.first)]
    await saveAiSettings({ providerOrder: order, updatedByEmail: `Haggo (aprobado por ${ctx.approverEmail ?? 'superadmin'})` })
    return { after: { order }, result: 'Orden cambiado' }
  },
  unchanged: async (p) => (await getAiSettings(true)).providerOrder[0] === p.first,
  undo: async (_p, before) => { await saveAiSettings({ providerOrder: (before as { order: ProviderId[] }).order, updatedByEmail: 'Haggo (deshecho)' }) },
}

const toggleFeature: HaggoActionDef<{ key: string; enabled: boolean }> = {
  id: 'config.toggle_feature',
  domain: 'config',
  risk: 'high',
  label: 'Encender o apagar una función o botón',
  hint: 'Cambia un interruptor de «Funciones y botones». Lo ven clientes y socios.',
  schema: { type: 'object', properties: { key: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['key', 'enabled'] },
  sideEffects: ['customer_facing'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const key = typeof r.key === 'string' && /^[a-z0-9_.-]{2,60}$/i.test(r.key) ? r.key : (e.push('key: clave de la función'), '')
    return done(e, { key, enabled: parseBool(r, 'enabled', e) })
  },
  describe: (p) => `${p.enabled ? 'Encender' : 'Apagar'} la función ${p.key}`,
  entity: (p) => ({ type: 'FeatureFlag', id: p.key }),
  preconditions: async (p) => {
    const f = await prisma.featureFlag.findUnique({ where: { key: p.key }, select: { enabled: true, name: true } })
    if (!f) return { ok: false, reason: 'Esa función no existe' }
    if (f.enabled === p.enabled) return { ok: false, reason: p.enabled ? 'Ya está encendida' : 'Ya está apagada' }
    return { ok: true, before: { enabled: f.enabled, name: f.name } }
  },
  preview: async (p, before) => ({ summary: `«${(before as { name: string }).name}» ${p.enabled ? 'se enciende' : 'se apaga'} para todos`, diff: [{ field: 'Estado', from: (before as { enabled: boolean }).enabled ? 'encendida' : 'apagada', to: p.enabled ? 'encendida' : 'apagada' }] }),
  execute: async (p) => { await setFeatureFlag(p.key, p.enabled); return { after: { enabled: p.enabled }, result: p.enabled ? 'Encendida' : 'Apagada' } },
  unchanged: async (p) => (await prisma.featureFlag.findUnique({ where: { key: p.key }, select: { enabled: true } }))?.enabled === p.enabled,
  undo: async (p) => { await setFeatureFlag(p.key, !p.enabled) },
}

const partnerAvailability: HaggoActionDef<{ partnerId: string; isAvailable: boolean }> = {
  id: 'users.set_partner_availability',
  domain: 'users',
  risk: 'high',
  label: 'Cambiar la disponibilidad de un socio',
  hint: 'Un socio no disponible deja de recibir solicitudes nuevas (por ejemplo, si acumula reseñas malas o no responde).',
  schema: { type: 'object', properties: { partnerId: { type: 'string' }, isAvailable: { type: 'boolean' } }, required: ['partnerId', 'isAvailable'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { partnerId: parseId(r, 'partnerId', e), isAvailable: parseBool(r, 'isAvailable', e) }) },
  describe: (p) => (p.isAvailable ? 'Marcar al socio como disponible' : 'Marcar al socio como no disponible'),
  entity: (p) => ({ type: 'PartnerProfile', id: p.partnerId }),
  preconditions: async (p) => {
    const s = await prisma.partnerProfile.findUnique({ where: { id: p.partnerId }, select: { isAvailable: true, user: { select: { name: true } } } })
    if (!s) return { ok: false, reason: 'El socio no existe' }
    if (s.isAvailable === p.isAvailable) return { ok: false, reason: 'Ya está así' }
    return { ok: true, before: { isAvailable: s.isAvailable, name: s.user.name } }
  },
  preview: async (p, before) => ({ summary: `${(before as { name: string }).name} ${p.isAvailable ? 'vuelve a recibir' : 'deja de recibir'} solicitudes nuevas`, diff: [{ field: 'Disponible', from: (before as { isAvailable: boolean }).isAvailable ? 'sí' : 'no', to: p.isAvailable ? 'sí' : 'no' }] }),
  execute: async (p) => { await setPartnerAvailability(p.partnerId, p.isAvailable); return { after: { isAvailable: p.isAvailable }, result: 'Actualizado' } },
  unchanged: async (p) => (await prisma.partnerProfile.findUnique({ where: { id: p.partnerId }, select: { isAvailable: true } }))?.isAvailable === p.isAvailable,
  undo: async (p) => { await setPartnerAvailability(p.partnerId, !p.isAvailable) },
}

const remindCash: HaggoActionDef<{ paymentId: string }> = {
  id: 'money.remind_cash_payment',
  domain: 'money',
  risk: 'medium',
  label: 'Recordar a un socio que confirme un pago',
  hint: 'Le recuerda al socio confirmar un pago en efectivo o transferencia que el cliente reportó (24 h entre recordatorios, máximo 5).',
  schema: { type: 'object', properties: { paymentId: { type: 'string' } }, required: ['paymentId'] },
  sideEffects: ['notifies_partners'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { paymentId: parseId(r, 'paymentId', e) }) },
  describe: () => 'Recordarle al socio que confirme el pago',
  entity: (p) => ({ type: 'Payment', id: p.paymentId }),
  preconditions: async (p) => {
    const pay = await prisma.payment.findUnique({ where: { id: p.paymentId }, select: { confirmationStatus: true, reminderCount: true, totalAmount: true, lastReminderAt: true, clientReportedAt: true } })
    if (!pay) return { ok: false, reason: 'El pago no existe' }
    if (pay.confirmationStatus !== 'CLIENT_REPORTED') return { ok: false, reason: 'Ese pago no espera confirmación del socio' }
    if (pay.reminderCount >= MAX_REMINDERS) return { ok: false, reason: `Ya se enviaron ${MAX_REMINDERS} recordatorios` }
    const last = pay.lastReminderAt ?? pay.clientReportedAt
    if (last && Date.now() - last.getTime() < REMINDER_INTERVAL_HOURS * 3600_000) return { ok: false, reason: 'Ya se le recordó en las últimas 24 horas' }
    return { ok: true, before: { reminderCount: pay.reminderCount, amount: pay.totalAmount } }
  },
  preview: async (_p, before) => ({ summary: `Recordatorio al socio por un pago de $${Math.round((before as { amount: number }).amount).toLocaleString('es-CO')}`, diff: [{ field: 'Recordatorios', from: (before as { reminderCount: number }).reminderCount, to: (before as { reminderCount: number }).reminderCount + 1 }] }),
  execute: async (p) => { await remindCashPayment(p.paymentId); return { after: null, result: 'Recordatorio enviado' } },
}

export const PLATFORM_ACTIONS = [notifyPartners, openInc, resolveInc, resetAi, providerOrder, toggleFeature, partnerAvailability, remindCash] as unknown as HaggoActionDef[]
