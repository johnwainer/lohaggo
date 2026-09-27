import type { Domain } from '@/lib/haggo/config'
import { CLAIMS, isClaimKey } from '@/lib/public/claims'

/** The compact picture Haggo looks at each cycle. Numbers only: no customer text. */
export type Snapshot = {
  at: string
  sales: { today: number; todayDelta: number | null; month: number; monthDelta: number | null; last7: number; prev7: number }
  bookings: { today: number; pending: number; cancelledToday: number; last7: number; prev7: number; rescheduledToday?: number }
  requests: { active: number; withoutProposals: number }
  partners: { available: number; verified: number; pendingVerification: number }
  payouts: { pending: number; failed: number; paymentsToConfirm: number; oldestPendingDays?: number }
  payments: { rejected24h: number; pendingOld: number; refundsOpen: number }
  reviews: { low7d: number }
  search: { total24h: number; zero24h: number }
  messaging: { sent24h: number; failed24h: number }
  security: { events24h: number; high24h: number; blockedIps: number }
  inbox: { open: number; unassigned: number; waiting: number; aiHandling: number; inboundToday: number; handoffsToday: number }
  aiAgents: Array<{ id: string; name: string; messagesToday: number; handoffsToday: number; openGaps: number; actionsToday?: { executed: number; failed: number; awaiting: number } }>
  /** What the inbox agents did on the platform today (AiAgentAction) and the day's cancellations by origin (BookingEvent) */
  aiActions: { actionsToday: { executed: number; failed: number; awaiting: number }; chatCancellationsToday: number; cancellationsToday: number; awaitingApproval?: number; oldestAwaitingMinutes?: number }
  aiCost: { today: number; month: number }
  aiProviders: { down: Array<{ name: string; reason: string }>; answering: string | null }
  marketing: { inReview: number; failedWeek: number; scheduledToday: number; ideasPending: number; runErrors24h: number; degraded: Array<{ id: string; campaign: string; reason: string }>; editorial?: { held: number; reviewedWeek: number; notApprovedWeek: number; failedWeek: number } }
  quality: { rating: number | null; casesOpen: number; casesSla: number }
  channels: { problems: string[] }
  system: { cronsFailing: number; cronsLate: number; errorsLastHour: number; criticalIncidents: number }
  budgets: Array<{ workspace: string; pct: number }>
  /** Partner verification documents waiting for review */
  docs?: { pending: number; oldestHours: number }
  catalog?: { servicesWithoutPartners: number; partnersVerifiedNoServices: number }
  /** Today's requests and bookings by where they were created */
  origin?: { requestsTodayChat: number; requestsTodayApp: number; bookingsTodayChat: number; bookingsTodayApp: number }
  /** Public claims that are on without backing (lib/public/claims.ts) */
  trust?: { unbacked: string[] }
  config?: { commissionEnabled: boolean; activeCities: number }
  /** Guarantee claims (lib/guarantee): active, past their 72 h SLA, strikes in 90 days and partners at the pause limit */
  guarantee?: { open: number; overdue: number; strikesLast90: number; partnersAtLimit?: Array<{ partnerId: string; strikes: number }> }
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
  if (s.docs && s.docs.pending && s.docs.oldestHours > 48) add({ key: 'ops:docs-pending', domain: 'users', severity: 'warning', title: `${plural(s.docs.pending, 'documento de socio espera', 'documentos de socios esperan')} revisión (el más antiguo hace ${Math.round(s.docs.oldestHours / 24)} días)`, detail: 'Sin revisar, esos socios no se verifican ni reciben solicitudes. Ver verificacion_documentos.' })
  if (s.payouts.oldestPendingDays != null && s.payouts.oldestPendingDays > 7) add({ key: 'money:payouts-old', domain: 'money', severity: 'warning', title: `Hay un pago a socio pendiente hace ${s.payouts.oldestPendingDays} días`, detail: `${s.payouts.pending} pagos a socios pendientes. Revisar en dinero.` })
  if (s.catalog && s.catalog.partnersVerifiedNoServices >= 3) add({ key: 'catalog:partners-no-services', domain: 'users', severity: 'info', title: `${s.catalog.partnersVerifiedNoServices} socios verificados sin servicios activos`, detail: `No reciben solicitudes. ${s.catalog.servicesWithoutPartners} servicios del catálogo no tienen socios. Ver verificacion_documentos.` })
  for (const key of s.trust?.unbacked ?? []) add({ key: `trust:unbacked:${key}`, domain: 'config', severity: 'critical', title: `El sitio afirma «${isClaimKey(key) ? CLAIMS[key].name : key}» sin respaldo`, detail: 'Una afirmación pública encendida sin lo que la hace verdad es publicidad engañosa: apágala (trust.set_claim) o cumple lo que requiere. Ver configuracion_plataforma.' })
  const g = s.guarantee
  if (g && g.overdue >= 1) add({ key: 'ops:guarantee-overdue', domain: 'operations', severity: 'critical', title: `${plural(g.overdue, 'reclamo de garantía vencido', 'reclamos de garantía vencidos')} (más de 72 h sin resolver)`, detail: `${g.open} reclamos activos. La garantía publicada promete resolver en 72 h; con reclamos vencidos la afirmación queda sin respaldo. Ver garantia y recomendar el remedio (lo aplica una persona).` })
  for (const p of g?.partnersAtLimit ?? []) add({ key: `ops:partner-strikes:${p.partnerId}`, domain: 'users', severity: 'warning', title: `Un socio acumula ${p.strikes} faltas de garantía en 90 días`, detail: p.strikes >= 3 ? 'Con 3 faltas el equipo decide si suspende la cuenta (no es automático). Ver garantia.' : 'Con 2 faltas su disponibilidad se pausa sola y se abre revisión. Ver garantia.', entityType: 'PartnerProfile', entityId: p.partnerId })
  if (s.quality.casesSla) add({ key: 'ops:cases-sla', domain: 'operations', severity: 'warning', title: `${plural(s.quality.casesSla, 'caso', 'casos')} de soporte con el plazo vencido`, detail: `${s.quality.casesOpen} casos abiertos.` })

  for (const a of s.aiAgents) {
    const replies = a.messagesToday + a.handoffsToday
    if (replies >= 5 && a.handoffsToday / replies >= 0.4) add({ key: `ai:handoffs:${a.id}`, domain: 'ai_agents', severity: 'warning', title: `${a.name} traspasa muchas conversaciones hoy`, detail: `${a.handoffsToday} traspasos y ${a.messagesToday} respuestas.`, entityType: 'AiAgent', entityId: a.id })
    if (a.openGaps >= 3) add({ key: `ai:gaps:${a.id}`, domain: 'ai_agents', severity: 'info', title: `${a.name} tiene ${a.openGaps} preguntas sin respuesta en su conocimiento`, detail: 'Vacíos de conocimiento abiertos.', entityType: 'AiAgent', entityId: a.id })
  }
  const act = s.aiActions
  if (act && act.actionsToday.failed >= 3) add({ key: 'ai:actions-failed', domain: 'ai_agents', severity: 'warning', title: `${act.actionsToday.failed} acciones de los agentes fallaron hoy`, detail: `Los agentes de la bandeja intentaron actuar en cuentas de clientes o socios y ${act.actionsToday.failed === 1 ? 'una falló' : `${act.actionsToday.failed} fallaron`} (${act.actionsToday.executed} ejecutadas, ${act.actionsToday.awaiting} esperando aprobación). Mira acciones_por_chat para ver qué herramienta falla y por qué.` })
  if (act && act.awaitingApproval && (act.oldestAwaitingMinutes ?? 0) > 30) add({ key: 'ai:actions-awaiting', domain: 'inbox', severity: 'warning', title: `${plural(act.awaitingApproval, 'acción de un agente espera', 'acciones de agentes esperan')} aprobación hace ${act.oldestAwaitingMinutes} min`, detail: 'En copiloto el cliente o socio queda esperando hasta que alguien del equipo apruebe en la bandeja. Ver acciones_por_chat.' })
  if (act && act.chatCancellationsToday >= 3 && act.chatCancellationsToday / Math.max(1, act.cancellationsToday) > 0.3) add({ key: 'ai:chat-cancellations', domain: 'ai_agents', severity: 'warning', title: `${act.chatCancellationsToday} de ${act.cancellationsToday} cancelaciones de hoy salieron del chat`, detail: `Más del 30 % de las cancelaciones del día las hicieron los agentes desde la conversación. Revisar en acciones_por_chat si los clientes lo pidieron o si el agente cancela de más.` })
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
  const ed = s.marketing.editorial
  if (ed && ed.held >= 3) add({ key: 'mk:editorial-held', domain: 'marketing', severity: 'warning', title: `El editor retiene ${ed.held} publicaciones`, detail: 'Piezas con cambios pedidos, rechazadas o sin poder revisarse: revisar qué pide el editor o si el agente necesita otras instrucciones.' })
  if (ed && ed.reviewedWeek >= 5 && ed.notApprovedWeek / ed.reviewedWeek >= 0.6) add({ key: 'mk:editorial-low', domain: 'marketing', severity: 'info', title: `El editor no aprobó ${Math.round((ed.notApprovedWeek / ed.reviewedWeek) * 100)} % de sus revisiones en 7 días`, detail: 'Puntajes bajos repetidos: la voz, la estrategia del agente o la exigencia del editor no encajan.' })
  if (ed && ed.failedWeek >= 3) add({ key: 'mk:editorial-failed', domain: 'marketing', severity: 'warning', title: `${plural(ed.failedWeek, 'revisión editorial falló', 'revisiones editoriales fallaron')} en 7 días`, detail: 'Sin revisión las piezas no salen: revisar presupuesto e IA.' })
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
