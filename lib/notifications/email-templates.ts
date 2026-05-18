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

// ─── Email HTML builder ──────────────────────────────────────────────────────

function emailHtml(message: string, contextRows: string, ctaLabel: string) {
  const contextBlock = contextRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px;">
         ${contextRows}
       </table>`
    : ''

  return buildEmailHtml({
    title: '{{title}}',
    preheader: '{{message}}',
    body: `<p style="margin:0 0 8px;color:#334155;font-size:14px;">Hola <strong>{{user_name}}</strong>,</p>
<p style="margin:0 0 0;color:#334155;font-size:15px;line-height:1.65;">${message}</p>
${contextBlock}`,
    ctaLabel,
    ctaUrl: '{{action_url}}',
    footerNote: 'Si no reconoces esta actividad, <a href="https://www.lohaggo.com" style="color:#0a66c2;">revisa tu cuenta en LoHaggo</a>.',
  })
}

function ctxRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;color:#64748b;font-size:13px;white-space:nowrap;padding-right:12px;">${label}</td>
    <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">${value}</td>
  </tr>`
}

// ─── Per-type template bodies ────────────────────────────────────────────────

const SMS_BODY: Record<NotificationType, string> = {
  BOOKING_CONFIRMED:   'LoHaggo: {{message}}\nFecha: {{booking_date}} {{booking_time}}\nVer: {{action_url}}',
  BOOKING_CANCELLED:   'LoHaggo: {{message}}\nVer: {{action_url}}',
  BOOKING_IN_PROGRESS: 'LoHaggo: {{message}}\nVer estado: {{action_url}}',
  BOOKING_COMPLETED:   'LoHaggo: {{message}}\nCalifica aqui: {{action_url}}',
  NEW_PROPOSAL:        'LoHaggo: {{message}}\nPrecio: {{price}}\nVer propuesta: {{action_url}}',
  NEW_SERVICE_REQUEST: 'LoHaggo: {{message}}\nVer solicitud: {{action_url}}',
  PROPOSAL_ACCEPTED:   'LoHaggo: {{message}}\nVer reserva: {{action_url}}',
  PROPOSAL_REJECTED:   'LoHaggo: {{message}}\nVer actividad: {{action_url}}',
  NEW_MESSAGE:         'LoHaggo: {{message}}\nResponder: {{action_url}}',
  DOCUMENT_APPROVED:      'LoHaggo: {{message}}\nVer perfil: {{action_url}}',
  DOCUMENT_REJECTED:      'LoHaggo: {{message}}\nCorregir documento: {{action_url}}',
  ACHIEVEMENT_UNLOCKED:   'LoHaggo: {{message}}\nVer logros: {{action_url}}',
}

const WA_BODY: Record<NotificationType, string> = {
  BOOKING_CONFIRMED:
`🏠 *LoHaggo* – Reserva confirmada ✅

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
📅 Fecha: {{booking_date}} {{booking_time}}
👤 Profesional: {{partner_name}}

Ver detalles:
{{action_url}}`,

  BOOKING_CANCELLED:
`🏠 *LoHaggo* – Reserva cancelada ❌

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}

Ver detalles:
{{action_url}}`,

  BOOKING_IN_PROGRESS:
`🏠 *LoHaggo* – Servicio en progreso 🔨

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Profesional: {{partner_name}}

Ver estado:
{{action_url}}`,

  BOOKING_COMPLETED:
`🏠 *LoHaggo* – Servicio completado ⭐

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Profesional: {{partner_name}}

Califica el servicio:
{{action_url}}`,

  NEW_PROPOSAL:
`🏠 *LoHaggo* – Nueva propuesta 💡

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Profesional: {{partner_name}}
💵 Precio: {{price}}

Ver propuesta:
{{action_url}}`,

  NEW_SERVICE_REQUEST:
`🏠 *LoHaggo* – Nueva solicitud 📋

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Cliente: {{client_name}}
📍 Ciudad: {{city}}

Responder solicitud:
{{action_url}}`,

  PROPOSAL_ACCEPTED:
`🏠 *LoHaggo* – ¡Propuesta aceptada! ✅

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Cliente: {{client_name}}

Ver reserva:
{{action_url}}`,

  PROPOSAL_REJECTED:
`🏠 *LoHaggo* – Propuesta rechazada

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}

Ver actividad:
{{action_url}}`,

  NEW_MESSAGE:
`🏠 *LoHaggo* – Nuevo mensaje 💬

Hola {{user_name}},

{{sender_name}} te ha escrito sobre *{{service_name}}*.

Responder:
{{action_url}}`,

  DOCUMENT_APPROVED:
`🏠 *LoHaggo* – Documento aprobado ✅

Hola {{user_name}},

{{message}}

Ver tu perfil verificado:
{{action_url}}`,

  DOCUMENT_REJECTED:
`🏠 *LoHaggo* – Documento rechazado ⚠️

Hola {{user_name}},

{{message}}

Corregir documento:
{{action_url}}`,

  ACHIEVEMENT_UNLOCKED:
`🏠 *LoHaggo* – ¡Logro desbloqueado! 🏆

Hola {{user_name}},

{{message}}

Ver tus logros:
{{action_url}}`,
}

const EMAIL_HTML: Record<NotificationType, string> = {
  BOOKING_CONFIRMED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}') +
    ctxRow('Fecha', '{{booking_date}} {{booking_time}}') +
    ctxRow('Precio', '{{price}}'),
    'Ver reserva'),

  BOOKING_CANCELLED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}'),
    'Ver detalles'),

  BOOKING_IN_PROGRESS: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}') +
    ctxRow('Fecha', '{{booking_date}} {{booking_time}}'),
    'Ver estado'),

  BOOKING_COMPLETED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}'),
    'Calificar servicio'),

  NEW_PROPOSAL: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}') +
    ctxRow('Precio propuesto', '{{price}}'),
    'Ver propuesta'),

  NEW_SERVICE_REQUEST: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Cliente', '{{client_name}}') +
    ctxRow('Ciudad', '{{city}}') +
    ctxRow('Descripción', '{{description}}'),
    'Responder solicitud'),

  PROPOSAL_ACCEPTED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Cliente', '{{client_name}}'),
    'Ver reserva'),

  PROPOSAL_REJECTED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}'),
    'Ver actividad'),

  NEW_MESSAGE: emailHtml('{{sender_name}} te ha enviado un mensaje.',
    ctxRow('De', '{{sender_name}}') +
    ctxRow('Servicio', '{{service_name}}'),
    'Abrir conversación'),

  DOCUMENT_APPROVED: emailHtml('{{message}}', '', 'Ver verificación'),

  DOCUMENT_REJECTED: emailHtml('{{message}}', '', 'Corregir documento'),

  ACHIEVEMENT_UNLOCKED: emailHtml('{{message}}', '', 'Ver logros'),
}

// ─── Catalog & defaults ──────────────────────────────────────────────────────

const NOTIFICATION_CATALOG: Array<{
  type: NotificationType
  name: string
  role: UserRole | null
}> = [
  { type: 'BOOKING_CONFIRMED',   name: 'Reserva confirmada',          role: null },
  { type: 'BOOKING_CANCELLED',   name: 'Reserva cancelada',           role: null },
  { type: 'BOOKING_IN_PROGRESS', name: 'Servicio en progreso',        role: null },
  { type: 'BOOKING_COMPLETED',   name: 'Servicio completado',         role: null },
  { type: 'NEW_PROPOSAL',        name: 'Nueva propuesta (cliente)',    role: 'CLIENT' },
  { type: 'NEW_SERVICE_REQUEST', name: 'Nueva solicitud (socio)',      role: 'PARTNER' },
  { type: 'PROPOSAL_ACCEPTED',   name: 'Propuesta aceptada (socio)',   role: 'PARTNER' },
  { type: 'PROPOSAL_REJECTED',   name: 'Propuesta rechazada (socio)',  role: 'PARTNER' },
  { type: 'NEW_MESSAGE',         name: 'Nuevo mensaje de chat',        role: null },
  { type: 'DOCUMENT_APPROVED',    name: 'Documento aprobado',          role: 'PARTNER' },
  { type: 'DOCUMENT_REJECTED',    name: 'Documento rechazado',         role: 'PARTNER' },
  { type: 'ACHIEVEMENT_UNLOCKED', name: 'Logro desbloqueado',          role: 'PARTNER' },
]

const CHANNELS: MessagingChannel[] = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

function buildDefaults(): NotificationChannelTemplatePayload[] {
  const defaults: NotificationChannelTemplatePayload[] = []

  for (const item of NOTIFICATION_CATALOG) {
    for (const channel of CHANNELS) {
      const suffix = channel.toLowerCase()
      const key = `auto.${item.type.toLowerCase()}.${suffix}${item.role ? `.${item.role.toLowerCase()}` : ''}`
      const channelLabel = channel === 'EMAIL' ? 'Email' : channel === 'WHATSAPP' ? 'WhatsApp' : channel

      let bodyTemplate: string
      let bodyHtmlTemplate: string | null = null

      if (channel === 'SMS') {
        bodyTemplate = SMS_BODY[item.type]
      } else if (channel === 'WHATSAPP') {
        bodyTemplate = WA_BODY[item.type]
      } else {
        // PUSH and EMAIL share the text body
        bodyTemplate = '{{title}}\n\n{{message}}\n\nVer: {{action_url}}'
        if (channel === 'EMAIL') {
          bodyHtmlTemplate = EMAIL_HTML[item.type]
        }
      }

      defaults.push({
        key,
        name: `${item.name} · ${channelLabel}`,
        notificationType: item.type,
        channel,
        role: item.role,
        subjectTemplate: channel === 'EMAIL' || channel === 'PUSH' ? '{{title}}' : null,
        bodyTemplate,
        bodyHtmlTemplate,
        bodyTextTemplate: bodyTemplate,
        isActive: true,
      })
    }
  }

  return defaults
}

export const DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES = buildDefaults()

let _templatesEnsured = false

export async function ensureDefaultNotificationEmailTemplates() {
  if (_templatesEnsured) return
  _templatesEnsured = true
  const defaults = DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES

  for (const tpl of defaults) {
    await (prisma as any).notificationEmailTemplate.upsert({
      where: { key: tpl.key },
      update: {
        bodyTemplate: tpl.bodyTemplate,
        bodyHtmlTemplate: tpl.bodyHtmlTemplate,
        bodyTextTemplate: tpl.bodyTextTemplate,
        subjectTemplate: tpl.subjectTemplate,
        isActive: tpl.isActive,
      },
      create: {
        key: tpl.key,
        name: tpl.name,
        notificationType: tpl.notificationType,
        channel: tpl.channel,
        role: tpl.role,
        subjectTemplate: tpl.subjectTemplate,
        bodyTemplate: tpl.bodyTemplate,
        bodyHtmlTemplate: tpl.bodyHtmlTemplate,
        bodyTextTemplate: tpl.bodyTextTemplate,
        isActive: tpl.isActive,
      },
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
