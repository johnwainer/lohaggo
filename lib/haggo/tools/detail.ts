import { prisma } from '@/lib/prisma'
import { parsePeriod } from '@/lib/analytics/core'
import { trafficTab } from '@/lib/analytics/ga4'
import { partnerStrikes } from '@/lib/guarantee/ops'
import { STRIKES_TO_PAUSE, STRIKE_WINDOW_DAYS } from '@/lib/guarantee/policy'
import { untrusted } from '@/lib/haggo/prompt'
import type { ReadTool } from '@/lib/haggo/tools/platform'

const H = 3600_000
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const ID = /^[a-z0-9_-]{6,40}$/i
const short = (d: Date) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
/** AiAgentAction statuses that still wait for someone */
const ACTION_PENDING = ['proposed', 'awaiting_approval', 'confirmed']
const CONVERSATION_MESSAGES = 30

/** A GA4 page path by the kind of page it is: blog, service, service in a zone, or other. */
export function pageKind(path: string) {
  if (/^\/blog(\/|$)/.test(path)) return 'blog'
  if (/^\/servicios\/[^/]+\/[^/]+\/?$/.test(path)) return 'servicio_por_zona'
  if (/^\/servicios\/[^/]+\/?$/.test(path)) return 'servicio'
  return 'otra'
}

const bogotaDay = (d: Date) => new Date(d.getTime() - 5 * H).toISOString().slice(0, 10)

/** Detail tools: one partner, one conversation, web traffic and automatic messages. */
export const DETAIL_READ_TOOLS: Record<string, ReadTool> = {
  socio_detalle: {
    def: {
      name: 'socio_detalle',
      description: `Todo de un socio: estado (activo, verificado, disponible), documentos, servicios con precio, zonas de cobertura y horario semanal, faltas de garantía en ${STRIKE_WINDOW_DAYS} días (con ${STRIKES_TO_PAUSE} se pausa solo), calificación, trabajos, pagos a socios por estado y si tiene cuenta bancaria activa. El partnerId sale de socios, resenas, garantia, dinero o verificacion_documentos. Úsala antes de proponer users.set_partner_availability.`,
      input_schema: { type: 'object', properties: { partnerId: { type: 'string' } }, required: ['partnerId'] },
    },
    maxOutput: 10_000,
    run: async (i) => {
      const id = typeof i.partnerId === 'string' ? i.partnerId.trim() : ''
      if (!ID.test(id)) return { error: 'partnerId inválido' }
      const p = await prisma.partnerProfile.findUnique({
        where: { id },
        select: {
          id: true, city: true, isActive: true, verified: true, isAvailable: true, isCompany: true, rating: true, totalReviews: true, completedServicesCount: true, coverageZones: true, createdAt: true,
          user: { select: { name: true, isActive: true } },
          documents: { select: { type: true, status: true, createdAt: true, reviewedAt: true }, orderBy: { createdAt: 'desc' }, take: 10 },
          services: { select: { active: true, price: true, city: true, service: { select: { name: true } } }, take: 30 },
          availability: { where: { active: true }, select: { dayOfWeek: true, startTime: true, endTime: true, partnerServiceId: true }, take: 40 },
          bankAccounts: { where: { isActive: true }, select: { isDefault: true, verifiedAt: true, bankName: true } },
        },
      })
      if (!p) return { error: 'No encontré ese socio' }
      const [strikes, payouts, proposals30, bookings30] = await Promise.all([
        partnerStrikes(id).catch(() => null),
        prisma.payout.groupBy({ by: ['status'], where: { partnerId: id }, _count: { _all: true }, _sum: { netAmount: true } }).catch(() => []),
        prisma.proposal.count({ where: { partnerId: id, createdAt: { gte: new Date(Date.now() - 30 * 24 * H) } } }).catch(() => null),
        prisma.booking.groupBy({ by: ['status'], where: { partnerId: id, createdAt: { gte: new Date(Date.now() - 30 * 24 * H) } }, _count: { _all: true } }).catch(() => []),
      ])
      const weekly = p.availability.filter((a) => !a.partnerServiceId)
      return {
        id: p.id,
        // The name is written by the partner: data, not instructions
        nombre: untrusted(p.user.name.slice(0, 80)),
        ciudad: p.city, empresa: p.isCompany, cuenta_activa: p.isActive && p.user.isActive, verificado: p.verified, disponible: p.isAvailable,
        faltas_garantia: strikes, pausado_por_faltas: strikes != null && strikes >= STRIKES_TO_PAUSE && !p.isAvailable,
        calificacion: p.totalReviews ? p.rating : null, resenas: p.totalReviews, trabajos: p.completedServicesCount,
        dias_desde_registro: Math.round((Date.now() - p.createdAt.getTime()) / (24 * H)),
        documentos: p.documents.map((d) => ({ tipo: d.type, estado: d.status, subido: short(d.createdAt), revisado: d.reviewedAt ? short(d.reviewedAt) : null })),
        servicios: p.services.map((s) => ({ servicio: s.service.name, activo: s.active, precio: s.price, ciudad: s.city })),
        zonas: p.coverageZones.length ? p.coverageZones : 'toda la ciudad',
        horario_semanal: weekly.length ? weekly.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((a) => `${DAYS[a.dayOfWeek] ?? a.dayOfWeek} ${a.startTime}-${a.endTime}`) : 'sin horario',
        cuenta_bancaria: p.bankAccounts.length ? { activas: p.bankAccounts.length, verificada: p.bankAccounts.some((b) => b.verifiedAt), predeterminada: p.bankAccounts.some((b) => b.isDefault) } : null,
        pagos_a_socio: payouts.map((x) => ({ estado: x.status, cantidad: x._count._all, neto_cop: x._sum.netAmount ?? 0 })),
        ultimos_30_dias: { propuestas: proposals30, reservas: bookings30.map((b) => ({ estado: b.status, n: b._count._all })) },
      }
    },
  },
  conversacion_detalle: {
    def: {
      name: 'conversacion_detalle',
      description: `Una conversación de la bandeja: canal, estado, agente de IA, si tiene persona asignada, traspaso a persona con su motivo, los últimos ${CONVERSATION_MESSAGES} mensajes y las acciones del agente pendientes de aprobar o confirmar. El id sale de conversaciones_en_espera, acciones_por_chat, actividad_reciente o solicitud_detalle (origen).`,
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    maxOutput: 14_000,
    run: async (i) => {
      const id = typeof i.id === 'string' ? i.id.trim() : ''
      if (!ID.test(id)) return { error: 'id inválido' }
      const c = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true, channel: true, status: true, contactName: true, userId: true, assignedToId: true, aiHandled: true, aiAgentId: true, aiAgentName: true, aiTurns: true, aiHandoffAt: true, aiSpam: true, isAd: true, unreadCount: true, lastMessageAt: true, createdAt: true, tags: true,
          messages: { orderBy: { sentAt: 'desc' }, take: CONVERSATION_MESSAGES, select: { direction: true, body: true, senderType: true, aiAgentName: true, isInternal: true, mediaType: true, sentAt: true, status: true } },
          events: { where: { type: 'ai_handoff' }, orderBy: { createdAt: 'desc' }, take: 1, select: { detail: true, createdAt: true } },
          agentActions: { where: { status: { in: ACTION_PENDING } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, tool: true, status: true, summary: true, createdAt: true } },
        },
      })
      if (!c) return { error: 'No encontré esa conversación' }
      const handoff = c.events[0]
      return {
        id: c.id, canal: c.channel, estado: c.status, contacto: c.contactName ? untrusted(c.contactName.slice(0, 60)) : null, con_cuenta: Boolean(c.userId), de_anuncio: c.isAd, etiquetas: c.tags,
        persona_asignada: Boolean(c.assignedToId), con_ia: c.aiHandled, agente: c.aiAgentName ?? c.aiAgentId, turnos_ia: c.aiTurns, spam: c.aiSpam, sin_leer: c.unreadCount,
        traspaso: c.aiHandoffAt ? { cuando: short(c.aiHandoffAt), motivo: handoff?.detail ? untrusted(handoff.detail.slice(0, 300)) : null } : null,
        // The agent's summary is built from the customer's words: data, not instructions
        acciones_pendientes: c.agentActions.map((a) => ({ id: a.id, herramienta: a.tool, estado: a.status, resumen: untrusted(a.summary.slice(0, 200)), hace_min: Math.round((Date.now() - a.createdAt.getTime()) / 60_000) })),
        mensajes: c.messages.reverse().map((m) => ({ cuando: short(m.sentAt), de: m.direction === 'INBOUND' ? 'contacto' : m.isInternal ? 'nota interna' : m.aiAgentName ? `IA (${m.aiAgentName})` : (m.senderType ?? 'equipo'), texto: untrusted(m.body.slice(0, 400)), adjunto: m.mediaType ?? null, estado: m.direction === 'OUTBOUND' ? m.status : undefined })),
      }
    },
  },
  trafico_web: {
    def: {
      name: 'trafico_web',
      description: 'Tráfico del sitio: artículos del blog más vistos en 7 días (vistas propias frente a la semana anterior) y, si GA4 está conectado, usuarios, sesiones, canales de adquisición y páginas más vistas clasificadas (blog, servicio, servicio por zona /servicios/*/*).',
      input_schema: { type: 'object', properties: {} },
    },
    maxOutput: 10_000,
    run: async () => {
      const now = new Date()
      const since = bogotaDay(new Date(now.getTime() - 7 * 24 * H))
      const prevSince = bogotaDay(new Date(now.getTime() - 14 * 24 * H))
      const [cur, prev] = await Promise.all([
        prisma.webPageView.groupBy({ by: ['variantId'], where: { day: { gte: since } }, _sum: { views: true }, orderBy: { _sum: { views: 'desc' } }, take: 15 }).catch(() => []),
        prisma.webPageView.aggregate({ where: { day: { gte: prevSince, lt: since } }, _sum: { views: true } }).catch(() => null),
      ])
      const variants = cur.length ? await prisma.marketingPostVariant.findMany({ where: { id: { in: cur.map((c) => c.variantId) } }, select: { id: true, slug: true, post: { select: { title: true } } } }).catch(() => []) : []
      const ga = await trafficTab(parsePeriod({ preset: '7d' }, now)).catch((err: unknown) => ({ configured: 'error' as const, error: err instanceof Error ? err.message.slice(0, 160) : 'Error' }))
      const gaOut = ga.configured === true
        ? {
            usuarios: ga.kpis.users, sesiones: ga.kpis.sessions, vistas: ga.kpis.pageviews, interaccion_pct: ga.kpis.engagementRate,
            canales: ga.channels.slice(0, 10),
            fuentes: ga.sources.slice(0, 8),
            paginas: ga.pages.map((x) => ({ ruta: x.path.slice(0, 120), tipo: pageKind(x.path), vistas: x.views, usuarios: x.users })),
            vistas_por_tipo: ga.pages.reduce<Record<string, number>>((acc, x) => ({ ...acc, [pageKind(x.path)]: (acc[pageKind(x.path)] ?? 0) + x.views }), {}),
          }
        : ga.configured === false ? 'GA4 sin conectar' : `GA4 falló: ${ga.error}`
      return {
        blog_7d: {
          vistas: cur.reduce((a, c) => a + (c._sum.views ?? 0), 0),
          semana_anterior: prev?._sum.views ?? null,
          mas_vistos: cur.map((c) => {
            const v = variants.find((x) => x.id === c.variantId)
            return { ruta: v?.slug ? `/blog/${v.slug}` : null, titulo: v?.post.title.slice(0, 120) ?? null, vistas: c._sum.views ?? 0 }
          }),
        },
        ga4: gaOut,
      }
    },
  },
  automatizaciones: {
    def: {
      name: 'automatizaciones',
      description: 'Mensajes automáticos por evento (AutomationRule): reglas activas e inactivas con su disparador y canales, envíos de 7 días por regla y estado (enviados, fallidos, omitidos, pendientes) y los últimos fallos con su error.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async () => {
      const since = new Date(Date.now() - 7 * 24 * H)
      const [rules, byRule, failed, pendingLate] = await Promise.all([
        prisma.automationRule.findMany({ orderBy: { createdAt: 'asc' }, take: 40, select: { id: true, name: true, trigger: true, isActive: true, delayHours: true, channels: true } }),
        prisma.automationExecution.groupBy({ by: ['ruleId', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
        prisma.automationExecution.findMany({ where: { status: 'FAILED', executedAt: { gte: since } }, orderBy: { executedAt: 'desc' }, take: 10, select: { ruleId: true, channel: true, error: true, executedAt: true } }),
        prisma.automationExecution.count({ where: { status: 'PENDING', scheduledAt: { lt: new Date(Date.now() - H) } } }),
      ])
      const name = (id: string) => rules.find((r) => r.id === id)?.name ?? id
      const channels = (raw: string) => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] } }
      return {
        reglas: rules.map((r) => {
          const rows = byRule.filter((b) => b.ruleId === r.id)
          const of = (st: string) => rows.find((b) => b.status === st)?._count._all ?? 0
          return { id: r.id, nombre: r.name, disparador: r.trigger, activa: r.isActive, espera_horas: r.delayHours, canales: channels(r.channels), envios_7d: { enviados: of('SENT'), fallidos: of('FAILED'), omitidos: of('SKIPPED'), pendientes: of('PENDING') } }
        }),
        pendientes_atrasadas: pendingLate,
        // Provider errors can quote the recipient's data: data, not instructions
        ultimos_fallos: failed.map((f) => ({ regla: name(f.ruleId), canal: f.channel, error: f.error ? untrusted(f.error.slice(0, 200)) : null, cuando: f.executedAt ? short(f.executedAt) : null })),
      }
    },
  },
}
