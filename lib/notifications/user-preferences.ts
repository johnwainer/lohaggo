import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getNotificationAutomationSnapshot, isNotificationChannelEnabled, type NotificationChannelKey } from '@/lib/notifications/automation-config'

export type UserNotificationChannel = NotificationChannelKey

type PrefRow = {
  id: string
  role: UserRole
  pushSubscription?: string | null
  notificationsPushEnabled?: boolean | null
  notificationsEmailEnabled?: boolean | null
  notificationsWhatsappEnabled?: boolean | null
  notificationsSmsEnabled?: boolean | null
}

export function mapUserChannelPreference(user: PrefRow, channel: UserNotificationChannel) {
  if (channel === 'PUSH') return user.notificationsPushEnabled ?? true
  if (channel === 'EMAIL') return user.notificationsEmailEnabled ?? true
  if (channel === 'WHATSAPP') return user.notificationsWhatsappEnabled ?? true
  return user.notificationsSmsEnabled ?? true
}

export async function getUserNotificationChannelState(userId: string) {
  const user = (await (prisma as any).user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      pushSubscription: true,
      notificationsPushEnabled: true,
      notificationsEmailEnabled: true,
      notificationsWhatsappEnabled: true,
      notificationsSmsEnabled: true,
    },
  })) as PrefRow | null

  if (!user) return null

  const snapshot = await getNotificationAutomationSnapshot()
  const channels: UserNotificationChannel[] = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

  return {
    role: user.role,
    hasPushSubscription: Boolean(user.pushSubscription),
    channels: channels.map((channel) => {
      const enabledByAdmin = isNotificationChannelEnabled({ snapshot, role: user.role, channel })
      const enabledByUser = mapUserChannelPreference(user, channel)
      return {
        channel,
        enabledByAdmin,
        enabledByUser,
        effectiveEnabled: enabledByAdmin && enabledByUser,
      }
    }),
  }
}

export async function setUserNotificationChannelPreference(userId: string, channel: UserNotificationChannel, enabled: boolean) {
  const data =
    channel === 'PUSH'
      ? { notificationsPushEnabled: enabled }
      : channel === 'EMAIL'
      ? { notificationsEmailEnabled: enabled }
      : channel === 'WHATSAPP'
      ? { notificationsWhatsappEnabled: enabled }
      : { notificationsSmsEnabled: enabled }

  return (prisma as any).user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      notificationsPushEnabled: true,
      notificationsEmailEnabled: true,
      notificationsWhatsappEnabled: true,
      notificationsSmsEnabled: true,
    },
  })
}
