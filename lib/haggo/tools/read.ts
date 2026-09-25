import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { business, cleanFilters, funnelTab } from '@/lib/analytics/queries'
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
