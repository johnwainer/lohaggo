import { formatCalendarDay } from '@/lib/bookings/when'
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

export type NotificationChannel = 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  /** `data.url` (a path like '/dashboard?tab=requests') is where the push and the message link open. */
  data?: any
  /** Limit the automatic channels (default: all four). */
  channels?: NotificationChannel[]
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
  channels,
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
        pushSubscription: true,
        notificationsPushEnabled: true,
        notificationsEmailEnabled: true,
        notificationsWhatsappEnabled: true,
        notificationsSmsEnabled: true,
      },
    })

    // Await dispatch to ensure it completes before the serverless lambda
    // terminates. Fire-and-forget gets dropped in Vercel when the parent
    // function returns; the .catch swallows any error so callers don't fail.
    if (user) {
      await dispatchAutomaticNotificationChannels({
        notificationId: notification.id,
        user,
        type,
        title,
        message,
        data,
        channels,
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
      return role === 'CLIENT'
        ? `${appUrl}/dashboard?tab=requests`
        : `${appUrl}/partner?tab=my-requests`
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

/** The path a notification opens: `data.url` when it is an internal path, else the type's default destination. */
export function notificationTargetPath(type: NotificationType, role: UserRole, data?: unknown): string {
  const url = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).url : null
  if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) return url
  return computeActionUrl(type, role, '')
}

/**
 * Push results that mean «nothing to deliver to» (no subscription, or the browser dropped it) rather than
 * a delivery failure: logged as SKIPPED so the channel's failure rate reflects real errors.
 */
export const PUSH_NOT_DELIVERABLE = new Set(['NO_SUBSCRIPTION', 'INVALID_SUBSCRIPTION', '404', '410'])

async function buildEnrichedVars(
  data: unknown,
  type: NotificationType,
  role: UserRole,
  appUrl: string
): Promise<Record<string, string | number>> {
  const vars: Record<string, string | number> = {
    action_url: `${appUrl}${notificationTargetPath(type, role, data)}`,
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
          ? formatCalendarDay(booking.scheduledDate, { day: '2-digit', month: 'short', year: 'numeric' })
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

/** Short reference the app and the chat agent use («#abc123») for the entity the notification is about. */
export function referenceFor(data: unknown): string {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  const id = [d.bookingId, d.serviceRequestId, d.proposalId, d.chatId, d.paymentId].find((v): v is string => typeof v === 'string' && v.length > 0)
  return id ? `#${id.slice(-6)}` : ''
}

/** Marker action of lib/messaging/wa-send.ts (kept literal: this module must not import the sender). */
const WA_TEMPLATE_SENT = 'WA_TEMPLATE_SENT'
const TEMPLATE_SUPPRESS_MS = 3 * 60_000

async function templateSentRecently(userId: string) {
  const hit = await prisma.adminAuditLog.findFirst({
    where: { action: WA_TEMPLATE_SENT, createdAt: { gte: new Date(Date.now() - TEMPLATE_SUPPRESS_MS) }, details: { contains: `"userId":"${userId}"` } },
    select: { id: true },
  }).catch(() => null)
  return Boolean(hit)
}

async function dispatchAutomaticNotificationChannels(params: {
  notificationId: string
  user: {
    id: string
    role: UserRole
    email: string
    phone: string | null
    name: string
    pushSubscription?: string | null
    notificationsPushEnabled?: boolean | null
    notificationsEmailEnabled?: boolean | null
    notificationsWhatsappEnabled?: boolean | null
    notificationsSmsEnabled?: boolean | null
  }
  type: NotificationType
  title: string
  message: string
  data?: unknown
  channels?: NotificationChannel[]
}) {
  const [runtimeConfig, snapshot] = await Promise.all([
    getMessagingProviderRuntimeConfig(),
    getNotificationAutomationSnapshot(),
  ])

  const channels: NotificationChannel[] = (['PUSH', 'EMAIL', 'WHATSAPP', 'SMS'] as NotificationChannel[]).filter((c) => !params.channels || params.channels.includes(c))

  for (const channel of channels) {
    try {
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
    if (channel === 'PUSH' && !params.user.pushSubscription) {
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
          errorCode: 'NO_SUBSCRIPTION',
          errorMessage: 'User has not enabled push on any device',
          metadata: params.data ? JSON.stringify(params.data) : null,
        },
      })
      continue
    }
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

    // A catalog template just went to this person for the same event: the free text would repeat it
    if (channel === 'WHATSAPP' && (await templateSentRecently(params.user.id))) {
      await (prisma as any).notificationDispatchLog.create({
        data: {
          notificationId: params.notificationId,
          userId: params.user.id,
          userRole: params.user.role,
          notificationType: params.type,
          channel,
          destination,
          status: 'SKIPPED',
          provider: 'internal',
          errorCode: 'TEMPLATE_SENT',
          errorMessage: 'A WhatsApp template was sent for this event',
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
    // The templates seeded in February use camelCase names; without these they reach people blank
    const legacyVars = {
      userName: baseVars.user_name,
      actionUrl: enriched.action_url,
      referenceId: referenceFor(params.data),
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
        vars: { ...baseVars, ...legacyVars },
      })
      subject = rendered.subject || subject
      body = channel === 'EMAIL' ? rendered.bodyHtml || rendered.body : rendered.body
      templateKey = template.key
    } else if (channel === 'EMAIL') {
      body = `${params.message}<br/><br/><a href=\"${enriched.action_url}\">Abrir en LoHaggo</a>`
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
          ...(templateKey ? { templateKey } : {}),
          ...(typeof params.data === 'object' && params.data ? (params.data as Record<string, unknown>) : {}),
          targetUrl: notificationTargetPath(params.type, params.user.role, params.data),
        },
      },
      runtimeConfig
    )

    const undeliverablePush = !result.ok && channel === 'PUSH' && PUSH_NOT_DELIVERABLE.has(String(result.errorCode))
    await (prisma as any).notificationDispatchLog.create({
      data: {
        notificationId: params.notificationId,
        userId: params.user.id,
        userRole: params.user.role,
        notificationType: params.type,
        channel,
        destination,
        status: result.ok ? 'SENT' : undeliverablePush ? 'SKIPPED' : 'FAILED',
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
    } catch (channelErr) {
      logger.error('[dispatch] channel threw uncaught', {
        channel,
        type: params.type,
        userId: params.user.id,
        error: channelErr instanceof Error ? channelErr.message : String(channelErr),
        stack: channelErr instanceof Error ? channelErr.stack : undefined,
      })
      try {
        await (prisma as any).notificationDispatchLog.create({
          data: {
            notificationId: params.notificationId,
            userId: params.user.id,
            userRole: params.user.role,
            notificationType: params.type,
            channel,
            destination: null,
            status: 'FAILED',
            provider: 'internal',
            errorCode: 'UNCAUGHT_EXCEPTION',
            errorMessage: channelErr instanceof Error ? channelErr.message.slice(0, 500) : String(channelErr).slice(0, 500),
            metadata: params.data ? JSON.stringify(params.data) : null,
          },
        })
      } catch (logErr) {
        logger.error('[dispatch] failed to write FAILED log row', { logErr })
      }
    }
  }
}

/**
 * Tells the matching partners about a request and confirms it to the client. With `partnersOnly` (a
 * reminder about a request without proposals) the client is not written to again. Returns how many
 * partners were notified.
 */
export async function notifyNewServiceRequest(serviceRequestId: string, opts: { partnersOnly?: boolean; round?: number; origin?: { via: string } } = {}): Promise<number> {
  let notified = 0
  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        service: {
          include: {
            partners: {
              where: {
                active: true,
                partner: {
                  isActive: true,
                  verified: true,
                  isAvailable: true,
                },
              },
              include: {
                partner: {
                  include: {
                    user: { select: { id: true, name: true, phone: true } },
                    availability: { where: { active: true, partnerServiceId: null }, select: { dayOfWeek: true, startTime: true, endTime: true } },
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
          }
        },
        proposals: { select: { partnerId: true } },
      }
    })

    if (!serviceRequest) return 0

    const { waNewRequestToPartner, waRequestCreated } = await import('@/lib/messaging/wa-events')
    const serviceName = serviceRequest.service.name

    // Format the "when" string for the partner notification
    let when = 'fecha por definir'
    if (serviceRequest.isUrgent) {
      when = 'hoy, urgente'
    } else if (serviceRequest.preferredDate) {
      const { waDay, waWhen } = await import('@/lib/messaging/wa-format')
      const { bookingWhen } = await import('@/lib/bookings/when')
      when = serviceRequest.preferredTime
        ? waWhen(bookingWhen({ scheduledDate: serviceRequest.preferredDate, scheduledTime: serviceRequest.preferredTime }))
        : waDay(bookingWhen({ scheduledDate: serviceRequest.preferredDate, scheduledTime: '12:00' }))
    }

    const notifyPartner = async (partner: { user: { id: string; name: string; phone: string | null } }, isDirect: boolean) => {
      notified++
      // Template first (C10 / C11): the free-text WhatsApp of the notification is then skipped
      await waNewRequestToPartner({
        requestId: serviceRequest.id, partnerUserId: partner.user.id, partnerName: partner.user.name, service: serviceName,
        address: serviceRequest.address, city: serviceRequest.city, when, direct: isDirect, round: opts.round ?? 0,
      })
      await createNotification({
        userId: partner.user.id,
        type: "NEW_SERVICE_REQUEST",
        title: isDirect ? "Nueva solicitud directa" : "Nueva solicitud de servicio",
        message: isDirect
          ? `${serviceRequest.user.name} te ha solicitado ${serviceName}`
          : `${serviceRequest.user.name} solicita ${serviceName}`,
        data: { serviceRequestId: serviceRequest.id, serviceId: serviceRequest.serviceId, isDirect }
      })
    }

    const isEligible = (p: { isActive: boolean; verified: boolean; isAvailable: boolean }) =>
      p.isActive && p.verified && p.isAvailable

    // A partner who already proposed is not told again (reminder rounds, reopenings)
    const proposed = new Set((serviceRequest.proposals ?? []).map(p => p.partnerId))

    if (serviceRequest.partnerId && serviceRequest.partner) {
      if (isEligible(serviceRequest.partner) && !proposed.has(serviceRequest.partner.id)) {
        await notifyPartner(serviceRequest.partner, true)
      }
    } else {
      // The city where the partner offers this service (not the profile's city); nobody who already proposed
      const cityPartners = serviceRequest.service.partners.filter(
        ps => ps.city === serviceRequest.city && !proposed.has(ps.partner.id)
      )
      // Prefer partners whose zones and schedule fit the request; if none does, relax only the schedule (never the zone)
      const { matchesRequest } = await import('@/lib/partners/coverage-core')
      const { coversZone } = await import('@/lib/geo/zones')
      const matching = cityPartners.filter(ps => matchesRequest(
        { coverageZones: ps.partner.coverageZones, schedule: ps.partner.availability },
        { zone: serviceRequest.zone, preferredDate: serviceRequest.preferredDate, preferredTime: serviceRequest.preferredTime, isUrgent: serviceRequest.isUrgent },
      ))
      const partners = matching.length > 0 ? matching : cityPartners.filter(ps => coversZone(ps.partner.coverageZones, serviceRequest.zone))
      for (const { partner } of partners) {
        await notifyPartner(partner, false)
      }
    }

    if (opts.partnersOnly) return notified

    // Notify the client in-app that their request has been submitted
    await waRequestCreated({ requestId: serviceRequest.id, clientUserId: serviceRequest.user.id, clientName: serviceRequest.user.name, service: serviceName, origin: opts.origin })
    await createNotification({
      userId: serviceRequest.user.id,
      type: 'NEW_SERVICE_REQUEST',
      title: 'Solicitud enviada',
      message: `Estamos buscando socios para tu solicitud de ${serviceName}. Te avisaremos cuando recibas propuestas.`,
      data: { serviceRequestId: serviceRequest.id, serviceId: serviceRequest.serviceId, recipient: 'CLIENT' }
    })
  } catch (error) {
    logger.error("Error notifying new service request", { serviceRequestId, error })
  }
  return notified
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

    const serviceName = proposal.serviceRequest.service.name
    const partnerName = proposal.partner.user.name
    const price = `$${Math.round(Number(proposal.price)).toLocaleString('es-CO')}`

    // Approved WhatsApp template B3 (works outside the 24 h window); while Meta has not approved it the
    // regular free-text WhatsApp channel stays in place.
    const { waNewProposal } = await import('@/lib/messaging/wa-events')
    const wa = await waNewProposal(proposal.id)
    const whatsappByTemplate = Boolean(wa?.ok)

    await createNotification({
      userId: proposal.serviceRequest.userId,
      type: "NEW_PROPOSAL",
      title: "Nueva propuesta recibida",
      message: `${partnerName} te envió una propuesta de ${price} para ${serviceName}`,
      data: {
        proposalId: proposal.id,
        serviceRequestId: proposal.serviceRequestId,
        price: Number(proposal.price),
        url: '/dashboard?tab=requests',
      },
      ...(whatsappByTemplate ? { channels: ['PUSH', 'EMAIL', 'SMS'] as NotificationChannel[] } : {}),
    })
  } catch (error) {
    logger.error("Error notifying new proposal", { proposalId, error })
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
    logger.error("Error notifying proposal accepted", { proposalId, error })
  }
}

export async function notifyProposalRejected(proposalId: string, opts: { notChosen?: boolean } = {}) {
  try {
    // C13 only when the client chose another proposal (not on expiry or cancellation: its text would be wrong)
    if (opts.notChosen) {
      const { waProposalNotChosen } = await import('@/lib/messaging/wa-events')
      await waProposalNotChosen(proposalId)
    }
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
    logger.error("Error notifying proposal rejected", { proposalId, error })
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
    logger.error("Error notifying booking status change", { bookingId, status, error })
  }
}
