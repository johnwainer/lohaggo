import { prisma } from "@/lib/prisma"
import webpush from "web-push"
import { createLogger } from '@/lib/logger'
import { validateVapidKeys, parsePushSubscription } from './pushValidation'
import { env } from '@/lib/env'
import type { NotificationType as PrismaNotificationType } from '@prisma/client'

const logger = createLogger('notification-service')

const vapidKeys = {
  publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  privateKey: env.VAPID_PRIVATE_KEY || ""
}

const vapidValidation = validateVapidKeys(vapidKeys.publicKey, vapidKeys.privateKey)

if (vapidValidation.valid) {
  webpush.setVapidDetails(
    "mailto:admin@lohaggo.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  )
  logger.info('VAPID keys configured successfully')
} else {
  logger.warn('VAPID keys not configured or invalid', { error: vapidValidation.error })
}

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

    await sendPushNotification(userId, {
      title,
      body: message,
      data: {
        notificationId: notification.id,
        type,
        ...data
      }
    })

    return notification
  } catch (error) {
    logger.error("Error creating notification:", error)
    throw error
  }
}

interface PushPayload {
  title: string
  body: string
  data?: any
}

async function sendPushNotification(userId: string, payload: PushPayload) {
  if (!vapidValidation.valid) {
    logger.debug('Push notifications disabled - VAPID keys not configured')
    return { ok: false, errorCode: 'VAPID_NOT_CONFIGURED', errorMessage: 'Push VAPID keys missing' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user?.pushSubscription) {
      return { ok: false, errorCode: 'NO_SUBSCRIPTION', errorMessage: 'User without push subscription' }
    }

    const subscription = parsePushSubscription(user.pushSubscription)

    if (!subscription) {
      logger.warn('Invalid push subscription format for user', { userId })
      await prisma.user.update({
        where: { id: userId },
        data: { pushSubscription: null }
      })
      return { ok: false, errorCode: 'INVALID_SUBSCRIPTION', errorMessage: 'Invalid push subscription payload' }
    }

    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    )

    logger.debug('Push notification sent successfully', { userId })
    return { ok: true }
  } catch (error) {
    logger.error("Error sending push notification:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as any).statusCode
      if (statusCode === 410 || statusCode === 404) {
        logger.info('Push subscription expired or invalid, removing', { userId })
        await prisma.user.update({
          where: { id: userId },
          data: { pushSubscription: null }
        })
        return { ok: false, errorCode: String(statusCode), errorMessage: 'Push subscription expired/invalid' }
      }
    }
    return { ok: false, errorCode: 'SEND_ERROR', errorMessage: error instanceof Error ? error.message : 'Push send failed' }
  }
}

export async function sendDirectPushToUser(userId: string, payload: PushPayload) {
  return sendPushNotification(userId, payload)
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
