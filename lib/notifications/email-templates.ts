import type { MessagingChannel, NotificationType, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { renderTextTemplate } from '@/lib/messaging/template'
import { buildEmailHtml } from '@/lib/email-layout'

export type NotificationChannelTemplatePayload = {
  key: string
  name: string
  notificationType: NotificationType
  channel: MessagingChannel
  role: UserRole | null
  subjectTemplate: string | null
  bodyTemplate: string
  bodyHtmlTemplate: string | null
  bodyTextTemplate: string | null
  isActive: boolean
}

const BASE_EMAIL_LAYOUT = ({ title, message, ctaLabel }: { title: string; message: string; ctaLabel: string }) =>
  buildEmailHtml({
    title,
    preheader: message.replace(/<[^>]*>/g, '').slice(0, 120),
    body: `<p style="margin:0 0 6px;color:#334155;font-size:14px;">Hola {{user_name}},</p>
<p style="margin:0 0 0;color:#334155;font-size:15px;line-height:1.65;">${message}</p>`,
    ctaLabel,
    ctaUrl: '{{notifications_url}}',
    footerNote: 'Si no reconoces esta actividad, <a href="https://www.lohaggo.com" style="color:#0a66c2;">revisa tu cuenta en LoHaggo</a>.',
  })

const NOTIFICATION_CATALOG: Array<{ type: NotificationType; name: string; role: UserRole | null; cta: string }> = [
  { type: 'BOOKING_CONFIRMED', name: 'Reserva confirmada', role: null, cta: 'Ver mis notificaciones' },
  { type: 'BOOKING_CANCELLED', name: 'Reserva cancelada', role: null, cta: 'Revisar reserva' },
  { type: 'BOOKING_IN_PROGRESS', name: 'Servicio en progreso', role: null, cta: 'Ver estado del servicio' },
  { type: 'BOOKING_COMPLETED', name: 'Servicio completado', role: null, cta: 'Calificar servicio' },
  { type: 'NEW_PROPOSAL', name: 'Nueva propuesta (cliente)', role: 'CLIENT', cta: 'Ver propuestas' },
  { type: 'NEW_SERVICE_REQUEST', name: 'Nueva solicitud (socio)', role: 'PARTNER', cta: 'Responder solicitud' },
  { type: 'PROPOSAL_ACCEPTED', name: 'Propuesta aceptada', role: 'PARTNER', cta: 'Ver reserva' },
  { type: 'PROPOSAL_REJECTED', name: 'Propuesta rechazada', role: 'PARTNER', cta: 'Ver actividad' },
  { type: 'NEW_MESSAGE', name: 'Nuevo mensaje de chat', role: null, cta: 'Abrir conversación' },
  { type: 'DOCUMENT_APPROVED', name: 'Documento aprobado', role: 'PARTNER', cta: 'Ver verificación' },
  { type: 'DOCUMENT_REJECTED', name: 'Documento rechazado', role: 'PARTNER', cta: 'Corregir documento' },
]

const CHANNELS: MessagingChannel[] = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

function buildDefaults(): NotificationChannelTemplatePayload[] {
  const defaults: NotificationChannelTemplatePayload[] = []

  for (const item of NOTIFICATION_CATALOG) {
    for (const channel of CHANNELS) {
      const suffix = channel.toLowerCase()
      const key = `auto.${item.type.toLowerCase()}.${suffix}${item.role ? `.${item.role.toLowerCase()}` : ''}`
      const channelLabel = channel === 'EMAIL' ? 'Email' : channel === 'WHATSAPP' ? 'WhatsApp' : channel

      const commonBody = '{{title}}\n\n{{message}}\n\nVer detalles: {{notifications_url}}'
      const emailHtml = BASE_EMAIL_LAYOUT({ title: '{{title}}', message: '{{message}}', ctaLabel: item.cta })

      defaults.push({
        key,
        name: `${item.name} · ${channelLabel}`,
        notificationType: item.type,
        channel,
        role: item.role,
        subjectTemplate: channel === 'EMAIL' || channel === 'PUSH' ? '{{title}}' : null,
        bodyTemplate: commonBody,
        bodyHtmlTemplate: channel === 'EMAIL' ? emailHtml : null,
        bodyTextTemplate: commonBody,
        isActive: true,
      })
    }
  }

  return defaults
}

export const DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES = buildDefaults()

export async function ensureDefaultNotificationEmailTemplates() {
  const existing = (await (prisma as any).notificationEmailTemplate.findMany({
    select: { key: true },
  })) as Array<{ key: string }>

  const existingKeys = new Set(existing.map((item) => item.key))
  const missing = DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES.filter((item) => !existingKeys.has(item.key))

  if (missing.length > 0) {
    await (prisma as any).notificationEmailTemplate.createMany({
      data: missing,
      skipDuplicates: true,
    })
  }
}

export async function resolveNotificationChannelTemplate(
  notificationType: NotificationType,
  role: UserRole,
  channel: MessagingChannel
) {
  await ensureDefaultNotificationEmailTemplates()

  const templates = (await (prisma as any).notificationEmailTemplate.findMany({
    where: {
      notificationType,
      channel,
      isActive: true,
      OR: [{ role }, { role: null }],
    },
    orderBy: [{ role: 'desc' }, { updatedAt: 'desc' }],
    take: 5,
  })) as Array<{
    id: string
    key: string
    role: UserRole | null
    subjectTemplate: string | null
    bodyTemplate: string
    bodyHtmlTemplate: string | null
    bodyTextTemplate: string | null
  }>

  return templates.find((item) => item.role === role) || templates.find((item) => item.role === null) || null
}

export function renderNotificationChannelTemplate(params: {
  subjectTemplate?: string | null
  bodyTemplate: string
  bodyHtmlTemplate?: string | null
  bodyTextTemplate?: string | null
  vars: Record<string, string | number | null | undefined>
}) {
  return {
    subject: params.subjectTemplate ? renderTextTemplate(params.subjectTemplate, params.vars) : null,
    body: renderTextTemplate(params.bodyTemplate, params.vars),
    bodyHtml: params.bodyHtmlTemplate ? renderTextTemplate(params.bodyHtmlTemplate, params.vars) : null,
    bodyText: params.bodyTextTemplate ? renderTextTemplate(params.bodyTextTemplate, params.vars) : null,
  }
}
