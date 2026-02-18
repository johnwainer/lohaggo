import type { MessagingChannel, NotificationType, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { renderTextTemplate } from '@/lib/messaging/template'

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

const BASE_EMAIL_LAYOUT = ({ title, message, ctaLabel }: { title: string; message: string; ctaLabel: string }) => `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f7fb;padding:24px 0;font-family:Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe7f3;">
        <tr>
          <td style="background:linear-gradient(90deg,#0a66c2,#00bfa6);padding:22px 26px;color:#fff;">
            <h1 style="margin:0;font-size:20px;line-height:1.2;">LoHaggo</h1>
            <p style="margin:8px 0 0;font-size:13px;opacity:.95;">Notificación automática</p>
          </td>
        </tr>
        <tr>
          <td style="padding:26px;">
            <p style="margin:0 0 12px;color:#334155;font-size:14px;">Hola {{user_name}},</p>
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:22px;line-height:1.25;">${title}</h2>
            <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.55;">${message}</p>
            <a href="{{notifications_url}}" style="display:inline-block;background:#0a66c2;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:700;">${ctaLabel}</a>
            <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
              Si no reconoces esta actividad, revisa tu cuenta en LoHaggo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 26px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
            © {{year}} LoHaggo · Medellín, Colombia
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`

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
