import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { trustReport } from '@/lib/public/trust'
import { CLAIMS, isClaimKey } from '@/lib/public/claims'
import { loadPlatformConfigRow } from '@/lib/payments/commission'
import { PLATFORM_CHANGELOG } from '@/lib/haggo/platform-facts'
import { ACTIVE_STATUSES, STRIKE_WINDOW_DAYS, STRIKES_TO_PAUSE, TYPE_LABEL, isGuaranteeType } from '@/lib/guarantee/policy'
import { untrusted } from '@/lib/haggo/prompt'

/** `maxOutput`: characters of JSON the model gets back (8000 by default) */
export type ReadTool = { def: Anthropic.Tool; run: (input: Record<string, unknown>) => Promise<unknown>; maxOutput?: number }

const H = 3600_000
const MAX_ROWS = 80
const PER_SOURCE = 25
const short = (d: Date) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
const hoursSince = (d: Date) => Math.round((Date.now() - d.getTime()) / H)

export type ActivityRow = { at: Date; area: string; que: string; origen?: string; ref: string }

/** Newest first, capped; `cuando` in Bogotá time. Pure. */
export function mergeActivity(rows: ActivityRow[], max = MAX_ROWS) {
  return rows
    .filter((r) => r.at instanceof Date && !Number.isNaN(r.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, max)
    .map((r) => ({ cuando: short(r.at), area: r.area, que: r.que, ...(r.origen ? { origen: r.origen } : {}), ref: r.ref }))
}

const inWindow = (d: Date | null | undefined, since: Date): d is Date => Boolean(d && d >= since)
const originOf = (o: string | null | undefined, channel?: string | null) => (o === 'chat' ? `chat${channel ? ` (${channel})` : ''}` : (o ?? 'app'))

async function recentActivity(hours: number) {
  const since = new Date(Date.now() - hours * H)
  const take = PER_SOURCE
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[])
  const [users, requests, proposals, bookings, events, payments, reviews, docs, aiActions, audit, published, incidents] = await Promise.all([
    safe(prisma.user.findMany({ where: { createdAt: { gte: since }, role: { in: ['CLIENT', 'PARTNER'] } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, role: true, createdAt: true } })),
    safe(prisma.serviceRequest.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, city: true, origin: true, originChannel: true, createdAt: true, service: { select: { name: true } } } })),
    safe(prisma.proposal.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, price: true, origin: true, originChannel: true, createdAt: true, serviceRequest: { select: { service: { select: { name: true } } } } } })),
    safe(prisma.booking.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, city: true, totalPrice: true, origin: true, originChannel: true, createdAt: true, service: { select: { name: true } } } })),
    safe(prisma.bookingEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: take * 2, select: { bookingId: true, type: true, fromStatus: true, toStatus: true, actorType: true, origin: true, originChannel: true, detail: true, createdAt: true } })),
    safe(prisma.payment.findMany({ where: { OR: [{ paidAt: { gte: since } }, { clientReportedAt: { gte: since } }, { partnerConfirmedAt: { gte: since } }, { partnerRejectedAt: { gte: since } }] }, orderBy: { updatedAt: 'desc' }, take, select: { id: true, status: true, totalAmount: true, clientReportedMethod: true, paidAt: true, clientReportedAt: true, partnerConfirmedAt: true, partnerRejectedAt: true, origin: true, originChannel: true } })),
    safe(prisma.review.findMany({ where: { clientReviewedAt: { gte: since } }, orderBy: { clientReviewedAt: 'desc' }, take, select: { id: true, clientToPartnerRating: true, clientToPartnerComment: true, clientReviewedAt: true, origin: true, originChannel: true } })),
    safe(prisma.verificationDocument.findMany({ where: { OR: [{ createdAt: { gte: since } }, { reviewedAt: { gte: since } }] }, orderBy: { updatedAt: 'desc' }, take, select: { id: true, partnerId: true, type: true, status: true, createdAt: true, reviewedAt: true, origin: true, originChannel: true } })),
    safe(prisma.aiAgentAction.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, agentName: true, agentId: true, tool: true, status: true, summary: true, createdAt: true, conversationId: true } })),
    // Admin actions: what and on what, never IP, browser nor free-text details
    safe(prisma.adminAuditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true } })),
    safe(prisma.marketingPublication.findMany({ where: { publishedAt: { gte: since } }, orderBy: { publishedAt: 'desc' }, take, select: { id: true, channel: true, publishedAt: true, post: { select: { title: true } } } })),
    safe(prisma.adminIncident.findMany({ where: { OR: [{ firstSeenAt: { gte: since } }, { resolvedAt: { gte: since } }] }, orderBy: { lastSeenAt: 'desc' }, take, select: { id: true, title: true, severity: true, status: true, firstSeenAt: true, resolvedAt: true } })),
  ])

  const rows: ActivityRow[] = []
  for (const u of users) rows.push({ at: u.createdAt, area: 'usuarios', que: u.role === 'PARTNER' ? 'Nuevo socio registrado' : 'Nuevo cliente registrado', ref: `User:${u.id}` })
  for (const r of requests) rows.push({ at: r.createdAt, area: 'solicitudes', que: `Solicitud de ${r.service.name} en ${r.city}`, origen: originOf(r.origin, r.originChannel), ref: `ServiceRequest:${r.id}` })
  for (const p of proposals) rows.push({ at: p.createdAt, area: 'propuestas', que: `Propuesta de $${Math.round(p.price).toLocaleString('es-CO')} para ${p.serviceRequest.service.name}`, origen: originOf(p.origin, p.originChannel), ref: `Proposal:${p.id}` })
  for (const b of bookings) rows.push({ at: b.createdAt, area: 'reservas', que: `Reserva creada: ${b.service.name} en ${b.city} por $${Math.round(b.totalPrice).toLocaleString('es-CO')}`, origen: originOf(b.origin, b.originChannel), ref: `Booking:${b.id}` })
  for (const e of events) {
    const what = e.type === 'status' ? `Reserva ${e.fromStatus ?? '—'} → ${e.toStatus ?? '—'}` : e.type === 'reschedule' ? 'Reserva reprogramada' : e.type === 'payment' ? `Pago de la reserva${e.toStatus ? `: ${e.toStatus}` : ''}` : e.type === 'guarantee' ? 'Garantía de la reserva' : `Reserva: ${e.type}`
    const detail = e.detail ? ` ${untrusted(e.detail.slice(0, 120))}` : ''
    rows.push({ at: e.createdAt, area: 'reservas', que: `${what} (por ${e.actorType})${detail}`, origen: originOf(e.origin, e.originChannel), ref: `Booking:${e.bookingId}` })
  }
  for (const p of payments) {
    const amount = `$${Math.round(p.totalAmount).toLocaleString('es-CO')}`
    const o = originOf(p.origin, p.originChannel)
    if (inWindow(p.paidAt, since) && p.status === 'APPROVED') rows.push({ at: p.paidAt, area: 'pagos', que: `Pago aprobado ${amount}`, origen: o, ref: `Payment:${p.id}` })
    if (inWindow(p.clientReportedAt, since)) rows.push({ at: p.clientReportedAt, area: 'pagos', que: `Cliente reportó pago ${amount}${p.clientReportedMethod ? ` (${p.clientReportedMethod === 'CASH' ? 'efectivo' : 'transferencia'})` : ''}`, origen: o, ref: `Payment:${p.id}` })
    if (inWindow(p.partnerConfirmedAt, since)) rows.push({ at: p.partnerConfirmedAt, area: 'pagos', que: `Socio confirmó pago ${amount}`, ref: `Payment:${p.id}` })
    if (inWindow(p.partnerRejectedAt, since)) rows.push({ at: p.partnerRejectedAt, area: 'pagos', que: `Socio rechazó el pago reportado ${amount}`, ref: `Payment:${p.id}` })
  }
  for (const r of reviews) if (r.clientReviewedAt) rows.push({ at: r.clientReviewedAt, area: 'reseñas', que: `Reseña de ${r.clientToPartnerRating ?? '?'}★${r.clientToPartnerComment ? ` ${untrusted(r.clientToPartnerComment.slice(0, 100))}` : ''}`, origen: originOf(r.origin, r.originChannel), ref: `Review:${r.id}` })
  for (const d of docs) {
    if (inWindow(d.createdAt, since)) rows.push({ at: d.createdAt, area: 'documentos', que: `Documento subido: ${d.type}`, origen: originOf(d.origin, d.originChannel), ref: `PartnerProfile:${d.partnerId}` })
    if (inWindow(d.reviewedAt, since) && d.status !== 'PENDING') rows.push({ at: d.reviewedAt, area: 'documentos', que: `Documento ${d.type} ${d.status === 'APPROVED' ? 'aprobado' : 'rechazado'}`, ref: `PartnerProfile:${d.partnerId}` })
  }
  for (const a of aiActions) rows.push({ at: a.createdAt, area: 'agentes de bandeja', que: `${a.agentName ?? 'Agente'} · ${a.tool} (${a.status}): ${untrusted(a.summary.slice(0, 140))}`, origen: 'chat', ref: `Conversation:${a.conversationId}` })
  for (const l of audit) rows.push({ at: l.createdAt, area: 'admin', que: `Acción del admin: ${l.action} sobre ${l.entityType}`, origen: 'admin', ref: `${l.entityType}:${l.entityId ?? '—'}` })
  for (const p of published) if (p.publishedAt) rows.push({ at: p.publishedAt, area: 'marketing', que: `Publicado en ${p.channel}: ${p.post.title.slice(0, 100)}`, ref: `MarketingPublication:${p.id}` })
  for (const i of incidents) {
    if (inWindow(i.firstSeenAt, since)) rows.push({ at: i.firstSeenAt, area: 'incidentes', que: `Incidente ${i.severity}: ${i.title.slice(0, 140)}`, ref: `AdminIncident:${i.id}` })
    if (inWindow(i.resolvedAt, since)) rows.push({ at: i.resolvedAt, area: 'incidentes', que: `Incidente resuelto: ${i.title.slice(0, 140)}`, ref: `AdminIncident:${i.id}` })
  }
  const merged = mergeActivity(rows)
  return { horas: hours, total_eventos: rows.length, mostrados: merged.length, actividad: merged }
}

export const PLATFORM_READ_TOOLS: Record<string, ReadTool> = {
  actividad_reciente: {
    def: {
      name: 'actividad_reciente',
      description: 'Todo lo que pasó en la plataforma en las últimas horas, en un solo feed ordenado (más nuevo primero, máximo 80): registros de clientes y socios, solicitudes, propuestas, reservas y sus cambios de estado, reprogramaciones y pagos (BookingEvent), pagos aprobados, reportados y confirmados, reseñas, documentos subidos, aprobados o rechazados, acciones de los agentes de bandeja, acciones del admin, publicaciones de marketing e incidentes. Cada fila trae su origen (app, chat, admin) y una referencia.',
      input_schema: { type: 'object', properties: { horas: { type: 'integer', minimum: 1, maximum: 72, description: 'Horas hacia atrás (24 por defecto)' } } },
    },
    maxOutput: 16_000,
    run: async (i) => {
      const h = Number.isInteger(i.horas) && (i.horas as number) >= 1 ? Math.min(i.horas as number, 72) : 24
      return recentActivity(h)
    },
  },
  configuracion_plataforma: {
    def: {
      name: 'configuracion_plataforma',
      description: 'Configuración viva: comisiones (encendidas o no, tasas de cliente y socio), medios de pago y precios mínimo y máximo; ciudades (slug, nombre, estado, lanzada); todas las funciones (FeatureFlag) con su estado; y las afirmaciones públicas del sitio (key, qué dice, qué requiere, si está encendida), los hechos reales que las respaldan y las encendidas SIN respaldo. Úsala antes de proponer cambios de comisiones, ciudades o afirmaciones (key y slug salen de aquí).',
      input_schema: { type: 'object', properties: {} },
    },
    maxOutput: 14_000,
    run: async () => {
      const [row, cities, flags, trust] = await Promise.all([
        loadPlatformConfigRow(),
        prisma.cityConfig.findMany({ orderBy: { order: 'asc' }, select: { slug: true, name: true, status: true, isLaunched: true, launchDate: true } }),
        prisma.featureFlag.findMany({ orderBy: { key: 'asc' }, take: 80, select: { key: true, name: true, enabled: true } }),
        trustReport(),
      ])
      return {
        pagos: row ? {
          comisiones_encendidas: row.commissionEnabled,
          comision_cliente_pct: row.clientCommissionRate,
          comision_socio_pct: row.partnerCommissionRate,
          efectivo: row.cashEnabled, transferencia: row.transferEnabled, mercadopago: row.mercadoPagoEnabled,
          precio_min: row.minServicePrice, precio_max: row.maxServicePrice,
        } : null,
        ciudades: cities.map((c) => ({ slug: c.slug, nombre: c.name, estado: c.status, lanzada: c.isLaunched, lanzamiento: c.launchDate })),
        funciones: flags.filter((f) => !isClaimKey(f.key)).map((f) => ({ key: f.key, nombre: f.name, encendida: f.enabled })),
        afirmaciones: Object.entries(trust.claims).map(([key, on]) => {
          const c = isClaimKey(key) ? CLAIMS[key] : null
          return { key, nombre: c?.name ?? key, tipo: c?.kind ?? null, dice: c?.says ?? null, requiere: c?.requires ?? null, encendida: on }
        }),
        hechos_reales: trust.facts,
        minimos_para_mostrar_cifras: trust.minimums,
        no_respaldadas: trust.unbacked,
      }
    },
  },
  verificacion_documentos: {
    def: {
      name: 'verificacion_documentos',
      description: 'Verificación de socios: documentos pendientes de revisar con su antigüedad (horas) y tipo, cuántos por tipo, socios que esperan verificación, y socios ya verificados que no tienen ningún servicio activo (no reciben solicitudes).',
      input_schema: { type: 'object', properties: {} },
    },
    run: async () => {
      const [pending, byType, noServices] = await Promise.all([
        prisma.verificationDocument.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 20, select: { id: true, type: true, createdAt: true, origin: true, partner: { select: { id: true, city: true, verified: true } } } }),
        prisma.verificationDocument.groupBy({ by: ['type'], where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } }),
        prisma.partnerProfile.findMany({ where: { verified: true, isActive: true, services: { none: { active: true } } }, orderBy: { createdAt: 'asc' }, take: 20, select: { id: true, city: true, createdAt: true } }),
      ])
      const waiting = new Map<string, { partnerId: string; ciudad: string; documentos: number; horas_mas_antiguo: number }>()
      for (const d of pending) {
        if (d.partner.verified) continue
        const cur = waiting.get(d.partner.id)
        const h = hoursSince(d.createdAt)
        if (cur) { cur.documentos++; cur.horas_mas_antiguo = Math.max(cur.horas_mas_antiguo, h) } else waiting.set(d.partner.id, { partnerId: d.partner.id, ciudad: d.partner.city, documentos: 1, horas_mas_antiguo: h })
      }
      return {
        pendientes: pending.map((d) => ({ documentId: d.id, tipo: d.type, horas: hoursSince(d.createdAt), socio: d.partner.id, socio_verificado: d.partner.verified, origen: d.origin })),
        por_tipo: byType.map((t) => ({ tipo: t.type, pendientes: t._count._all, horas_mas_antiguo: t._min.createdAt ? hoursSince(t._min.createdAt) : null })),
        socios_esperando: Array.from(waiting.values()),
        verificados_sin_servicios: noServices.map((p) => ({ partnerId: p.id, ciudad: p.city, dias_desde_registro: Math.round(hoursSince(p.createdAt) / 24) })),
      }
    },
  },
  garantia: {
    def: {
      name: 'garantia',
      description: `Garantía LoHaggo (lib/guarantee/policy.ts): reclamos activos con su plazo (SLA de 72 h; horas que faltan o vencido), tipo (no llegó, trabajo mal hecho, daño), estado y socio; activos por tipo; y faltas por socio en ${STRIKE_WINDOW_DAYS} días (con ${STRIKES_TO_PAUSE} se pausa solo). Resolver es de una persona (dinero y sanciones): tú solo recomiendas qué remedio aplicar.`,
      input_schema: { type: 'object', properties: {} },
    },
    maxOutput: 12_000,
    run: async () => {
      const now = Date.now()
      const since = new Date(now - STRIKE_WINDOW_DAYS * 24 * H)
      const [active, byType, strikes, closed30] = await Promise.all([
        prisma.guaranteeClaim.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { slaDueAt: 'asc' }, take: 30, select: { id: true, type: true, status: true, slaDueAt: true, createdAt: true, origin: true, partnerId: true, description: true, bookingId: true } }),
        prisma.guaranteeClaim.groupBy({ by: ['type'], where: { status: { in: ACTIVE_STATUSES } }, _count: { _all: true } }),
        prisma.guaranteeClaim.groupBy({ by: ['partnerId'], where: { partnerStrike: true, partnerId: { not: null }, createdAt: { gte: since } }, _count: { _all: true } }),
        prisma.guaranteeClaim.groupBy({ by: ['remedy'], where: { resolvedAt: { gte: new Date(now - 30 * 24 * H) } }, _count: { _all: true } }),
      ]).catch(() => null) ?? [[], [], [], []]
      const partnerIds = Array.from(new Set([...active.map((c) => c.partnerId), ...strikes.map((s) => s.partnerId)].filter((p): p is string => Boolean(p))))
      const partners = partnerIds.length ? await prisma.partnerProfile.findMany({ where: { id: { in: partnerIds } }, select: { id: true, isAvailable: true, user: { select: { name: true } } } }).catch(() => []) : []
      const name = (id: string | null) => (id ? partners.find((p) => p.id === id)?.user.name ?? id : null)
      const strikeOf = new Map(strikes.map((s) => [s.partnerId, s._count._all]))
      return {
        activos: active.map((c) => {
          const h = Math.round((c.slaDueAt.getTime() - now) / H)
          return {
            ref: `GuaranteeClaim:${c.id}`, reserva: `Booking:${c.bookingId}`, tipo: isGuaranteeType(c.type) ? TYPE_LABEL[c.type] : c.type, estado: c.status,
            horas_para_vencer: h, vencido: h < 0, origen: c.origin, socio: name(c.partnerId), faltas_socio_90d: c.partnerId ? strikeOf.get(c.partnerId) ?? 0 : 0,
            descripcion: untrusted(c.description.slice(0, 160)),
          }
        }),
        activos_por_tipo: byType.map((t) => ({ tipo: isGuaranteeType(t.type) ? TYPE_LABEL[t.type] : t.type, activos: t._count._all })),
        vencidos: active.filter((c) => c.slaDueAt.getTime() < now).length,
        faltas_por_socio_90d: strikes.map((s) => ({ partnerId: s.partnerId, socio: name(s.partnerId), faltas: s._count._all, pausado: partners.find((p) => p.id === s.partnerId)?.isAvailable === false })).sort((a, b) => b.faltas - a.faltas),
        remedios_30d: closed30.map((r) => ({ remedio: r.remedy ?? 'sin remedio', veces: r._count._all })),
      }
    },
  },
  novedades_plataforma: {
    def: {
      name: 'novedades_plataforma',
      description: 'Qué cambió en el producto recientemente (más nuevo primero): fecha, área, cambio, impacto esperado y cómo verlo en los datos. Úsala para comprobar si una novedad ya se nota o para explicar un cambio en las cifras.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async () => PLATFORM_CHANGELOG,
  },
}
