import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import {
  sendWelcomePartner,
  sendVerificationReminder,
  sendReferralInvite,
} from '@/lib/messaging/whatsapp-templates'

const logger = createLogger('automation-service')

type AutomationTrigger =
  | 'PARTNER_REGISTERED'
  | 'CLIENT_REGISTERED'
  | 'PARTNER_DOCS_REMINDER'
  | 'PARTNER_REFERRAL_REMINDER'
  | 'CLIENT_FIRST_BOOKING_NUDGE'
  | 'CLIENT_REFERRAL_REMINDER'

/**
 * Called on user registration. Finds all active rules for the trigger
 * and creates pending AutomationExecution rows scheduled at now + delayHours.
 */
export async function scheduleAutomationsForUser(
  userId: string,
  trigger: AutomationTrigger
) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { trigger, isActive: true },
    })
    if (!rules.length) return

    const channels: { ruleId: string; channel: string; scheduledAt: Date }[] = []

    for (const rule of rules) {
      const parsedChannels: string[] = JSON.parse(rule.channels)
      const scheduledAt = new Date(Date.now() + rule.delayHours * 3_600_000)
      for (const channel of parsedChannels) {
        channels.push({ ruleId: rule.id, channel, scheduledAt })
      }
    }

    await prisma.automationExecution.createMany({
      data: channels.map((c) => ({
        ruleId: c.ruleId,
        userId,
        channel: c.channel as any,
        status: 'PENDING',
        scheduledAt: c.scheduledAt,
      })),
      skipDuplicates: true,
    })

    logger.info('Automations scheduled', { userId, trigger, count: channels.length })
  } catch (err) {
    logger.error('scheduleAutomationsForUser failed', { userId, trigger, err })
  }
}

/**
 * Processes due AutomationExecution rows. Called by cron every hour.
 * Returns counts of sent / failed / skipped.
 */
export async function processDueAutomations(limit = 100) {
  const due = await prisma.automationExecution.findMany({
    where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
    include: {
      rule: true,
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })

  if (!due.length) return { sent: 0, failed: 0, skipped: 0 }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  let sent = 0, failed = 0, skipped = 0

  for (const execution of due) {
    const { rule, user } = execution

    // Check opt-out
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

      // WhatsApp: use typed template functions
      if (execution.channel === 'WHATSAPP' && rule.waTemplateFn && user.phone) {
        result = await dispatchWaTemplate(rule.waTemplateFn, user.phone, user.name)
      } else {
        // SMS / EMAIL: use customBody (supports {{name}} interpolation)
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

async function dispatchWaTemplate(
  fn: string,
  phone: string,
  name: string
): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }> {
  switch (fn) {
    case 'sendWelcomePartner':
      return sendWelcomePartner(phone, name)
    case 'sendVerificationReminder':
      return sendVerificationReminder(phone, name)
    case 'sendReferralInvite':
      return sendReferralInvite(phone, name)
    default:
      return { ok: false, errorCode: 'UNKNOWN_TEMPLATE_FN', errorMessage: `No WA function: ${fn}` }
  }
}

/** Default rules to seed when none exist */
export const DEFAULT_AUTOMATION_RULES = [
  // ── PARTNERS ──────────────────────────────────────────
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
  // ── CLIENTES ──────────────────────────────────────────
  {
    name: 'Bienvenida Cliente (Email)',
    description: 'Email de bienvenida inmediato cuando un cliente se registra.',
    trigger: 'CLIENT_REGISTERED' as AutomationTrigger,
    targetRole: 'CLIENT' as const,
    delayHours: 0,
    channels: JSON.stringify(['EMAIL']),
    waTemplateFn: null,
    subject: '¡Bienvenido a LoHaggo, {{name}}!',
    customBody: `Hola {{name}},\n\nBienvenido a LoHaggo. Encuentra el profesional ideal para cualquier servicio del hogar en minutos.\n\n👉 Busca un servicio ahora: https://lohaggo.com/buscar\n\n¡Estamos para ayudarte!\nEquipo LoHaggo`,
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
    customBody: 'LoHaggo: Hola {{name}}, encuentra el profesional ideal para tu hogar en minutos: https://lohaggo.com/buscar',
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
]
