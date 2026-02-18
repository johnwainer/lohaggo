import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type NotificationChannelKey = 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS'

type AutomationRow = {
  target: NotificationAutomationTarget
  pushEnabled: boolean
  emailEnabled: boolean
  whatsappEnabled: boolean
  smsEnabled: boolean
}

const DEFAULTS: Record<NotificationAutomationTarget, Omit<AutomationRow, 'target'>> = {
  GLOBAL: { pushEnabled: true, emailEnabled: false, whatsappEnabled: false, smsEnabled: false },
  CLIENT: { pushEnabled: true, emailEnabled: true, whatsappEnabled: false, smsEnabled: false },
  PARTNER: { pushEnabled: true, emailEnabled: true, whatsappEnabled: false, smsEnabled: false },
  ADMIN: { pushEnabled: true, emailEnabled: true, whatsappEnabled: false, smsEnabled: false },
}

export type NotificationAutomationTarget = 'GLOBAL' | 'CLIENT' | 'PARTNER' | 'ADMIN'

function roleToTarget(role: UserRole): NotificationAutomationTarget {
  if (role === 'PARTNER') return 'PARTNER'
  if (role === 'ADMIN') return 'ADMIN'
  return 'CLIENT'
}

export async function getNotificationAutomationSnapshot() {
  const rows = (await (prisma as any).notificationAutomationConfig.findMany()) as Array<{
    target: NotificationAutomationTarget
    pushEnabled: boolean
    emailEnabled: boolean
    whatsappEnabled: boolean
    smsEnabled: boolean
    updatedByEmail: string | null
    updatedAt: Date
    createdAt: Date
  }>
  const byTarget = new Map<NotificationAutomationTarget, (typeof rows)[number]>(rows.map((row) => [row.target, row]))

  const targets: NotificationAutomationTarget[] = ['GLOBAL', 'CLIENT', 'PARTNER', 'ADMIN']

  return targets.map((target) => {
    const current = byTarget.get(target)
    const fallback = DEFAULTS[target]
    return {
      target,
      pushEnabled: current?.pushEnabled ?? fallback.pushEnabled,
      emailEnabled: current?.emailEnabled ?? fallback.emailEnabled,
      whatsappEnabled: current?.whatsappEnabled ?? fallback.whatsappEnabled,
      smsEnabled: current?.smsEnabled ?? fallback.smsEnabled,
      updatedByEmail: current?.updatedByEmail || null,
      updatedAt: current?.updatedAt || null,
      createdAt: current?.createdAt || null,
    }
  })
}

export async function upsertNotificationAutomationConfig(params: {
  target: NotificationAutomationTarget
  pushEnabled: boolean
  emailEnabled: boolean
  whatsappEnabled: boolean
  smsEnabled: boolean
  updatedByEmail?: string | null
}) {
  return (prisma as any).notificationAutomationConfig.upsert({
    where: { target: params.target },
    update: {
      pushEnabled: params.pushEnabled,
      emailEnabled: params.emailEnabled,
      whatsappEnabled: params.whatsappEnabled,
      smsEnabled: params.smsEnabled,
      updatedByEmail: params.updatedByEmail || null,
    },
    create: {
      target: params.target,
      pushEnabled: params.pushEnabled,
      emailEnabled: params.emailEnabled,
      whatsappEnabled: params.whatsappEnabled,
      smsEnabled: params.smsEnabled,
      updatedByEmail: params.updatedByEmail || null,
    },
  })
}

export function isNotificationChannelEnabled(params: {
  snapshot: Awaited<ReturnType<typeof getNotificationAutomationSnapshot>>
  role: UserRole
  channel: NotificationChannelKey
}) {
  const global = params.snapshot.find((item) => item.target === 'GLOBAL')
  const scoped = params.snapshot.find((item) => item.target === roleToTarget(params.role))

  const key =
    params.channel === 'PUSH'
      ? 'pushEnabled'
      : params.channel === 'EMAIL'
      ? 'emailEnabled'
      : params.channel === 'WHATSAPP'
      ? 'whatsappEnabled'
      : 'smsEnabled'

  const globalEnabled = global ? Boolean(global[key]) : Boolean(DEFAULTS.GLOBAL[key])
  const scopedEnabled = scoped ? Boolean(scoped[key]) : Boolean(DEFAULTS[roleToTarget(params.role)][key])

  return globalEnabled && scopedEnabled
}
