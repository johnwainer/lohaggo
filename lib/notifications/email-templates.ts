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
  PAYMENT_REPORTED_BY_CLIENT:    'LoHaggo: {{message}}\nConfirmar recepcion: {{action_url}}',
  PAYMENT_CONFIRMED_BY_PARTNER:  'LoHaggo: {{message}}\nVer reserva: {{action_url}}',
  PAYMENT_REJECTED_BY_PARTNER:   'LoHaggo: {{message}}\nReportar de nuevo: {{action_url}}',
  RATING_RECEIVED:               'LoHaggo: {{message}}\nVer calificacion: {{action_url}}',
  RATING_REMINDER:               'LoHaggo: No olvides calificar tu servicio reciente.\nCalificar: {{action_url}}',
  REQUEST_EXPIRING_SOON:         'LoHaggo: Tu solicitud {{service_name}} expira pronto y no tiene propuestas aceptadas.\nVer: {{action_url}}',
  BOOKING_REMINDER_24H:          'LoHaggo: Recordatorio - tu servicio {{service_name}} es manana {{booking_date}} {{booking_time}}.\nVer: {{action_url}}',
  BOOKING_STARTING_SOON:         'LoHaggo: Tu servicio {{service_name}} empieza en 1 hora.\nVer: {{action_url}}',
  PAYMENT_PENDING_REMINDER:      'LoHaggo: El cliente aun no reporta el pago de {{service_name}}.\nVer: {{action_url}}',
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

  PAYMENT_REPORTED_BY_CLIENT:
`💰 *LoHaggo* – Cliente reportó pago

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Cliente: {{client_name}}

Confirmar recepción:
{{action_url}}`,

  PAYMENT_CONFIRMED_BY_PARTNER:
`✅ *LoHaggo* – Pago confirmado

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}
👤 Profesional: {{partner_name}}

Ver reserva:
{{action_url}}`,

  PAYMENT_REJECTED_BY_PARTNER:
`⚠️ *LoHaggo* – Pago rechazado

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}

Reportar de nuevo:
{{action_url}}`,

  RATING_RECEIVED:
`⭐ *LoHaggo* – Nueva calificación

Hola {{user_name}},

{{message}}

🔧 Servicio: {{service_name}}

Ver:
{{action_url}}`,

  RATING_REMINDER:
`⭐ *LoHaggo* – Recordatorio: califica tu servicio

Hola {{user_name}},

Tu opinión ayuda a la comunidad. No olvides calificar el servicio de {{service_name}}.

Calificar:
{{action_url}}`,

  REQUEST_EXPIRING_SOON:
`⏰ *LoHaggo* – Tu solicitud expira pronto

Hola {{user_name}},

Tu solicitud de {{service_name}} expira en menos de 2 horas y aún no has aceptado ninguna propuesta.

Ver propuestas:
{{action_url}}`,

  BOOKING_REMINDER_24H:
`📅 *LoHaggo* – Recordatorio de servicio mañana

Hola {{user_name}},

Mañana tienes el servicio de {{service_name}} a las {{booking_time}}.

Ver detalles:
{{action_url}}`,

  BOOKING_STARTING_SOON:
`⏳ *LoHaggo* – Tu servicio empieza en 1 hora

Hola {{user_name}},

Tu servicio de {{service_name}} empieza a las {{booking_time}}.

Ver detalles:
{{action_url}}`,

  PAYMENT_PENDING_REMINDER:
`💰 *LoHaggo* – Pago pendiente de reporte

Hola {{user_name}},

El cliente aún no ha reportado el pago del servicio de {{service_name}}. Puedes recordarle por chat.

Ver reserva:
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

  PAYMENT_REPORTED_BY_CLIENT: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Cliente', '{{client_name}}'),
    'Confirmar recepción'),

  PAYMENT_CONFIRMED_BY_PARTNER: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Profesional', '{{partner_name}}'),
    'Ver reserva'),

  PAYMENT_REJECTED_BY_PARTNER: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}'),
    'Reportar de nuevo'),

  RATING_RECEIVED: emailHtml('{{message}}',
    ctxRow('Servicio', '{{service_name}}'),
    'Ver calificación'),

  RATING_REMINDER: emailHtml('Tu opinión ayuda a la comunidad. No olvides calificar el servicio.',
    ctxRow('Servicio', '{{service_name}}'),
    'Calificar servicio'),

  REQUEST_EXPIRING_SOON: emailHtml('Tu solicitud expira pronto y aún no has aceptado ninguna propuesta.',
    ctxRow('Servicio', '{{service_name}}'),
    'Ver propuestas'),

  BOOKING_REMINDER_24H: emailHtml('Recordatorio: mañana tienes un servicio agendado.',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Fecha', '{{booking_date}} {{booking_time}}'),
    'Ver reserva'),

  BOOKING_STARTING_SOON: emailHtml('Tu servicio empieza en una hora.',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Hora', '{{booking_time}}'),
    'Ver reserva'),

  PAYMENT_PENDING_REMINDER: emailHtml('El cliente aún no ha reportado el pago.',
    ctxRow('Servicio', '{{service_name}}') +
    ctxRow('Cliente', '{{client_name}}'),
    'Ver reserva'),
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
  { type: 'PAYMENT_REPORTED_BY_CLIENT',   name: 'Cliente reportó pago (socio)',         role: 'PARTNER' },
  { type: 'PAYMENT_CONFIRMED_BY_PARTNER', name: 'Socio confirmó pago (cliente)',        role: 'CLIENT' },
  { type: 'PAYMENT_REJECTED_BY_PARTNER',  name: 'Socio rechazó pago (cliente)',         role: 'CLIENT' },
  { type: 'RATING_RECEIVED',              name: 'Nueva calificación recibida',          role: null },
  { type: 'RATING_REMINDER',              name: 'Recordatorio: califica el servicio',   role: null },
  { type: 'REQUEST_EXPIRING_SOON',        name: 'Solicitud por expirar (cliente)',      role: 'CLIENT' },
  { type: 'BOOKING_REMINDER_24H',         name: 'Recordatorio 24h antes del servicio',  role: null },
  { type: 'BOOKING_STARTING_SOON',        name: 'Servicio empieza en 1h',               role: null },
  { type: 'PAYMENT_PENDING_REMINDER',     name: 'Pago pendiente de reporte (socio)',    role: 'PARTNER' },
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
export function resetTemplatesCache() { _templatesEnsured = false }

export async function ensureDefaultNotificationEmailTemplates() {
  if (_templatesEnsured) return
  const defaults = DEFAULT_NOTIFICATION_CHANNEL_TEMPLATES

  for (const tpl of defaults) {
    try {
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
    } catch (err) {
      // Log but continue — one bad template must not block the rest
      console.error(`[notifications] Failed to upsert template "${tpl.key}":`, err)
    }
  }

  // Only mark as done after the full loop so errors on cold start are retried
  _templatesEnsured = true
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
