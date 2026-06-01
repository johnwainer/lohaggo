import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'
import type { NotificationType as PrismaNotificationType, UserRole } from '@prisma/client'
import { sendPushToUser, type PushPayload } from '@/lib/notifications/push-sender'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { getNotificationAutomationSnapshot, isNotificationChannelEnabled } from '@/lib/notifications/automation-config'
import { renderNotificationChannelTemplate, resolveNotificationChannelTemplate } from '@/lib/notifications/email-templates'
import { mapUserChannelPreference } from '@/lib/notifications/user-preferences'
import { env } from '@/lib/env'
import { emitUserNotificationBroadcast } from '@/lib/supabase-admin'

const logger = createLogger('notification-service')

export type NotificationType = PrismaNotificationType

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: any
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null
      }
    })

    void emitUserNotificationBroadcast(userId)

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        name: true,
        notificationsPushEnabled: true,
        notificationsEmailEnabled: true,
        notificationsWhatsappEnabled: true,
        notificationsSmsEnabled: true,
      },
    })

    // Dispatch is fire-and-forget — never let it block saving the notification
    if (user) {
      dispatchAutomaticNotificationChannels({
        notificationId: notification.id,
        user,
        type,
        title,
        message,
        data,
      }).catch((err) => logger.error('Dispatch error (non-fatal):', err))
    }

    return notification
  } catch (error) {
    logger.error("Error creating notification:", error)
    throw error
  }
}

export async function sendDirectPushToUser(userId: string, payload: PushPayload) {
  return sendPushToUser(userId, payload)
}

function computeActionUrl(type: NotificationType, role: UserRole, appUrl: string): string {
  switch (type) {
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_CANCELLED':
    case 'BOOKING_IN_PROGRESS':
    case 'BOOKING_COMPLETED':
      return role === 'PARTNER' ? `${appUrl}/partner?tab=bookings` : `${appUrl}/dashboard?tab=bookings`
    case 'NEW_SERVICE_REQUEST':
      return `${appUrl}/partner?tab=my-requests`
    case 'NEW_PROPOSAL':
      return `${appUrl}/dashboard?tab=requests`
    case 'PROPOSAL_ACCEPTED':
      return `${appUrl}/partner?tab=bookings`
    case 'PROPOSAL_REJECTED':
      return `${appUrl}/partner?tab=my-requests`
    case 'NEW_MESSAGE':
      return role === 'PARTNER' ? `${appUrl}/partner/messages` : `${appUrl}/dashboard`
    case 'DOCUMENT_APPROVED':
    case 'DOCUMENT_REJECTED':
      return `${appUrl}/partner/verification`
    case 'ACHIEVEMENT_UNLOCKED':
      return `${appUrl}/partner/achievements`
    case 'PAYMENT_REPORTED_BY_CLIENT':
    case 'PAYMENT_PENDING_REMINDER':
      return role === 'PARTNER' ? `${appUrl}/partner?tab=bookings` : `${appUrl}/dashboard?tab=bookings`
    case 'PAYMENT_CONFIRMED_BY_PARTNER':
    case 'PAYMENT_REJECTED_BY_PARTNER':
      return `${appUrl}/dashboard?tab=bookings`
    case 'RATING_RECEIVED':
      return role === 'PARTNER' ? `${appUrl}/partner?tab=bookings` : `${appUrl}/my-ratings`
    case 'RATING_REMINDER':
      return role === 'PARTNER' ? `${appUrl}/partner?tab=bookings` : `${appUrl}/dashboard?tab=bookings`
    case 'REQUEST_EXPIRING_SOON':
      return `${appUrl}/dashboard?tab=requests`
    case 'BOOKING_REMINDER_24H':
    case 'BOOKING_STARTING_SOON':
      return role === 'PARTNER' ? `${appUrl}/partner?tab=bookings` : `${appUrl}/dashboard?tab=bookings`
    default:
      return `${appUrl}/notifications`
  }
}

async function buildEnrichedVars(
  data: unknown,
  type: NotificationType,
  role: UserRole,
  appUrl: string
): Promise<Record<string, string | number>> {
  const vars: Record<string, string | number> = {
    action_url: computeActionUrl(type, role, appUrl),
    service_name: '',
    partner_name: '',
    client_name: '',
    city: '',
    price: '',
    booking_date: '',
    booking_time: '',
  }

  const d = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {}

  try {
    if (typeof d.bookingId === 'string') {
      const booking = await prisma.booking.findUnique({
        where: { id: d.bookingId },
        select: {
          service: { select: { name: true } },
          user: { select: { name: true } },
          partner: { select: { user: { select: { name: true } } } },
          scheduledDate: true,
          scheduledTime: true,
          totalPrice: true,
        },
      })
      if (booking) {
        vars.service_name = booking.service.name
        vars.client_name = booking.user.name
        vars.partner_name = booking.partner?.user.name ?? ''
        vars.booking_date = booking.scheduledDate
          ? new Date(booking.scheduledDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
          : ''
        vars.booking_time = booking.scheduledTime ?? ''
        vars.price = booking.totalPrice ? `$${Math.round(booking.totalPrice).toLocaleString('es-CO')}` : ''
      }
    }

    if (typeof d.serviceRequestId === 'string') {
      const sr = await prisma.serviceRequest.findUnique({
        where: { id: d.serviceRequestId },
        select: {
          service: { select: { name: true } },
          user: { select: { name: true } },
          city: true,
          notes: true,
        },
      })
      if (sr) {
        if (!vars.service_name) vars.service_name = sr.service.name
        if (!vars.client_name) vars.client_name = sr.user.name
        vars.city = String(sr.city ?? '').replace(/_/g, ' ').toLowerCase()
        vars.description = sr.notes ? sr.notes.slice(0, 120) : ''
      }
    }

    if (typeof d.proposalId === 'string') {
      const proposal = await prisma.proposal.findUnique({
        where: { id: d.proposalId },
        select: {
          price: true,
          partner: { select: { user: { select: { name: true } } } },
          serviceRequest: { select: { service: { select: { name: true } } } },
        },
      })
      if (proposal) {
        if (!vars.partner_name) vars.partner_name = proposal.partner.user.name
        if (!vars.service_name) vars.service_name = proposal.serviceRequest.service.name
        if (proposal.price) vars.price = `$${Math.round(Number(proposal.price)).toLocaleString('es-CO')}`
      }
    }

    if (typeof d.chatId === 'string') {
      const chat = await prisma.chat.findUnique({
        where: { id: d.chatId },
        select: {
          client: { select: { name: true } },
          partner: { select: { user: { select: { name: true } } } },
          serviceRequest: { select: { service: { select: { name: true } } } },
        },
      })
      if (chat) {
        if (!vars.client_name) vars.client_name = chat.client?.name ?? ''
        if (!vars.partner_name) vars.partner_name = chat.partner?.user.name ?? ''
        if (!vars.service_name) vars.service_name = chat.serviceRequest?.service?.name ?? ''
      }
    }
  } catch {
    // enrichment is best-effort
  }

  // sender_name = the other party (whoever sent the message to this recipient)
  vars.sender_name = role === 'CLIENT'
    ? (vars.partner_name || '')
    : (vars.client_name || '')

  return vars
}

async function dispatchAutomaticNotificationChannels(params: {
  notificationId: string
  user: {
    id: string
    role: UserRole
    email: string
    phone: string | null
    name: string
    notificationsPushEnabled?: boolean | null
    notificationsEmailEnabled?: boolean | null
    notificationsWhatsappEnabled?: boolean | null
    notificationsSmsEnabled?: boolean | null
  }
  type: NotificationType
  title: string
  message: string
  data?: unknown
}) {
  const [runtimeConfig, snapshot] = await Promise.all([
    getMessagingProviderRuntimeConfig(),
    getNotificationAutomationSnapshot(),
  ])

  const channels: Array<'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS'> = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

  for (const channel of channels) {
    if (!isNotificationChannelEnabled({ snapshot, role: params.user.role, channel })) {
      continue
    }

    if (!mapUserChannelPreference(params.user, channel)) {
      await (prisma as any).notificationDispatchLog.create({
        data: {
          notificationId: params.notificationId,
          userId: params.user.id,
          userRole: params.user.role,
          notificationType: params.type,
          channel,
          destination: null,
          status: 'SKIPPED',
          provider: 'internal',
          errorCode: 'USER_PREF_DISABLED',
          errorMessage: 'User disabled this channel in profile preferences',
          metadata: params.data ? JSON.stringify(params.data) : null,
        },
      })
      continue
    }

    const destination = channel === 'PUSH' ? `user:${params.user.id}` : channel === 'EMAIL' ? params.user.email : params.user.phone
    if (!destination) {
      await (prisma as any).notificationDispatchLog.create({
        data: {
          notificationId: params.notificationId,
          userId: params.user.id,
          userRole: params.user.role,
          notificationType: params.type,
          channel,
          destination: null,
          status: 'SKIPPED',
          provider: 'internal',
          errorCode: 'MISSING_DESTINATION',
          errorMessage: 'User does not have destination configured for this channel',
          metadata: params.data ? JSON.stringify(params.data) : null,
        },
      })
      continue
    }

    const optedOut = await prisma.messagingOptOut.findFirst({
      where: {
        channel,
        isActive: true,
        OR: [{ userId: params.user.id }, { destination }],
      },
      select: { id: true },
    })

    if (optedOut) {
      await (prisma as any).notificationDispatchLog.create({
        data: {
          notificationId: params.notificationId,
          userId: params.user.id,
          userRole: params.user.role,
          notificationType: params.type,
          channel,
          destination,
          status: 'UNSUBSCRIBED',
          provider: 'internal',
          errorCode: 'OPTOUT',
          errorMessage: 'Recipient opted out',
          metadata: params.data ? JSON.stringify(params.data) : null,
        },
      })
      continue
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || ''
    const enriched = await buildEnrichedVars(params.data, params.type, params.user.role, appUrl)

    const baseVars = {
      user_name: params.user.name || 'Usuario',
      user_email: params.user.email,
      title: params.title,
      message: params.message,
      notification_type: params.type,
      notifications_url: `${appUrl}/notifications`,
      app_url: appUrl,
      year: new Date().getFullYear(),
      ...enriched,
    }

    let subject = params.title
    let body = params.message
    let templateKey: string | null = null

    const template = await resolveNotificationChannelTemplate(params.type, params.user.role, channel)
    if (template) {
      const rendered = renderNotificationChannelTemplate({
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        bodyHtmlTemplate: template.bodyHtmlTemplate,
        bodyTextTemplate: template.bodyTextTemplate,
        vars: baseVars,
      })
      subject = rendered.subject || subject
      body = channel === 'EMAIL' ? rendered.bodyHtml || rendered.body : rendered.body
      templateKey = template.key
    } else if (channel === 'EMAIL') {
      body = `${params.message}<br/><br/><a href=\"${baseVars.notifications_url}\">Ver notificaciones</a>`
    }

    const result = await sendMessageViaProvider(
      {
        channel,
        userId: params.user.id,
        to: destination,
        subject,
        body,
        data: {
          type: params.type,
          notificationId: params.notificationId,
          targetUrl: '/notifications',
          ...(templateKey ? { templateKey } : {}),
          ...(typeof params.data === 'object' && params.data ? (params.data as Record<string, unknown>) : {}),
        },
      },
      runtimeConfig
    )

    await (prisma as any).notificationDispatchLog.create({
      data: {
        notificationId: params.notificationId,
        userId: params.user.id,
        userRole: params.user.role,
        notificationType: params.type,
        channel,
        destination,
        status: result.ok ? 'SENT' : 'FAILED',
        provider: result.provider,
        providerMessageId: result.providerMessageId || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        metadata: JSON.stringify({
          ...(typeof params.data === 'object' && params.data ? (params.data as Record<string, unknown>) : {}),
          ...(templateKey ? { templateKey } : {}),
        }),
        sentAt: result.ok ? new Date() : null,
      },
    })
  }
}

export async function notifyNewServiceRequest(serviceRequestId: string) {
  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        service: {
          include: {
            partners: {
              where: { active: true },
              include: {
                partner: {
                  include: {
                    user: { select: { id: true, name: true, phone: true } },
                    documents: { where: { status: 'APPROVED' } }
                  }
                }
              }
            }
          }
        },
        user: { select: { id: true, name: true, phone: true } },
        partner: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            documents: { where: { status: 'APPROVED' } }
          }
        }
      }
    })

    if (!serviceRequest) return

    const { sendNuevaSolicitudSocio, sendSolicitudEnviadaCliente } = await import('@/lib/messaging/whatsapp-templates')
    const serviceName = serviceRequest.service.name

    // Format the "when" string for the partner notification
    let when = 'A definir'
    if (serviceRequest.isUrgent) {
      when = 'Urgente'
    } else if (serviceRequest.preferredDate) {
      const d = new Date(serviceRequest.preferredDate)
      when = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
      if (serviceRequest.preferredTime) when += ` a las ${serviceRequest.preferredTime}`
    }

    const notifyPartner = async (partner: { user: { id: string; name: string; phone: string | null } }, isDirect: boolean) => {
      await createNotification({
        userId: partner.user.id,
        type: "NEW_SERVICE_REQUEST",
        title: isDirect ? "Nueva solicitud directa" : "Nueva solicitud de servicio",
        message: isDirect
          ? `${serviceRequest.user.name} te ha solicitado ${serviceName}`
          : `${serviceRequest.user.name} solicita ${serviceName}`,
        data: { serviceRequestId: serviceRequest.id, serviceId: serviceRequest.serviceId, isDirect }
      })
      if (partner.user.phone) {
        sendNuevaSolicitudSocio(partner.user.phone, partner.user.name ?? 'Socio', serviceName, when)
          .catch(err => logger.error('WA nueva_solicitud_socio failed', { err }))
      }
    }

    const isVerified = (docs: { type: string }[]) =>
      docs.some(d => ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE'].includes(d.type)) &&
      docs.some(d => d.type === 'ANTECEDENTES')

    if (serviceRequest.partnerId && serviceRequest.partner) {
      if (isVerified(serviceRequest.partner.documents)) {
        await notifyPartner(serviceRequest.partner, true)
      }
    } else {
      const partners = serviceRequest.service.partners.filter(
        ps => ps.partner.city === serviceRequest.city
      )
      for (const { partner } of partners) {
        if (isVerified(partner.documents)) {
          await notifyPartner(partner, false)
        }
      }
    }

    // Notify the client that their request has been submitted
    if (serviceRequest.user.phone) {
      sendSolicitudEnviadaCliente(serviceRequest.user.phone, serviceRequest.user.name ?? 'Cliente', serviceName)
        .catch(err => logger.error('WA solicitud_enviada_cliente failed', { err }))
    }
  } catch (error) {
    console.error("Error notifying new service request:", error)
  }
}

export async function notifyNewProposal(proposalId: string) {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        serviceRequest: {
          include: {
            service: true,
            user: true
          }
        },
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!proposal) return

    await createNotification({
      userId: proposal.serviceRequest.userId,
      type: "NEW_PROPOSAL",
      title: "Nueva propuesta recibida",
      message: `${proposal.partner.user.name} te envió una propuesta para ${proposal.serviceRequest.service.name}`,
      data: {
        proposalId: proposal.id,
        serviceRequestId: proposal.serviceRequestId,
        price: proposal.price
      }
    })
  } catch (error) {
    console.error("Error notifying new proposal:", error)
  }
}

export async function notifyProposalAccepted(proposalId: string) {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        serviceRequest: {
          include: {
            service: true
          }
        },
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!proposal) return

    await createNotification({
      userId: proposal.partner.userId,
      type: "PROPOSAL_ACCEPTED",
      title: "¡Propuesta aceptada!",
      message: `Tu propuesta para ${proposal.serviceRequest.service.name} fue aceptada`,
      data: {
        proposalId: proposal.id,
        serviceRequestId: proposal.serviceRequestId
      }
    })
  } catch (error) {
    console.error("Error notifying proposal accepted:", error)
  }
}

export async function notifyProposalRejected(proposalId: string) {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        serviceRequest: {
          include: {
            service: true
          }
        },
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!proposal) return

    await createNotification({
      userId: proposal.partner.userId,
      type: "PROPOSAL_REJECTED",
      title: "Propuesta rechazada",
      message: `Tu propuesta para ${proposal.serviceRequest.service.name} fue rechazada`,
      data: {
        proposalId: proposal.id,
        serviceRequestId: proposal.serviceRequestId
      }
    })
  } catch (error) {
    console.error("Error notifying proposal rejected:", error)
  }
}

export async function notifyBookingStatusChange(bookingId: string, status: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        user: true,
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!booking) return

    const clientMessages: Record<string, { title: string; message: string; type: NotificationType }> = {
      CONFIRMED: {
        title: "Reserva confirmada",
        message: `Tu reserva de ${booking.service.name} ha sido confirmada por ${booking.partner?.user.name || 'el socio'}`,
        type: "BOOKING_CONFIRMED"
      },
      CANCELLED: {
        title: "Reserva cancelada",
        message: `Tu reserva de ${booking.service.name} ha sido cancelada`,
        type: "BOOKING_CANCELLED"
      },
      IN_PROGRESS: {
        title: "Servicio en progreso",
        message: `El servicio de ${booking.service.name} está en progreso`,
        type: "BOOKING_IN_PROGRESS"
      },
      COMPLETED: {
        title: "Servicio completado",
        message: `El servicio de ${booking.service.name} ha sido completado`,
        type: "BOOKING_COMPLETED"
      }
    }

    const partnerMessages: Record<string, { title: string; message: string; type: NotificationType }> = {
      CONFIRMED: {
        title: "Reserva confirmada",
        message: `Has confirmado la reserva de ${booking.service.name} con ${booking.user.name}`,
        type: "BOOKING_CONFIRMED"
      },
      CANCELLED: {
        title: "Reserva cancelada",
        message: `La reserva de ${booking.service.name} con ${booking.user.name} ha sido cancelada`,
        type: "BOOKING_CANCELLED"
      },
      IN_PROGRESS: {
        title: "Servicio iniciado",
        message: `Has iniciado el servicio de ${booking.service.name} con ${booking.user.name}`,
        type: "BOOKING_IN_PROGRESS"
      },
      COMPLETED: {
        title: "Servicio completado",
        message: `Has completado el servicio de ${booking.service.name} con ${booking.user.name}`,
        type: "BOOKING_COMPLETED"
      }
    }

    const clientStatusInfo = clientMessages[status]
    if (clientStatusInfo) {
      await createNotification({
        userId: booking.userId,
        type: clientStatusInfo.type,
        title: clientStatusInfo.title,
        message: clientStatusInfo.message,
        data: {
          bookingId: booking.id,
          serviceId: booking.serviceId
        }
      })
    }

    if (booking.partner) {
      const partnerStatusInfo = partnerMessages[status]
      if (partnerStatusInfo) {
        await createNotification({
          userId: booking.partner.userId,
          type: partnerStatusInfo.type,
          title: partnerStatusInfo.title,
          message: partnerStatusInfo.message,
          data: {
            bookingId: booking.id,
            serviceId: booking.serviceId
          }
        })
      }
    }
  } catch (error) {
    console.error("Error notifying booking status change:", error)
  }
}
