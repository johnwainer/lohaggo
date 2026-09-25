import type { Domain } from '@/lib/haggo/config'

/** The compact picture Haggo looks at each cycle. Numbers only: no customer text. */
export type Snapshot = {
  at: string
  sales: { today: number; todayDelta: number | null; month: number; monthDelta: number | null; last7: number; prev7: number }
  bookings: { today: number; pending: number; cancelledToday: number; last7: number; prev7: number }
  requests: { active: number; withoutProposals: number }
  partners: { available: number; verified: number; pendingVerification: number }
  payouts: { pending: number; failed: number; paymentsToConfirm: number }
  payments: { rejected24h: number; pendingOld: number; refundsOpen: number }
  reviews: { low7d: number }
  search: { total24h: number; zero24h: number }
  messaging: { sent24h: number; failed24h: number }
  security: { events24h: number; high24h: number; blockedIps: number }
  inbox: { open: number; unassigned: number; waiting: number; aiHandling: number; inboundToday: number; handoffsToday: number }
  aiAgents: Array<{ id: string; name: string; messagesToday: number; handoffsToday: number; openGaps: number }>
  aiCost: { today: number; month: number }
  aiProviders: { down: Array<{ name: string; reason: string }>; answering: string | null }
  marketing: { inReview: number; failedWeek: number; scheduledToday: number; ideasPending: number; runErrors24h: number; degraded: Array<{ id: string; campaign: string; reason: string }> }
  quality: { rating: number | null; casesOpen: number; casesSla: number }
  channels: { problems: string[] }
  system: { cronsFailing: number; cronsLate: number; errorsLastHour: number; criticalIncidents: number }
  budgets: Array<{ workspace: string; pct: number }>
}

export type Severity = 'info' | 'warning' | 'critical'
export type Detection = {
  /** Stable id of the condition (and of its finding): the same problem keeps the same key */
  key: string
  domain: Domain
  severity: Severity
  title: string
  detail: string
  entityType?: string
  entityId?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const drop = (now: number, before: number) => (before > 0 ? Math.round(((before - now) / before) * 100) : 0)

/** Rules over the snapshot. No AI: this decides whether the cycle is worth a model call. */
export function detect(s: Snapshot): Detection[] {
  const out: Detection[] = []
  const add = (d: Detection) => out.push(d)

  if (s.inbox.waiting) add({ key: 'inbox:waiting', domain: 'inbox', severity: 'critical', title: `${plural(s.inbox.waiting, 'cliente espera', 'clientes esperan')} respuesta hace más de 15 min`, detail: `${s.inbox.unassigned} conversaciones sin asignar, ${s.inbox.aiHandling} con IA.` })
  if (s.requests.withoutProposals) add({ key: 'ops:requests-no-proposals', domain: 'operations', severity: 'warning', title: `${plural(s.requests.withoutProposals, 'solicitud', 'solicitudes')} sin propuestas hace más de 2 h`, detail: `${s.requests.active} solicitudes activas, ${s.partners.available} socios disponibles.` })
  if (s.payouts.failed) add({ key: 'money:payouts-failed', domain: 'money', severity: 'warning', title: `${plural(s.payouts.failed, 'pago a socio falló', 'pagos a socios fallaron')}`, detail: 'Revisar en Pagos a Socios.' })
  if (s.payouts.paymentsToConfirm) add({ key: 'money:payments-to-confirm', domain: 'money', severity: 'info', title: `${plural(s.payouts.paymentsToConfirm, 'pago en efectivo', 'pagos en efectivo')} por confirmar`, detail: 'Reportados por cliente o socio.' })
  if (s.payments.rejected24h >= 3) add({ key: 'money:payments-rejected', domain: 'money', severity: 'warning', title: `${s.payments.rejected24h} pagos rechazados en 24 h`, detail: 'Puede ser un problema con MercadoPago o con los medios de pago.' })
  if (s.payments.pendingOld) add({ key: 'money:payments-pending-old', domain: 'money', severity: 'info', title: `${plural(s.payments.pendingOld, 'pago lleva', 'pagos llevan')} más de 24 h pendiente${s.payments.pendingOld === 1 ? '' : 's'}`, detail: 'Pagos sin aprobar ni rechazar.' })
  if (s.payments.refundsOpen) add({ key: 'money:refunds-open', domain: 'money', severity: 'warning', title: `${plural(s.payments.refundsOpen, 'reembolso abierto', 'reembolsos abiertos')}`, detail: 'Solicitudes de reembolso sin cerrar.' })
  if (s.reviews.low7d >= 2) add({ key: 'quality:low-reviews', domain: 'operations', severity: 'warning', title: `${s.reviews.low7d} calificaciones de 1 o 2 estrellas en 7 días`, detail: `Calificación de 30 días: ${s.quality.rating ?? 'sin datos'}.` })
  if (s.search.zero24h >= 5 && s.search.zero24h / Math.max(1, s.search.total24h) >= 0.2) add({ key: 'demand:zero-results', domain: 'operations', severity: 'info', title: `${s.search.zero24h} de ${s.search.total24h} búsquedas sin resultados en 24 h`, detail: 'Demanda que la plataforma no está atendiendo.' })
  if (s.messaging.failed24h >= 5 && s.messaging.failed24h / Math.max(1, s.messaging.sent24h + s.messaging.failed24h) > 0.2) add({ key: 'sys:deliveries-failing', domain: 'system', severity: 'warning', title: `${s.messaging.failed24h} envíos de mensajes fallaron en 24 h`, detail: `${s.messaging.sent24h} enviados.` })
  if (s.security.high24h) add({ key: 'sys:security-high', domain: 'system', severity: 'warning', title: `${plural(s.security.high24h, 'evento de seguridad grave', 'eventos de seguridad graves')} en 24 h`, detail: `${s.security.events24h} eventos en total, ${s.security.blockedIps} IP bloqueadas.` })
  if (s.partners.pendingVerification >= 3) add({ key: 'users:partners-pending', domain: 'users', severity: 'info', title: `${s.partners.pendingVerification} socios activos sin verificar`, detail: 'No reciben solicitudes hasta verificarse.' })
  if (s.quality.casesSla) add({ key: 'ops:cases-sla', domain: 'operations', severity: 'warning', title: `${plural(s.quality.casesSla, 'caso', 'casos')} de soporte con el plazo vencido`, detail: `${s.quality.casesOpen} casos abiertos.` })

  for (const a of s.aiAgents) {
    const replies = a.messagesToday + a.handoffsToday
    if (replies >= 5 && a.handoffsToday / replies >= 0.4) add({ key: `ai:handoffs:${a.id}`, domain: 'ai_agents', severity: 'warning', title: `${a.name} traspasa muchas conversaciones hoy`, detail: `${a.handoffsToday} traspasos y ${a.messagesToday} respuestas.`, entityType: 'AiAgent', entityId: a.id })
    if (a.openGaps >= 3) add({ key: `ai:gaps:${a.id}`, domain: 'ai_agents', severity: 'info', title: `${a.name} tiene ${a.openGaps} preguntas sin respuesta en su conocimiento`, detail: 'Vacíos de conocimiento abiertos.', entityType: 'AiAgent', entityId: a.id })
  }
  if (s.aiProviders.down.length) {
    add({
      key: `ai:providers-down:${s.aiProviders.down.map((d) => d.name).sort().join(',')}`,
      domain: 'system',
      severity: s.aiProviders.answering ? 'warning' : 'critical',
      title: s.aiProviders.answering ? `${s.aiProviders.down.map((d) => `${d.name} ${d.reason}`).join(', ')}: responde ${s.aiProviders.answering}` : 'Ningún proveedor de IA disponible: los agentes traspasan a personas',
      detail: s.aiProviders.down.map((d) => `${d.name}: ${d.reason}`).join(' · '),
    })
  }

  if (s.marketing.failedWeek) add({ key: 'mk:failed', domain: 'marketing', severity: 'warning', title: `${plural(s.marketing.failedWeek, 'publicación falló', 'publicaciones fallaron')} en 7 días`, detail: 'Revisar errores de publicación.' })
  for (const d of s.marketing.degraded) add({ key: `mk:degraded:${d.id}`, domain: 'marketing', severity: 'warning', title: `El agente de marketing de «${d.campaign}» está en copiloto forzado`, detail: d.reason, entityType: 'MarketingAgent', entityId: d.id })
  if (s.marketing.runErrors24h >= 3) add({ key: 'mk:agent-errors', domain: 'marketing', severity: 'warning', title: `El agente de marketing falló ${s.marketing.runErrors24h} veces en 24 h`, detail: 'Revisar sus ejecuciones.' })
  if (s.marketing.inReview >= 5) add({ key: 'mk:review-backlog', domain: 'marketing', severity: 'info', title: `${s.marketing.inReview} publicaciones esperan revisión`, detail: 'Se acumulan borradores sin aprobar.' })

  if (s.channels.problems.length) add({ key: `sys:channels:${[...s.channels.problems].sort().join(',')}`, domain: 'system', severity: 'critical', title: `Canales con problemas: ${s.channels.problems.join(', ')}`, detail: 'Hay que reconectarlos.' })
  if (s.system.cronsFailing) add({ key: 'sys:crons-failing', domain: 'system', severity: 'critical', title: `${plural(s.system.cronsFailing, 'tarea automática falla', 'tareas automáticas fallan')}`, detail: `${s.system.cronsLate} atrasadas.` })
  else if (s.system.cronsLate) add({ key: 'sys:crons-late', domain: 'system', severity: 'warning', title: `${plural(s.system.cronsLate, 'tarea automática atrasada', 'tareas automáticas atrasadas')}`, detail: 'Revisar Salud del sistema.' })
  if (s.system.errorsLastHour >= 5) add({ key: 'sys:error-spike', domain: 'system', severity: 'warning', title: `${s.system.errorsLastHour} errores nuevos en la última hora`, detail: 'Pico de errores de la aplicación.' })
  if (s.system.criticalIncidents) add({ key: 'sys:critical-incidents', domain: 'system', severity: 'critical', title: `${plural(s.system.criticalIncidents, 'incidente crítico abierto', 'incidentes críticos abiertos')}`, detail: 'Ver Casos e incidentes.' })

  const bookingsDrop = drop(s.bookings.last7, s.bookings.prev7)
  if (s.bookings.prev7 >= 5 && bookingsDrop >= 30) add({ key: 'biz:bookings-drop', domain: 'operations', severity: 'warning', title: `Reservas de los últimos 7 días bajaron ${bookingsDrop} %`, detail: `${s.bookings.last7} frente a ${s.bookings.prev7} la semana anterior.` })
  const salesDrop = drop(s.sales.last7, s.sales.prev7)
  if (s.sales.prev7 > 0 && salesDrop >= 30) add({ key: 'biz:sales-drop', domain: 'operations', severity: 'warning', title: `Ventas de los últimos 7 días bajaron ${salesDrop} %`, detail: `${Math.round(s.sales.last7)} frente a ${Math.round(s.sales.prev7)} la semana anterior.` })
  if (s.requests.active >= 3 && s.partners.available === 0) add({ key: 'ops:no-partners', domain: 'operations', severity: 'critical', title: 'No hay socios disponibles y hay solicitudes activas', detail: `${s.requests.active} solicitudes activas.` })

  for (const b of s.budgets) if (b.pct >= 80) add({ key: `ai:budget:${b.workspace}`, domain: 'ai_agents', severity: b.pct >= 100 ? 'critical' : 'warning', title: `${b.workspace}: ${b.pct} % del tope mensual de IA`, detail: b.pct >= 100 ? 'Los agentes traspasan a personas hasta el próximo mes o hasta subir el tope.' : 'Cerca del tope mensual.' })
  return out
}

/** Worth a model call: a detection that is new since the last cycle, or got worse. */
export function novelDetections(current: Detection[], previous: Array<Pick<Detection, 'key' | 'severity'>>) {
  const rank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }
  const prev = new Map(previous.map((d) => [d.key, d.severity]))
  return current.filter((d) => !prev.has(d.key) || rank[d.severity] > rank[prev.get(d.key)!])
}
