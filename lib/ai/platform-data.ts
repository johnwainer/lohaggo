import { prisma } from '@/lib/prisma'

/**
 * Read-only platform lookups for the agents. CRM modules only ever read the user linked to the
 * conversation (resolved server-side, never from the model's input). The catalog is public data.
 */
export const CRM_MODULES = {
  cuenta: 'Cuenta del usuario',
  reservas: 'Reservas (como cliente)',
  solicitudes: 'Solicitudes de servicio',
  pagos: 'Pagos (como cliente)',
  socio_perfil: 'Socio: estado y perfil',
  socio_documentos: 'Socio: documentos de verificación',
  socio_servicios: 'Socio: servicios y precios',
  socio_reservas: 'Socio: reservas',
  socio_propuestas: 'Socio: propuestas',
  socio_pagos: 'Socio: pagos de la plataforma y cuenta bancaria',
} as const
export type CrmModule = keyof typeof CRM_MODULES

const TZ = 'America/Bogota'
export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TZ }).format(d) : '—')
export const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`)
const ref = (id: string) => id.slice(-6)
const last4 = (s: string) => `…${s.replace(/\D/g, '').slice(-4)}`
export function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '—'
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`
}

const BOOKING: Record<string, string> = { PENDING: 'pendiente de confirmar por el socio', CONFIRMED: 'confirmada', IN_PROGRESS: 'en curso', COMPLETED: 'completada', CANCELLED: 'cancelada' }
const REQUEST: Record<string, string> = { ACTIVE: 'abierta recibiendo propuestas', ACCEPTED: 'propuesta aceptada', EXPIRED: 'vencida', CANCELLED: 'cancelada' }
const PROPOSAL: Record<string, string> = { PENDING: 'en espera', ACCEPTED: 'aceptada', REJECTED: 'no elegida' }
const PAYMENT: Record<string, string> = { PENDING: 'pendiente', APPROVED: 'aprobado', REJECTED: 'rechazado', CANCELLED: 'cancelado', REFUNDED: 'reembolsado' }
const CONFIRMATION: Record<string, string> = {
  NONE: 'sin reportar', CLIENT_REPORTED: 'reportado por el cliente, falta que el socio confirme', PARTNER_REPORTED: 'reportado por el socio',
  CONFIRMED: 'confirmado', DISPUTED: 'en disputa (lo revisa un administrador)', REJECTED_BY_PARTNER: 'el socio rechazó el reporte',
}
const PAYOUT: Record<string, string> = { PENDING: 'pendiente', PROCESSING: 'en proceso', COMPLETED: 'transferido', FAILED: 'falló la transferencia', CANCELLED: 'cancelado' }
const DOC_STATUS: Record<string, string> = { PENDING: 'en revisión', APPROVED: 'aprobado', REJECTED: 'rechazado' }
const DOC_TYPE: Record<string, string> = {
  CEDULA_CIUDADANIA: 'Cédula de ciudadanía', CEDULA_EXTRANJERIA: 'Cédula de extranjería', PASAPORTE: 'Pasaporte', PEP: 'PEP',
  DIPLOMA_BACHILLERATO: 'Diploma de bachillerato', DIPLOMA_TECNICO: 'Diploma técnico', DIPLOMA_TECNOLOGO: 'Diploma tecnólogo',
  DIPLOMA_PROFESIONAL: 'Diploma profesional', DIPLOMA_POSGRADO: 'Diploma de posgrado', CERTIFICADO_CURSO: 'Certificado de curso',
  ANTECEDENTES: 'Antecedentes', CAMARA_COMERCIO: 'Cámara de comercio',
}
const IDENTITY_DOCS = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
const CITY: Record<string, string> = { MEDELLIN: 'Medellín', BOGOTA: 'Bogotá', CALI: 'Cali', BARRANQUILLA: 'Barranquilla' }
const label = (map: Record<string, string>, v: string | null | undefined) => (v ? map[v] ?? v : '—')

async function partnerOf(userId: string) {
  return prisma.partnerProfile.findUnique({ where: { userId } })
}

export async function crmLookup(module: string, userId: string | null): Promise<string> {
  if (!(module in CRM_MODULES)) return `Módulo "${module}" no disponible.`
  const name = CRM_MODULES[module as CrmModule]
  if (!userId) return `${name}: no disponible (este contacto no está vinculado a un usuario de la plataforma).`
  try {
    if (module.startsWith('socio_')) {
      const partner = await partnerOf(userId)
      if (!partner) return `${name}: este usuario no es socio (no tiene perfil de socio).`
      return await partnerModule(module as CrmModule, partner)
    }
    return await clientModule(module as CrmModule, userId)
  } catch {
    // Never let a failed lookup read as "no records"
    return `${name}: no disponible en este momento.`
  }
}

async function clientModule(module: CrmModule, userId: string): Promise<string> {
  if (module === 'cuenta') {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true, isActive: true, createdAt: true, clientRating: true, clientTotalReviews: true, notificationsPushEnabled: true, notificationsEmailEnabled: true, notificationsWhatsappEnabled: true, notificationsSmsEnabled: true, _count: { select: { addresses: true } } },
    })
    if (!u) return 'Cuenta: no encontrada.'
    const role = u.role === 'PARTNER' ? 'socio' : u.role === 'CLIENT' ? 'cliente' : 'equipo'
    const notif = [u.notificationsPushEnabled && 'push', u.notificationsEmailEnabled && 'correo', u.notificationsWhatsappEnabled && 'WhatsApp', u.notificationsSmsEnabled && 'SMS'].filter(Boolean).join(', ') || 'ninguna'
    return [
      `Cuenta de ${u.name} (${role}), correo ${maskEmail(u.email)}, registrada el ${fmtDate(u.createdAt)}.`,
      `Estado: ${u.isActive ? 'activa' : 'INACTIVA (solo el equipo la puede reactivar)'}.`,
      `Direcciones guardadas: ${u._count.addresses}. Notificaciones activas: ${notif}.`,
      u.clientTotalReviews ? `Calificación como cliente: ${u.clientRating.toFixed(1)} (${u.clientTotalReviews} reseñas).` : '',
    ].filter(Boolean).join('\n')
  }
  if (module === 'reservas') {
    const rows = await prisma.booking.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, scheduledDate: true, scheduledTime: true, status: true, totalPrice: true, service: { select: { name: true } }, partner: { select: { user: { select: { name: true } } } }, payment: { select: { status: true, confirmationStatus: true } } },
    })
    if (!rows.length) return 'Reservas: el cliente no tiene reservas registradas.'
    return `Reservas (${rows.length} más recientes):\n${rows.map((r) => `• ${r.service.name} con ${r.partner?.user.name ?? 'socio por asignar'} · ${fmtDate(r.scheduledDate)} ${r.scheduledTime} · ${label(BOOKING, r.status)} · ${fmtMoney(r.totalPrice)} · pago: ${r.payment ? `${label(PAYMENT, r.payment.status)}, ${label(CONFIRMATION, r.payment.confirmationStatus)}` : 'sin pago registrado'} · ref ${ref(r.id)}`).join('\n')}`
  }
  if (module === 'solicitudes') {
    const rows = await prisma.serviceRequest.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, status: true, createdAt: true, expiresAt: true, preferredDate: true, isUrgent: true, city: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
    })
    if (!rows.length) return 'Solicitudes: el cliente no tiene solicitudes registradas.'
    return `Solicitudes (${rows.length} más recientes):\n${rows.map((r) => `• ${r.service.name} en ${label(CITY, r.city)} · creada ${fmtDate(r.createdAt)} · ${r.isUrgent ? 'lo antes posible' : `preferida ${fmtDate(r.preferredDate)}`} · ${label(REQUEST, r.status)}${r.status === 'ACTIVE' ? ` hasta ${fmtDate(r.expiresAt)}` : ''} · ${r._count.proposals} propuesta(s) · ref ${ref(r.id)}`).join('\n')}`
  }
  if (module === 'pagos') {
    const rows = await prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, confirmationStatus: true, totalAmount: true, paidAt: true, createdAt: true, booking: { select: { service: { select: { name: true } } } } } })
    if (!rows.length) return 'Pagos: el cliente no tiene pagos registrados.'
    return `Pagos (${rows.length} más recientes):\n${rows.map((r) => `• ${r.booking?.service?.name ?? 'Servicio'} · ${fmtMoney(r.totalAmount)} · ${label(PAYMENT, r.status)} · ${label(CONFIRMATION, r.confirmationStatus)} · ${r.paidAt ? `pagado ${fmtDate(r.paidAt)}` : `creado ${fmtDate(r.createdAt)}`} · ref ${ref(r.id)}`).join('\n')}`
  }
  return `${CRM_MODULES[module]}: no disponible.`
}

type Partner = NonNullable<Awaited<ReturnType<typeof partnerOf>>>

async function partnerModule(module: CrmModule, p: Partner): Promise<string> {
  if (module === 'socio_perfil') {
    const docs = await prisma.verificationDocument.findMany({ where: { partnerId: p.id }, select: { type: true, status: true } })
    const identity = docs.filter((d) => IDENTITY_DOCS.includes(d.type))
    const identityState = identity.some((d) => d.status === 'APPROVED') ? 'aprobada' : identity.some((d) => d.status === 'PENDING') ? 'en revisión' : identity.length ? 'rechazada, debe subirla de nuevo' : 'sin subir'
    return [
      `Socio: ${p.verified ? 'VERIFICADO' : 'NO verificado'} · cuenta de socio ${p.isActive ? 'activa' : 'INACTIVA'} · ${p.isAvailable ? 'disponible (recibe avisos de solicitudes)' : 'NO disponible (interruptor apagado, no recibe avisos)'}.`,
      `Identidad: ${identityState}. Ciudad: ${label(CITY, p.city)}.`,
      `Calificación: ${p.totalReviews ? `${p.rating.toFixed(1)} (${p.totalReviews} reseñas)` : 'aún sin reseñas'}. Servicios completados: ${p.completedServicesCount}.`,
      `Perfil público: ${p.isPublicProfile && p.slug ? `visible en lohaggo.com/pro/${p.slug}` : 'no visible'}.${p.isCompany ? ` Registrado como empresa${p.companyName ? ` (${p.companyName})` : ''}.` : ''}`,
      !p.verified ? 'Sin verificación no puede enviar propuestas ni recibir reservas.' : '',
    ].filter(Boolean).join('\n')
  }
  if (module === 'socio_documentos') {
    const docs = await prisma.verificationDocument.findMany({ where: { partnerId: p.id }, orderBy: { createdAt: 'desc' }, select: { type: true, status: true, rejectionReason: true, createdAt: true, reviewedAt: true } })
    const hasIdentity = docs.some((d) => IDENTITY_DOCS.includes(d.type))
    const lines = docs.map((d) => `• ${label(DOC_TYPE, d.type)} · ${label(DOC_STATUS, d.status)} · subido ${fmtDate(d.createdAt)}${d.reviewedAt ? ` · revisado ${fmtDate(d.reviewedAt)}` : ''}${d.status === 'REJECTED' && d.rejectionReason ? ` · motivo: ${d.rejectionReason}` : ''}`)
    return [
      docs.length ? `Documentos (${docs.length}):\n${lines.join('\n')}` : 'Documentos: todavía no ha subido ninguno.',
      !hasIdentity ? 'Falta el documento de identidad (paso 1 de Verificación).' : '',
    ].filter(Boolean).join('\n')
  }
  if (module === 'socio_servicios') {
    const rows = await prisma.partnerService.findMany({ where: { partnerId: p.id }, select: { price: true, city: true, active: true, service: { select: { name: true, basePrice: true } } } })
    if (!rows.length) return 'Servicios del socio: no tiene servicios configurados.'
    return `Servicios del socio (${rows.length} de 5 posibles):\n${rows.map((r) => `• ${r.service.name} · su precio ${fmtMoney(r.price)} (base ${fmtMoney(r.service.basePrice)}) · ${label(CITY, r.city)} · ${r.active ? 'activo' : 'inactivo'}`).join('\n')}`
  }
  if (module === 'socio_reservas') {
    const rows = await prisma.booking.findMany({
      where: { partnerId: p.id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, scheduledDate: true, scheduledTime: true, status: true, totalPrice: true, service: { select: { name: true } }, user: { select: { name: true } }, payment: { select: { status: true, confirmationStatus: true } } },
    })
    if (!rows.length) return 'Reservas del socio: no tiene reservas.'
    return `Reservas del socio (${rows.length} más recientes):\n${rows.map((r) => `• ${r.service.name} para ${r.user.name.split(' ')[0]} · ${fmtDate(r.scheduledDate)} ${r.scheduledTime} · ${label(BOOKING, r.status)} · ${fmtMoney(r.totalPrice)} · pago: ${r.payment ? `${label(PAYMENT, r.payment.status)}, ${label(CONFIRMATION, r.payment.confirmationStatus)}` : 'sin pago registrado'} · ref ${ref(r.id)}`).join('\n')}`
  }
  if (module === 'socio_propuestas') {
    const rows = await prisma.proposal.findMany({
      where: { partnerId: p.id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, price: true, status: true, createdAt: true, serviceRequest: { select: { status: true, service: { select: { name: true } } } } },
    })
    if (!rows.length) return 'Propuestas del socio: no ha enviado propuestas.'
    return `Propuestas del socio (${rows.length} más recientes):\n${rows.map((r) => `• ${r.serviceRequest.service.name} · ${fmtMoney(r.price)} · enviada ${fmtDate(r.createdAt)} · ${label(PROPOSAL, r.status)} · solicitud ${label(REQUEST, r.serviceRequest.status)} · ref ${ref(r.id)}`).join('\n')}`
  }
  if (module === 'socio_pagos') {
    const [payouts, accounts] = await Promise.all([
      prisma.payout.findMany({ where: { partnerId: p.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, netAmount: true, partnerCommission: true, status: true, createdAt: true, processedAt: true } }),
      prisma.partnerBankAccount.findMany({ where: { partnerId: p.id, isActive: true }, select: { bankName: true, accountType: true, accountNumber: true, isDefault: true } }),
    ])
    const acc = accounts.length
      ? accounts.map((a) => `${a.bankName} ${a.accountType === 'CHECKING' ? 'corriente' : 'ahorros'} ${last4(a.accountNumber)}${a.isDefault ? ' (principal)' : ''}`).join('; ')
      : 'no tiene cuenta bancaria registrada (la necesita para recibir transferencias)'
    const list = payouts.length
      ? `Pagos de la plataforma (solo de servicios pagados en línea):\n${payouts.map((r) => `• ${fmtMoney(r.netAmount)} neto (comisión ${fmtMoney(r.partnerCommission)}) · ${label(PAYOUT, r.status)} · creado ${fmtDate(r.createdAt)}${r.processedAt ? ` · procesado ${fmtDate(r.processedAt)}` : ''} · ref ${ref(r.id)}`).join('\n')}`
      : 'Pagos de la plataforma: ninguno (los pagos en efectivo o transferencia los recibe directamente del cliente).'
    return `${list}\nCuentas bancarias: ${acc}.`
  }
  return `${CRM_MODULES[module]}: no disponible.`
}

// ─── Catalog (public platform data) ─────────────────────────────────────────

export const CATALOG_TOPICS = ['servicios', 'ciudades', 'pagos'] as const

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function catalogLookup(topic: string, query: string): Promise<string> {
  try {
    if (topic === 'ciudades') {
      const cities = await prisma.cityConfig.findMany({ where: { status: { in: ['ACTIVE', 'COMING_SOON'] } }, orderBy: { order: 'asc' }, select: { name: true, status: true, launchDate: true } })
      if (!cities.length) return 'Ciudades: no hay ciudades configuradas.'
      return `Ciudades:\n${cities.map((c) => `• ${c.name}: ${c.status === 'ACTIVE' ? 'activa' : `próximamente${c.launchDate ? ` (${fmtDate(c.launchDate)})` : ''}; ya se pueden registrar socios`}`).join('\n')}`
    }
    if (topic === 'pagos') {
      const c = await prisma.platformConfig.findFirst({ select: { cashEnabled: true, transferEnabled: true, mercadoPagoEnabled: true, clientCommissionRate: true, partnerCommissionRate: true, minServicePrice: true, maxServicePrice: true } })
      if (!c) return 'Pagos: configuración no disponible.'
      const methods = [c.cashEnabled && 'efectivo al socio', c.transferEnabled && 'transferencia a la cuenta del socio', c.mercadoPagoEnabled && 'pago en línea con MercadoPago'].filter(Boolean).join(', ')
      return [
        `Medios de pago habilitados: ${methods || 'ninguno'}.`,
        `Tarifa de servicio que ve el cliente en las propuestas: ${c.clientCommissionRate}%. Comisión del socio: ${c.partnerCommissionRate}%.`,
        `Precio de un servicio: entre ${fmtMoney(c.minServicePrice)} y ${fmtMoney(c.maxServicePrice)}.`,
      ].join('\n')
    }
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      select: { name: true, services: { orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, basePrice: true, duration: true, description: true } } },
    })
    const counts = await prisma.partnerService.groupBy({
      by: ['serviceId'],
      where: { active: true, partner: { verified: true, isActive: true } },
      _count: { _all: true },
    })
    const partners = new Map(counts.map((c) => [c.serviceId, c._count._all]))
    const q = norm(query.trim())
    const lines: string[] = []
    for (const cat of categories) {
      const services = cat.services.filter((s) => !q || norm(`${cat.name} ${s.name} ${s.description}`).includes(q))
      if (!services.length) continue
      lines.push(`${cat.name}:`)
      for (const s of services) {
        lines.push(`• ${s.name} · desde ${fmtMoney(s.basePrice)} · ~${s.duration} min · ${partners.get(s.id) ?? 0} socio(s) verificado(s) · lohaggo.com/servicios/${s.slug}${q ? ` · ${s.description.slice(0, 160)}` : ''}`)
      }
    }
    if (!lines.length) return q ? `Servicios: nada coincide con "${query}". Ofrece revisar el catálogo completo.` : 'Servicios: el catálogo está vacío.'
    return `Servicios${q ? ` que coinciden con "${query}"` : ''} (el precio final lo pone el socio en su propuesta):\n${lines.join('\n')}`.slice(0, 7000)
  } catch {
    return 'Catálogo: no disponible en este momento.'
  }
}
