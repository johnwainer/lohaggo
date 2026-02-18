import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'
import type { NotificationType as PrismaNotificationType, UserRole } from '@prisma/client'
import { sendPushToUser, type PushPayload } from '@/lib/notifications/push-sender'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { getNotificationAutomationSnapshot, isNotificationChannelEnabled } from '@/lib/notifications/automation-config'
import { renderNotificationChannelTemplate, resolveNotificationChannelTemplate } from '@/lib/notifications/email-templates'
import { env } from '@/lib/env'

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, phone: true, name: true },
    })
    if (user) {
      await dispatchAutomaticNotificationChannels({
        notificationId: notification.id,
        user,
        type,
        title,
        message,
        data,
      })
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

async function dispatchAutomaticNotificationChannels(params: {
  notificationId: string
  user: { id: string; role: UserRole; email: string; phone: string | null; name: string }
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

    const baseVars = {
      user_name: params.user.name || 'Usuario',
      user_email: params.user.email,
      title: params.title,
      message: params.message,
      notification_type: params.type,
      notifications_url: `${env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || ''}/notifications`,
      app_url: env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || '',
      year: new Date().getFullYear(),
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
                    user: true,
                    documents: {
                      where: {
                        status: 'APPROVED'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        user: true,
        partner: {
          include: {
            user: true,
            documents: {
              where: {
                status: 'APPROVED'
              }
            }
          }
        }
      }
    })

    if (!serviceRequest) return

    // If partnerId is specified, only notify that specific partner
    if (serviceRequest.partnerId && serviceRequest.partner) {
      const hasIdentityDoc = serviceRequest.partner.documents.some(
        doc => ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE'].includes(doc.type)
      )
      const hasBackgroundCheck = serviceRequest.partner.documents.some(
        doc => doc.type === 'ANTECEDENTES'
      )

      if (hasIdentityDoc && hasBackgroundCheck) {
        await createNotification({
          userId: serviceRequest.partner.user.id,
          type: "NEW_SERVICE_REQUEST",
          title: "Nueva solicitud directa",
          message: `${serviceRequest.user.name} te ha solicitado ${serviceRequest.service.name}`,
          data: {
            serviceRequestId: serviceRequest.id,
            serviceId: serviceRequest.serviceId,
            isDirect: true
          }
        })
      }
    } else {
      // Otherwise, notify all partners offering this service in the city
      const partners = serviceRequest.service.partners.filter(
        ps => ps.partner.city === serviceRequest.city
      )

      for (const partnerService of partners) {
        const hasIdentityDoc = partnerService.partner.documents.some(
          doc => ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE'].includes(doc.type)
        )
        const hasBackgroundCheck = partnerService.partner.documents.some(
          doc => doc.type === 'ANTECEDENTES'
        )

        if (hasIdentityDoc && hasBackgroundCheck) {
          await createNotification({
            userId: partnerService.partner.user.id,
            type: "NEW_SERVICE_REQUEST",
            title: "Nueva solicitud de servicio",
            message: `${serviceRequest.user.name} solicita ${serviceRequest.service.name}`,
            data: {
              serviceRequestId: serviceRequest.id,
              serviceId: serviceRequest.serviceId
            }
          })
        }
      }
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
