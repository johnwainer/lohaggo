import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider, sendMetaWhatsAppTemplate, sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { getDefaultWorkspaceId } from '@/lib/workspaces'
import {
  sendWelcomePartner,
  sendVerificationReminder,
  sendReferralInvite,
} from '@/lib/messaging/whatsapp-templates'

const logger = createLogger('automation-service')

async function saveAutomationMessageToInbox(params: {
  channel: 'WHATSAPP' | 'SMS'
  contactPhone: string
  userId: string | null
  contactName: string | null
  body: string
}) {
  try {
    const { channel, contactPhone, userId, contactName, body } = params
    const snippet = body.slice(0, 200)

    const conversation = await prisma.conversation.upsert({
      where: { channel_contactPhone: { channel, contactPhone } },
      create: {
        channel,
        workspaceId: await getDefaultWorkspaceId(),
        contactPhone,
        contactName,
        userId,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessageBody: snippet,
        unreadCount: 0,
      },
      update: {
        lastMessageAt: new Date(),
        lastMessageBody: snippet,
        ...(userId ? { userId } : {}),
        ...(contactName ? { contactName } : {}),
      },
    })

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        body,
        status: 'SENT',
        senderType: 'AUTOMATION',
      },
    })

    emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  } catch (err) {
    logger.error('saveAutomationMessageToInbox failed', { err })
  }
}

export type AutomationTrigger =
  | 'PARTNER_REGISTERED'
  | 'CLIENT_REGISTERED'
  | 'PARTNER_DOCS_REMINDER'
  | 'PARTNER_REFERRAL_REMINDER'
  | 'CLIENT_FIRST_BOOKING_NUDGE'
  | 'CLIENT_REFERRAL_REMINDER'
  | 'PARTNER_DOCS_APPROVED'
  | 'PARTNER_DOCS_REJECTED'
  | 'PARTNER_ACTIVATED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'REVIEW_RECEIVED'
  | 'INBOUND_MESSAGE'

/**
 * Schedule automations for a user event.
 * contextId makes executions unique per event (booking ID, conversation ID, etc.)
 * so the same user can trigger the same rule multiple times for different contexts.
 */
export async function scheduleAutomationsForUser(
  userId: string,
  trigger: AutomationTrigger,
  opts: { targetRole?: 'PARTNER' | 'CLIENT'; contextId?: string } = {}
) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: {
        trigger,
        isActive: true,
        ...(opts.targetRole ? { targetRole: opts.targetRole } : {}),
      },
    })
    if (!rules.length) return

    const executions: {
      ruleId: string
      userId: string
      channel: any
      status: string
      contextId: string | null
      scheduledAt: Date
    }[] = []

    for (const rule of rules) {
      const parsedChannels: string[] = JSON.parse(rule.channels)
      const scheduledAt = new Date(Date.now() + rule.delayHours * 3_600_000)
      for (const channel of parsedChannels) {
        executions.push({
          ruleId: rule.id,
          userId,
          channel,
          status: 'PENDING',
          contextId: opts.contextId ?? null,
          scheduledAt,
        })
      }
    }

    await prisma.automationExecution.createMany({
      data: executions,
      skipDuplicates: true,
    })

    logger.info('Automations scheduled', { userId, trigger, count: executions.length })
  } catch (err) {
    logger.error('scheduleAutomationsForUser failed', { userId, trigger, err })
  }
}

/**
 * Processes due AutomationExecution rows. Called by cron every hour.
 */
export async function processDueAutomations(limit = 100) {
  const due = await prisma.automationExecution.findMany({
    where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
    include: {
      rule: true,
      user: { select: { id: true, name: true, email: true, phone: true, role: true, excludedFromMarketing: true } },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })

  if (!due.length) return { sent: 0, failed: 0, skipped: 0 }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  let sent = 0, failed = 0, skipped = 0

  const relevance = new Map<string, string | null>()
  for (const execution of due) {
    const { rule, user } = execution

    // One relevance check per user+rule per run (a rule with two channels has two executions)
    const relevanceKey = `${user.id}:${rule.id}`
    if (!relevance.has(relevanceKey)) {
      relevance.set(relevanceKey, await loadRelevanceSkipReason(rule.trigger as AutomationTrigger, user).catch(() => null))
    }
    const skipReason = relevance.get(relevanceKey)
    if (skipReason) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'SKIPPED', executedAt: new Date(), error: skipReason },
      })
      skipped++
      continue
    }

    const destination = execution.channel === 'EMAIL' ? user.email : user.phone
    if (!destination) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'SKIPPED', executedAt: new Date(), error: 'No destination' },
      })
      skipped++
      continue
    }

    const optOut = await prisma.messagingOptOut.findFirst({
      where: { channel: execution.channel, destination, isActive: true },
    })
    if (optOut) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'SKIPPED', executedAt: new Date(), error: 'Opted out' },
      })
      skipped++
      continue
    }

    try {
      let result: { ok: boolean; errorCode?: string; errorMessage?: string }

      if (execution.channel === 'WHATSAPP' && rule.waTemplateFn && user.phone) {
        // Read extra static variables from rule metadata
        let extraVars: Record<string, string> = {}
        if (rule.metadata) {
          try {
            const meta = JSON.parse(rule.metadata)
            if (meta.waVars) extraVars = meta.waVars
          } catch { /* ignore */ }
        }
        result = await dispatchWaTemplate(rule.waTemplateFn, user.phone, user.name, extraVars, execution.contextId ?? undefined)
      } else {
        const body = (rule.customBody ?? '').replace(/\{\{name\}\}/g, user.name)
        const subject = (rule.subject ?? '').replace(/\{\{name\}\}/g, user.name)

        result = await sendMessageViaProvider(
          {
            channel: execution.channel as any,
            to: destination,
            userId: user.id,
            subject: subject || undefined,
            body,
          },
          runtimeConfig
        )
      }

      if (result.ok) {
        await prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: 'SENT', executedAt: new Date() },
        })
        sent++

        // Mirror outbound message to inbox for WhatsApp and SMS
        if ((execution.channel === 'WHATSAPP' || execution.channel === 'SMS') && user.phone) {
          const sentBody = execution.channel === 'WHATSAPP' && rule.waTemplateFn
            ? `[Plantilla: ${rule.waTemplateFn}]`
            : (rule.customBody ?? '').replace(/\{\{name\}\}/g, user.name)
          await saveAutomationMessageToInbox({
            channel: execution.channel as 'WHATSAPP' | 'SMS',
            contactPhone: user.phone,
            userId: user.id,
            contactName: user.name,
            body: sentBody,
          })
        }
      } else {
        await prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            executedAt: new Date(),
            error: result.errorCode ?? result.errorMessage ?? 'Unknown',
          },
        })
        failed++
      }
    } catch (err: any) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'FAILED', executedAt: new Date(), error: String(err?.message ?? err) },
      })
      failed++
    }
  }

  logger.info('processDueAutomations done', { sent, failed, skipped })
  return { sent, failed, skipped }
}

/** Triggers that promote (not a reply to something the user did): they respect `excludedFromMarketing`. */
export const MARKETING_TRIGGERS: ReadonlySet<AutomationTrigger> = new Set<AutomationTrigger>([
  'CLIENT_FIRST_BOOKING_NUDGE',
  'CLIENT_REFERRAL_REMINDER',
  'PARTNER_REFERRAL_REMINDER',
])

const IDENTITY_DOCS = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'] as const

export type RelevanceContext = {
  excludedFromMarketing?: boolean | null
  /** Client already asked for something (a request or a booking). */
  hasRequestOrBooking?: boolean
  partnerVerified?: boolean
  /** Partner uploaded an identity document that is pending or approved. */
  hasIdentityDoc?: boolean
}

/** Why a due automation should not go out any more, or null to send it. Pure. */
export function automationSkipReason(trigger: AutomationTrigger, ctx: RelevanceContext): string | null {
  if (MARKETING_TRIGGERS.has(trigger) && ctx.excludedFromMarketing) return 'Excluido de marketing'
  if (trigger === 'CLIENT_FIRST_BOOKING_NUDGE' && ctx.hasRequestOrBooking) return 'Ya tiene una solicitud o reserva'
  if (trigger === 'PARTNER_DOCS_REMINDER') {
    if (ctx.partnerVerified) return 'Socio ya verificado'
    if (ctx.hasIdentityDoc) return 'Ya subió su documento de identidad'
  }
  return null
}

async function loadRelevanceSkipReason(trigger: AutomationTrigger, user: { id: string; excludedFromMarketing?: boolean | null }) {
  const ctx: RelevanceContext = { excludedFromMarketing: user.excludedFromMarketing }
  if (trigger === 'CLIENT_FIRST_BOOKING_NUDGE') {
    const [requests, bookings] = await Promise.all([
      prisma.serviceRequest.count({ where: { userId: user.id } }),
      prisma.booking.count({ where: { userId: user.id } }),
    ])
    ctx.hasRequestOrBooking = requests + bookings > 0
  }
  if (trigger === 'PARTNER_DOCS_REMINDER') {
    const partner = await prisma.partnerProfile.findUnique({
      where: { userId: user.id },
      select: { verified: true, documents: { where: { type: { in: [...IDENTITY_DOCS] }, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true }, take: 1 } },
    })
    ctx.partnerVerified = Boolean(partner?.verified)
    ctx.hasIdentityDoc = Boolean(partner?.documents.length)
  }
  return automationSkipReason(trigger, ctx)
}

async function dispatchWaTemplate(
  fn: string,
  phone: string,
  name: string,
  extraVars: Record<string, string> = {},
  contextId?: string
): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }> {
  const cfg = await getMessagingProviderRuntimeConfig()
  // {{1}} is always the user name; extra vars override or supplement
  const vars = { '1': name, ...extraVars }

  // meta:{templateName}:{language} → Meta WhatsApp API
  if (fn.startsWith('meta:')) {
    const parts = fn.split(':')
    const templateName = parts[1]
    const language = parts[2] ?? 'es_CO'
    return sendMetaWhatsAppTemplate(phone, templateName, language, vars, cfg.metaWhatsApp)
  }

  // HXxxxxxxx → Twilio Content SID
  if (fn.startsWith('HX')) {
    return sendWhatsAppTemplate(phone, fn, vars, cfg.twilio)
  }

  // Booking-contextual functions — look up booking data by contextId
  if (
    fn === 'sendPropuestaAceptadaSocio' ||
    fn === 'sendReservaConfirmadaCliente' ||
    fn === 'sendReservaCancelada' ||
    fn === 'sendReservaCompletadaCliente' ||
    fn === 'sendReservaCompletadaSocio'
  ) {
    const {
      sendPropuestaAceptadaSocio, sendReservaConfirmadaCliente, sendReservaCancelada,
      sendReservaCompletadaCliente, sendReservaCompletadaSocio,
    } = await import('@/lib/messaging/whatsapp-templates')

    let serviceName = extraVars['2'] ?? 'servicio'
    let when = extraVars['3'] ?? 'fecha acordada'

    if (contextId) {
      try {
        const booking = await prisma.booking.findUnique({
          where: { id: contextId },
          include: { service: true },
        })
        if (booking) {
          serviceName = booking.service.name
          const d = new Date(booking.scheduledDate)
          when = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
          if (booking.scheduledTime) when += ` a las ${booking.scheduledTime}`
        }
      } catch { /* use fallback values */ }
    }

    switch (fn) {
      case 'sendPropuestaAceptadaSocio':   return sendPropuestaAceptadaSocio(phone, name, serviceName, when)
      case 'sendReservaConfirmadaCliente': return sendReservaConfirmadaCliente(phone, name, serviceName, when)
      case 'sendReservaCancelada':         return sendReservaCancelada(phone, name, serviceName)
      case 'sendReservaCompletadaCliente': return sendReservaCompletadaCliente(phone, name, serviceName)
      case 'sendReservaCompletadaSocio':   return sendReservaCompletadaSocio(phone, name, serviceName)
    }
  }

  // Named functions (no booking context needed)
  switch (fn) {
    case 'sendWelcomePartner':        return sendWelcomePartner(phone, name)
    case 'sendVerificationReminder':  return sendVerificationReminder(phone, name)
    case 'sendReferralInvite':        return sendReferralInvite(phone, name)
    case 'sendDocumentosAprobados':   return (await import('@/lib/messaging/whatsapp-templates')).sendDocumentosAprobados(phone, name)
    case 'sendDocumentosRechazados':  return (await import('@/lib/messaging/whatsapp-templates')).sendDocumentosRechazados(phone, name)
    case 'sendSocioActivado':         return (await import('@/lib/messaging/whatsapp-templates')).sendSocioActivado(phone, name)
    default:
      return { ok: false, errorCode: 'UNKNOWN_TEMPLATE_FN', errorMessage: `No WA template: ${fn}` }
  }
}

/** Default rules to seed when none exist */
export const DEFAULT_AUTOMATION_RULES = [
  // ── REGISTRO ──────────────────────────────────────────
  {
    name: 'Bienvenida Socio (Email)',
    description: 'Email de bienvenida inmediato cuando un socio se registra.',
    trigger: 'PARTNER_REGISTERED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['EMAIL']),
    waTemplateFn: null,
    subject: '¡Bienvenido a LoHaggo, {{name}}!',
    customBody: `Hola {{name}},\n\nBienvenido a LoHaggo. Estás a un paso de recibir solicitudes de clientes.\n\nCompleta tu verificación subiendo tus documentos de identidad y certificados de estudios en:\nhttps://lohaggo.com/partner/verification\n\n¡Ya puedes empezar a ganar!\n\nEquipo LoHaggo`,
    isActive: true,
  },
  {
    name: 'Bienvenida Cliente (Email)',
    description: 'Email de bienvenida inmediato cuando un cliente se registra.',
    trigger: 'CLIENT_REGISTERED' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 0,
    channels: JSON.stringify(['EMAIL']),
    waTemplateFn: null,
    subject: '¡Bienvenido a LoHaggo, {{name}}!',
    customBody: `Hola {{name}},\n\nBienvenido a LoHaggo. Encuentra el profesional ideal para cualquier servicio del hogar en minutos.\n\n👉 Busca un servicio ahora: https://www.lohaggo.com/servicios\n\n¡Estamos para ayudarte!\nEquipo LoHaggo`,
    isActive: true,
  },
  // ── RECORDATORIOS ──────────────────────────────────────────
  {
    name: 'Verificación Documentos Socio (WhatsApp)',
    description: 'Recordatorio WhatsApp a las 24h si el socio aún no ha verificado sus documentos.',
    trigger: 'PARTNER_DOCS_REMINDER' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 24,
    channels: JSON.stringify(['WHATSAPP']),
    waTemplateFn: 'sendVerificationReminder',
    subject: null,
    customBody: null,
    isActive: true,
  },
  {
    name: 'Verificación Documentos Socio (SMS)',
    description: 'SMS recordatorio a las 24h para que el socio suba sus documentos.',
    trigger: 'PARTNER_DOCS_REMINDER' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 24,
    channels: JSON.stringify(['SMS']),
    waTemplateFn: null,
    subject: null,
    customBody: 'LoHaggo: Hola {{name}}, completa tu verificación de documentos para recibir solicitudes de clientes: https://lohaggo.com/partner/verification',
    isActive: true,
  },
  {
    name: 'Referidos Socios (WhatsApp + SMS)',
    description: 'Invitación a referir amigos socios a los 7 días del registro.',
    trigger: 'PARTNER_REFERRAL_REMINDER' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 168,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendReferralInvite',
    subject: null,
    customBody: 'LoHaggo: Hola {{name}}, ¿conoces a alguien que quiera ganar dinero con sus habilidades? Refiere amigos a LoHaggo: https://lohaggo.com/unete',
    isActive: true,
  },
  {
    name: 'Primer Servicio Cliente (Email + SMS)',
    description: 'Recordatorio a los 3 días si el cliente aún no ha solicitado su primer servicio.',
    trigger: 'CLIENT_FIRST_BOOKING_NUDGE' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 72,
    channels: JSON.stringify(['EMAIL', 'SMS']),
    waTemplateFn: null,
    subject: '{{name}}, ¿necesitas ayuda en casa?',
    customBody: 'LoHaggo: Hola {{name}}, encuentra el profesional ideal para tu hogar en minutos: https://www.lohaggo.com/servicios',
    isActive: true,
  },
  {
    name: 'Referidos Clientes (Email)',
    description: 'Invitación a referir amigos clientes a los 7 días del registro.',
    trigger: 'CLIENT_REFERRAL_REMINDER' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 168,
    channels: JSON.stringify(['EMAIL']),
    waTemplateFn: null,
    subject: '¿Conoces a alguien que necesite un profesional?',
    customBody: 'Hola {{name}},\n\n¿Tienes amigos o familiares que necesiten servicios del hogar? Recomiéndales LoHaggo.\n\nComparte el enlace: https://lohaggo.com\n\nEquipo LoHaggo',
    isActive: true,
  },
  // ── DOCUMENTOS ──────────────────────────────────────────
  {
    name: 'Documentos Aprobados (WhatsApp + SMS)',
    description: 'Notificación inmediata al socio cuando uno de sus documentos es aprobado.',
    trigger: 'PARTNER_DOCS_APPROVED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendDocumentosAprobados',
    subject: null,
    customBody: '✅ LoHaggo: ¡Hola {{name}}! Tu documento fue aprobado. Sube los documentos que faltan para completar tu verificación y activar tu perfil:\nhttps://www.lohaggo.com/partner/verification',
    isActive: true,
  },
  {
    name: 'Documentos Rechazados (WhatsApp + SMS)',
    description: 'Notificación inmediata al socio cuando uno de sus documentos es rechazado.',
    trigger: 'PARTNER_DOCS_REJECTED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendDocumentosRechazados',
    subject: null,
    customBody: '❌ LoHaggo: Hola {{name}}, tu documento fue rechazado. Revisa el motivo en tu panel de verificación y vuelve a subirlo:\nhttps://www.lohaggo.com/partner/verification',
    isActive: true,
  },
  {
    name: 'Socio Activado (WhatsApp + SMS + Email)',
    description: 'Notificación cuando el perfil del socio es activado y puede recibir clientes.',
    trigger: 'PARTNER_ACTIVATED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP', 'SMS', 'EMAIL']),
    waTemplateFn: 'sendSocioActivado',
    subject: '🎉 ¡Ya puedes recibir clientes en LoHaggo!',
    customBody: '🎉 LoHaggo: ¡Felicitaciones {{name}}! Tu perfil de socio está verificado y activo. Ya puedes recibir solicitudes de clientes.\n\nActiva tu disponibilidad y revisa tus servicios:\nhttps://www.lohaggo.com/partner\n\n¡Mucho éxito!\nEquipo LoHaggo',
    isActive: true,
  },
  // ── RESERVAS ──────────────────────────────────────────
  {
    name: 'Reserva Creada — Confirmación Cliente (WhatsApp)',
    description: 'WA al cliente cuando acepta una propuesta y se crea la reserva.',
    trigger: 'BOOKING_CREATED' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP']),
    waTemplateFn: 'sendReservaConfirmadaCliente',
    subject: null,
    customBody: null,
    isActive: true,
  },
  {
    name: 'Reserva Creada — Aviso Socio (WhatsApp)',
    description: 'WA al socio cuando su propuesta es aceptada y se crea la reserva.',
    trigger: 'BOOKING_CREATED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP']),
    waTemplateFn: 'sendPropuestaAceptadaSocio',
    subject: null,
    customBody: null,
    isActive: true,
  },
  {
    name: 'Reserva Confirmada — Aviso Cliente (WhatsApp)',
    description: 'WA al cliente cuando el socio confirma asistencia a la reserva.',
    trigger: 'BOOKING_CONFIRMED' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP']),
    waTemplateFn: 'sendReservaConfirmadaCliente',
    subject: null,
    customBody: null,
    isActive: true,
  },
  {
    name: 'Reserva Cancelada — Aviso (WhatsApp + SMS)',
    description: 'Notificación a cliente y socio cuando una reserva es cancelada.',
    trigger: 'BOOKING_CANCELLED' as AutomationTrigger,
    targetRole: null,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendReservaCancelada',
    subject: null,
    customBody: 'LoHaggo: Hola {{name}}, tu reserva fue cancelada. Si tienes preguntas contáctanos desde la app.',
    isActive: true,
  },
  {
    name: 'Reserva Completada — Pide reseña (Cliente)',
    description: 'WhatsApp al cliente 1h después de completar una reserva pidiéndole que deje una reseña.',
    trigger: 'BOOKING_COMPLETED' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 1,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendReservaCompletadaCliente',
    subject: null,
    customBody: 'LoHaggo: Hola {{name}}, ¿cómo fue tu servicio? Deja tu reseña aquí: https://www.lohaggo.com/dashboard?tab=bookings',
    isActive: true,
  },
  {
    name: 'Reserva Completada — Felicitación Socio',
    description: 'WhatsApp al socio cuando completa una reserva.',
    trigger: 'BOOKING_COMPLETED' as AutomationTrigger,
    targetRole: 'PARTNER' as const,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP', 'SMS']),
    waTemplateFn: 'sendReservaCompletadaSocio',
    subject: null,
    customBody: 'LoHaggo: ¡Excelente trabajo, {{name}}! Tu servicio fue marcado como completado. Sigue así 💪',
    isActive: true,
  },
  // ── MENSAJERÍA INBOUND ──────────────────────────────────────────
  {
    name: 'Auto-respuesta Mensaje Entrante (WhatsApp)',
    description: 'Respuesta automática cuando un usuario envía un mensaje por WhatsApp por primera vez.',
    trigger: 'INBOUND_MESSAGE' as AutomationTrigger,
    targetRole: null,
    delayHours: 0,
    channels: JSON.stringify(['WHATSAPP']),
    waTemplateFn: null,
    subject: null,
    customBody: null,
    isActive: false,
  },
]

/** Default bodies that shipped with links to pages that do not exist; replaced only when a rule still has them verbatim. */
export const LEGACY_DEFAULT_BODIES: Record<string, string> = {
  'Hola {{name}},\n\nBienvenido a LoHaggo. Encuentra el profesional ideal para cualquier servicio del hogar en minutos.\n\n👉 Busca un servicio ahora: https://lohaggo.com/buscar\n\n¡Estamos para ayudarte!\nEquipo LoHaggo':
    'Hola {{name}},\n\nBienvenido a LoHaggo. Encuentra el profesional ideal para cualquier servicio del hogar en minutos.\n\n👉 Busca un servicio ahora: https://www.lohaggo.com/servicios\n\n¡Estamos para ayudarte!\nEquipo LoHaggo',
  'LoHaggo: Hola {{name}}, encuentra el profesional ideal para tu hogar en minutos: https://lohaggo.com/buscar':
    'LoHaggo: Hola {{name}}, encuentra el profesional ideal para tu hogar en minutos: https://www.lohaggo.com/servicios',
  'LoHaggo: Hola {{name}}, ¿cómo fue tu servicio? Deja tu reseña aquí: https://lohaggo.com/mis-reservas':
    'LoHaggo: Hola {{name}}, ¿cómo fue tu servicio? Deja tu reseña aquí: https://www.lohaggo.com/dashboard?tab=bookings',
}

type RuleKeyFields = { name: string; trigger: string; targetRole: string | null; channels: string }

/**
 * Which defaults are missing from the existing rules. A default counts as present when a rule has its name,
 * or the same trigger + target role + channels (an admin may have renamed it). Pure.
 */
export function missingDefaultRules<T extends RuleKeyFields>(existing: RuleKeyFields[], defaults: T[]): T[] {
  const names = new Set(existing.map((r) => r.name))
  const shapes = new Set(existing.map((r) => `${r.trigger}|${r.targetRole ?? ''}|${r.channels}`))
  return defaults.filter((d) => !names.has(d.name) && !shapes.has(`${d.trigger}|${d.targetRole ?? ''}|${d.channels}`))
}

/**
 * Idempotent: creates the default rules that are missing (never touches the existing ones' settings) and
 * swaps the broken-link default texts in existing rules only when the text is exactly the old default.
 * Cheap enough to run on every automations cron.
 */
export async function ensureDefaultAutomationRules() {
  const existing = await prisma.automationRule.findMany({ select: { id: true, name: true, trigger: true, targetRole: true, channels: true, customBody: true } })
  const missing = missingDefaultRules(existing, DEFAULT_AUTOMATION_RULES)
  let created = 0
  if (missing.length > 0) {
    const res = await prisma.automationRule.createMany({ data: missing.map((r) => ({ ...r, targetRole: r.targetRole ?? null })) })
    created = res.count
    logger.info('Default automation rules created', { names: missing.map((r) => r.name) })
  }
  let fixedLinks = 0
  for (const rule of existing) {
    const next = rule.customBody ? LEGACY_DEFAULT_BODIES[rule.customBody] : undefined
    if (!next) continue
    const res = await prisma.automationRule.updateMany({ where: { id: rule.id, customBody: rule.customBody }, data: { customBody: next } })
    fixedLinks += res.count
  }
  return { created, fixedLinks, createdNames: missing.map((r) => r.name) }
}
