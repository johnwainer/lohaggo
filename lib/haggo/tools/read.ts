import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { business, cleanFilters, funnelTab, peopleTab, searchTab, serviceTab, supplyTab } from '@/lib/analytics/queries'
import { parsePeriod } from '@/lib/analytics/core'
import { systemOverview } from '@/lib/system/health'
import { periodOf } from '@/lib/ai/pricing'
import { untrusted } from '@/lib/haggo/prompt'

type ReadTool = { def: Anthropic.Tool; run: (input: Record<string, unknown>) => Promise<unknown> }

const H = 3600_000
const MAX_OUTPUT = 8000
const limit = (v: unknown, def: number, max: number) => (Number.isInteger(v) && (v as number) > 0 ? Math.min(v as number, max) : def)
const period = (v: unknown) => (['7d', '30d', '90d'].includes(String(v)) ? String(v) : '30d')
const mins = (d: Date | null | undefined) => (d ? Math.round((Date.now() - d.getTime()) / 60_000) : null)

/**
 * What Haggo can look at while investigating. Read-only, numbers first. Text written by customers,
 * partners or the public goes through `untrusted()` so it reads as data, never as an instruction.
 */
export const READ_TOOLS: Record<string, ReadTool> = {
  tendencias_negocio: {
    def: { name: 'tendencias_negocio', description: 'Ventas, reservas y embudo del periodo frente al anterior, por servicio, categoría y ciudad.', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['7d', '30d', '90d'] } } } },
    run: async (i) => {
      const p = parsePeriod({ preset: period(i.periodo) })
      const [b, f] = await Promise.all([business(p, cleanFilters()), funnelTab(p, cleanFilters())])
      return { periodo: p.label, negocio: b, embudo: f }
    },
  },
  salud_sistema: {
    def: { name: 'salud_sistema', description: 'Tareas automáticas con problemas, servicios externos que fallan, errores abiertos de la aplicación y webhooks.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const s = await systemOverview()
      return {
        estado: s.status,
        tareas_con_problemas: s.crons.filter((c) => c.health !== 'ok' && c.health !== 'never').map((c) => ({ tarea: c.label, estado: c.health, ultimo_error: c.lastError?.slice(0, 200) ?? null, fallos_24h: c.failures24h })),
        servicios_con_problemas: s.services.filter((x) => x.level === 'error' || x.level === 'warning').map((x) => ({ servicio: x.name, nivel: x.level, detalle: x.detail })),
        errores_abiertos: s.errors.slice(0, 10).map((e) => ({ mensaje: e.message.slice(0, 160), ruta: e.route, veces: e.count, ultima: e.lastSeenAt })),
        errores_24h: s.errors24h,
        webhooks: s.webhooks.byChannel,
      }
    },
  },
  conversaciones_en_espera: {
    def: { name: 'conversaciones_en_espera', description: 'Conversaciones abiertas con mensajes sin leer, de la más antigua a la más nueva: canal, minutos esperando, si tiene persona o IA asignada.', input_schema: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 20 } } } },
    run: async (i) => {
      const rows = await prisma.conversation.findMany({
        where: { isTest: false, aiSpam: false, status: { in: ['OPEN', 'IN_PROGRESS'] }, unreadCount: { gt: 0 } },
        orderBy: { lastMessageAt: 'asc' }, take: limit(i.limite, 10, 20),
        select: { id: true, channel: true, lastMessageAt: true, unreadCount: true, assignedToId: true, aiHandled: true, aiAgentId: true, aiHandoffAt: true, messages: { where: { direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } } },
      })
      return rows.map((c) => ({ id: c.id, canal: c.channel, minutos_esperando: mins(c.lastMessageAt), sin_leer: c.unreadCount, persona_asignada: Boolean(c.assignedToId), con_ia: c.aiHandled, traspasada: Boolean(c.aiHandoffAt), ultimo_mensaje: untrusted(c.messages[0]?.body?.slice(0, 160) ?? '') }))
    },
  },
  agente_ia: {
    def: { name: 'agente_ia', description: 'Un agente de IA de la bandeja en los últimos 7 días: respuestas, traspasos, costo y preguntas que no supo responder.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    run: async (i) => {
      const id = String(i.id ?? '')
      const since = new Date(Date.now() - 7 * 24 * H)
      const [agent, replies, handoffs, cost, gaps] = await Promise.all([
        prisma.aiAgent.findUnique({ where: { id }, select: { id: true, name: true, status: true, autopilot: true, model: true, conversations: true, handoffs: true } }),
        prisma.conversationMessage.count({ where: { aiAgentId: id, direction: 'OUTBOUND', sentAt: { gte: since } } }),
        prisma.conversation.count({ where: { aiAgentId: id, aiHandoffAt: { gte: since }, isTest: false } }),
        prisma.aiCall.aggregate({ where: { agentId: id, createdAt: { gte: since } }, _sum: { costUsd: true }, _count: { _all: true } }),
        prisma.aiKnowledgeGap.findMany({ where: { agentId: id, status: 'open' }, orderBy: { createdAt: 'desc' }, take: 10, select: { question: true, createdAt: true } }),
      ])
      if (!agent) return { error: 'Agente no encontrado' }
      return { agente: agent, ultimos_7_dias: { respuestas: replies, traspasos: handoffs, llamadas_ia: cost._count._all, costo_usd: Math.round((cost._sum.costUsd ?? 0) * 100) / 100 }, preguntas_sin_respuesta: gaps.map((g) => untrusted(g.question.slice(0, 200))) }
    },
  },
  marketing: {
    def: { name: 'marketing', description: 'Publicaciones esperando revisión, publicaciones fallidas de 7 días con su error y estado de los agentes de marketing (modo, degradación, gasto).', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const since = new Date(Date.now() - 7 * 24 * H)
      const [review, failed, agents] = await Promise.all([
        prisma.marketingPost.findMany({ where: { status: 'review' }, orderBy: { updatedAt: 'asc' }, take: 10, select: { id: true, title: true, origin: true, updatedAt: true } }),
        prisma.marketingPublication.findMany({ where: { status: 'failed', updatedAt: { gte: since } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, channel: true, lastError: true, post: { select: { id: true, title: true } } } }),
        prisma.marketingAgent.findMany({ where: { status: { not: 'archived' } }, select: { id: true, status: true, mode: true, degradedReason: true, monthlyBudgetUsd: true, campaign: { select: { name: true, objective: true } } } }),
      ])
      return {
        en_revision: review.map((p) => ({ id: p.id, titulo: p.title, origen: p.origin, horas_esperando: Math.round((Date.now() - p.updatedAt.getTime()) / H) })),
        fallidas_7d: failed.map((f) => ({ id: f.id, canal: f.channel, publicacion: f.post.title, error: f.lastError?.slice(0, 200) ?? null })),
        agentes: agents.map((a) => ({ id: a.id, campana: a.campaign.name, objetivo: a.campaign.objective, estado: a.status, modo: a.mode, degradado: a.degradedReason, presupuesto_mensual_usd: a.monthlyBudgetUsd })),
      }
    },
  },
  solicitudes_sin_propuestas: {
    def: { name: 'solicitudes_sin_propuestas', description: 'Solicitudes activas sin ninguna propuesta: servicio, ciudad, horas desde que se crearon y socios verificados disponibles para ese servicio.', input_schema: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 20 } } } },
    run: async (i) => {
      const rows = await prisma.serviceRequest.findMany({
        where: { status: 'ACTIVE', proposals: { none: {} } }, orderBy: { createdAt: 'asc' }, take: limit(i.limite, 10, 20),
        select: { id: true, city: true, budget: true, createdAt: true, service: { select: { id: true, name: true } } },
      })
      const partners = await Promise.all(rows.map((r) => prisma.partnerProfile.count({ where: { verified: true, isActive: true, isAvailable: true, services: { some: { serviceId: r.service.id } } } }).catch(() => null)))
      return rows.map((r, idx) => ({ id: r.id, servicio: r.service.name, ciudad: r.city, presupuesto: r.budget, horas: Math.round((Date.now() - r.createdAt.getTime()) / H), socios_disponibles: partners[idx] }))
    },
  },
  costos_ia: {
    def: { name: 'costos_ia', description: 'Gasto de IA del mes por tipo de llamada y por proveedor.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const where = { period: periodOf(new Date()) }
      const [byKind, byProvider] = await Promise.all([
        prisma.aiCall.groupBy({ by: ['kind'], where, _sum: { costUsd: true }, _count: { _all: true } }),
        prisma.aiCall.groupBy({ by: ['provider'], where, _sum: { costUsd: true }, _count: { _all: true } }),
      ])
      const row = (r: { _sum: { costUsd: number | null }; _count: { _all: number } }) => ({ llamadas: r._count._all, costo_usd: Math.round((r._sum.costUsd ?? 0) * 100) / 100 })
      return { por_tipo: byKind.map((r) => ({ tipo: r.kind, ...row(r) })), por_proveedor: byProvider.map((r) => ({ proveedor: r.provider, ...row(r) })) }
    },
  },
  incidentes_abiertos: {
    def: { name: 'incidentes_abiertos', description: 'Incidentes y casos de soporte abiertos (Casos e incidentes): tipo, gravedad, título, descripción, veces y desde cuándo.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const [incidents, cases] = await Promise.all([
        prisma.adminIncident.findMany({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }], take: 20, select: { id: true, type: true, severity: true, status: true, title: true, description: true, source: true, route: true, occurrences: true, firstSeenAt: true, lastSeenAt: true } }),
        prisma.adminSupportCase.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { createdAt: 'asc' }, take: 15 }).catch(() => []),
      ])
      return {
        incidentes: incidents.map((i) => ({ ...i, description: i.description?.slice(0, 300) ?? null })),
        casos_soporte: cases.map((c) => {
          const r = c as Record<string, unknown>
          return { id: r.id, estado: r.status, prioridad: r.priority ?? null, titulo: untrusted(String(r.title ?? r.subject ?? '').slice(0, 160)), vence: r.slaDueAt ?? null, creado: r.createdAt }
        }),
      }
    },
  },
  dinero: {
    def: { name: 'dinero', description: 'Pagos de clientes de 7 días por estado, pagos rechazados recientes con su motivo, pagos a socios fallidos o pendientes con el mensaje del procesador, pagos en efectivo por confirmar y reembolsos abiertos.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const since = new Date(Date.now() - 7 * 24 * H)
      const [byStatus, rejected, payouts, payoutsPending, cash, refunds] = await Promise.all([
        prisma.payment.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { totalAmount: true } }),
        prisma.payment.findMany({ where: { status: 'REJECTED', updatedAt: { gte: since } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, totalAmount: true, paymentMethodType: true, rejectionReason: true, metadata: true, updatedAt: true } }),
        prisma.payout.findMany({ where: { status: 'FAILED' }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, netAmount: true, processorStatus: true, processorMessage: true, notes: true, updatedAt: true, partner: { select: { id: true, user: { select: { name: true } } } } } }),
        prisma.payout.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, _count: { _all: true }, _sum: { netAmount: true }, _min: { createdAt: true } }),
        prisma.payment.findMany({ where: { status: 'PENDING', confirmationStatus: { in: ['CLIENT_REPORTED', 'PARTNER_REPORTED'] } }, take: 10, select: { id: true, totalAmount: true, confirmationStatus: true, clientReportedAt: true, reminderCount: true } }),
        prisma.refundCase.findMany({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'FAILED'] } }, take: 10, select: { id: true, status: true, requestedAmount: true, reason: true, createdAt: true } }).catch(() => []),
      ])
      const metaStatus = (m: string | null) => { try { const j = JSON.parse(m ?? '{}'); return j.status_detail ?? j.statusDetail ?? null } catch { return null } }
      return {
        pagos_7d: byStatus.map((b) => ({ estado: b.status, cantidad: b._count._all, total_cop: b._sum.totalAmount ?? 0 })),
        rechazados: rejected.map((p) => ({ id: p.id, monto: p.totalAmount, medio: p.paymentMethodType, motivo: p.rejectionReason ?? metaStatus(p.metadata), fecha: p.updatedAt })),
        pagos_a_socios_fallidos: payouts.map((p) => ({ id: p.id, socio: p.partner.user.name, neto: p.netAmount, estado_procesador: p.processorStatus, mensaje: p.processorMessage?.slice(0, 200) ?? null, notas: p.notes?.slice(0, 200) ?? null, fecha: p.updatedAt })),
        pagos_a_socios_pendientes: { cantidad: payoutsPending._count._all, neto_cop: payoutsPending._sum.netAmount ?? 0, mas_antiguo: payoutsPending._min.createdAt },
        efectivo_por_confirmar: cash,
        reembolsos_abiertos: refunds.map((r) => ({ ...r, reason: untrusted(r.reason.slice(0, 200)) })),
      }
    },
  },
  oferta_y_demanda: {
    def: { name: 'oferta_y_demanda', description: 'Por servicio y ciudad: solicitudes frente a socios disponibles, servicios sin socios y conversión a propuestas y reservas.', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['7d', '30d', '90d'] } } } },
    run: async (i) => supplyTab(parsePeriod({ preset: period(i.periodo) }), cleanFilters()),
  },
  busquedas: {
    def: { name: 'busquedas', description: 'Qué busca la gente en el sitio: totales, términos más buscados y los que no dan resultados (demanda no atendida).', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['7d', '30d', '90d'] } } } },
    run: async (i) => searchTab(parsePeriod({ preset: period(i.periodo) })),
  },
  personas_y_adquisicion: {
    def: { name: 'personas_y_adquisicion', description: 'Registros de clientes y socios, de dónde llegan (origen de adquisición), cohortes de recompra y actividad.', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['7d', '30d', '90d'] } } } },
    run: async (i) => peopleTab(parsePeriod({ preset: period(i.periodo) }), cleanFilters()),
  },
  atencion: {
    def: { name: 'atencion', description: 'Bandeja: conversaciones por canal, tiempos de primera respuesta, qué responde la IA y qué las personas.', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['7d', '30d', '90d'] } } } },
    run: async (i) => serviceTab(parsePeriod({ preset: period(i.periodo) })),
  },
  resenas: {
    def: { name: 'resenas', description: 'Calificaciones bajas (1 a 2 estrellas) de los últimos 30 días con el socio y el comentario, y los socios peor calificados.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const since = new Date(Date.now() - 30 * 24 * H)
      const [low, worst] = await Promise.all([
        prisma.review.findMany({ where: { clientReviewedAt: { gte: since }, clientToPartnerRating: { lte: 2 } }, orderBy: { clientReviewedAt: 'desc' }, take: 15, select: { clientToPartnerRating: true, clientToPartnerComment: true, clientReviewedAt: true, booking: { select: { id: true, service: { select: { name: true } }, partner: { select: { id: true, user: { select: { name: true } } } } } } } }),
        prisma.partnerProfile.findMany({ where: { totalReviews: { gte: 3 }, isActive: true }, orderBy: { rating: 'asc' }, take: 5, select: { id: true, rating: true, totalReviews: true, user: { select: { name: true } } } }),
      ])
      return {
        bajas_30d: low.map((r) => ({ estrellas: r.clientToPartnerRating, servicio: r.booking.service?.name ?? null, socio: r.booking.partner?.user.name ?? null, socio_id: r.booking.partner?.id ?? null, comentario: untrusted(r.clientToPartnerComment?.slice(0, 240) ?? ''), fecha: r.clientReviewedAt })),
        socios_peor_calificados: worst.map((p) => ({ id: p.id, nombre: p.user.name, calificacion: p.rating, resenas: p.totalReviews })),
      }
    },
  },
  socios: {
    def: { name: 'socios', description: 'Socios: verificados, disponibles, activos sin verificar, nuevos de 7 días y por ciudad; los que más y menos trabajan.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const week = new Date(Date.now() - 7 * 24 * H)
      const [byCity, pending, fresh, top] = await Promise.all([
        prisma.partnerProfile.groupBy({ by: ['city', 'verified', 'isAvailable'], where: { isActive: true }, _count: { _all: true } }),
        prisma.partnerProfile.findMany({ where: { verified: false, isActive: true }, orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, city: true, createdAt: true, _count: { select: { documents: true, services: true } } } }),
        prisma.partnerProfile.count({ where: { createdAt: { gte: week } } }),
        prisma.partnerProfile.findMany({ where: { isActive: true, verified: true }, orderBy: { completedServicesCount: 'desc' }, take: 5, select: { id: true, completedServicesCount: true, rating: true, user: { select: { name: true } } } }),
      ])
      return {
        por_ciudad: byCity.map((b) => ({ ciudad: b.city, verificado: b.verified, disponible: b.isAvailable, cantidad: b._count._all })),
        sin_verificar: pending.map((p) => ({ id: p.id, ciudad: p.city, dias: Math.round((Date.now() - p.createdAt.getTime()) / (24 * H)), documentos: p._count.documents, servicios: p._count.services })),
        nuevos_7d: fresh,
        los_que_mas_trabajan: top.map((p) => ({ id: p.id, nombre: p.user.name, servicios: p.completedServicesCount, calificacion: p.rating })),
      }
    },
  },
  mensajeria: {
    def: { name: 'mensajeria', description: 'Campañas de mensajes recientes (WhatsApp, correo, SMS, push) con enviados y fallidos, y los errores más comunes de envío en 24 h.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const day = new Date(Date.now() - 24 * H)
      const [campaigns, errors, byStatus] = await Promise.all([
        prisma.messagingCampaign.findMany({ where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * H) } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, name: true, channel: true, status: true, totalRecipients: true, totalSent: true, totalFailed: true, scheduledAt: true } }),
        prisma.messagingDelivery.groupBy({ by: ['channel', 'errorCode'], where: { createdAt: { gte: day }, status: 'FAILED' }, _count: { _all: true } }),
        prisma.messagingDelivery.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: day } }, _count: { _all: true } }),
      ])
      return { campanas_7d: campaigns, envios_24h: byStatus.map((b) => ({ canal: b.channel, estado: b.status, n: b._count._all })), errores_24h: errors.map((e) => ({ canal: e.channel, codigo: e.errorCode, n: e._count._all })) }
    },
  },
  seguridad: {
    def: { name: 'seguridad', description: 'Eventos de seguridad de 24 h por tipo y gravedad, IP bloqueadas y rutas más atacadas.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const day = new Date(Date.now() - 24 * H)
      const [byType, byPath, blocked] = await Promise.all([
        prisma.securityEvent.groupBy({ by: ['threatType', 'severity'], where: { createdAt: { gte: day } }, _count: { _all: true } }),
        prisma.securityEvent.groupBy({ by: ['path'], where: { createdAt: { gte: day } }, _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 8 }),
        prisma.blockedIp.count({ where: { isActive: true } }),
      ])
      return { por_tipo: byType.map((b) => ({ tipo: b.threatType, gravedad: b.severity, n: b._count._all })), rutas: byPath.map((b) => ({ ruta: b.path, n: b._count._all })), ip_bloqueadas: blocked }
    },
  },
  agentes_marketing: {
    def: { name: 'agentes_marketing', description: 'Ejecuciones de los agentes de marketing en 48 h (estrategia, plan, redacción, programación, aprendizaje) con resultado, error y costo, y su gasto del mes.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const runs = await prisma.marketingAgentRun.findMany({ where: { startedAt: { gte: new Date(Date.now() - 48 * H) } }, orderBy: { startedAt: 'desc' }, take: 30, select: { agentId: true, type: true, status: true, summary: true, error: true, costUsd: true, startedAt: true, agent: { select: { campaign: { select: { name: true } } } } } })
      return runs.map((r) => ({ campana: r.agent.campaign.name, tipo: r.type, estado: r.status, resumen: r.summary?.slice(0, 160) ?? null, error: r.error?.slice(0, 200) ?? null, costo_usd: r.costUsd, fecha: r.startedAt }))
    },
  },
  publicidad: {
    def: { name: 'publicidad', description: 'Anuncios internos del sitio (Publicidad): activos, vencidos, impresiones, clics y CTR.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const ads = await prisma.advertisement.findMany({ orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, title: true, placement: true, active: true, startDate: true, endDate: true, impressions: true, clicks: true } })
      return ads.map((a) => ({ ...a, vencido: Boolean(a.endDate && a.endDate < new Date()), ctr: a.impressions ? Math.round((a.clicks / a.impressions) * 1000) / 10 : null }))
    },
  },
  hallazgos_abiertos: {
    def: { name: 'hallazgos_abiertos', description: 'Los hallazgos que Haggo ya tiene abiertos, para no repetirlos.', input_schema: { type: 'object', properties: {} } },
    run: async () => {
      const rows = await prisma.haggoFinding.findMany({ where: { status: { in: ['new', 'seen'] } }, orderBy: { lastSeenAt: 'desc' }, take: 30, select: { domain: true, severity: true, title: true, occurrences: true, createdAt: true } })
      return rows
    },
  },
}

export const READ_TOOL_DEFS = Object.values(READ_TOOLS).map((t) => t.def)

/** Runs a read tool; the result is JSON text capped in size. Unknown tools and errors come back as data. */
export async function runReadTool(name: string, input: unknown) {
  const tool = READ_TOOLS[name]
  if (!tool) return { output: JSON.stringify({ error: `Herramienta desconocida: ${name}` }), isError: true }
  try {
    const out = JSON.stringify(await tool.run(input && typeof input === 'object' ? (input as Record<string, unknown>) : {}))
    return { output: out.length > MAX_OUTPUT ? `${out.slice(0, MAX_OUTPUT)}…(recortado)` : out, isError: false }
  } catch (err) {
    return { output: JSON.stringify({ error: err instanceof Error ? err.message.slice(0, 300) : 'Error' }), isError: true }
  }
}
