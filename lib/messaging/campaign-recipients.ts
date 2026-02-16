import type { City, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type BasicUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
}

export type RecipientControl = {
  includeUserIds: string[]
  excludeUserIds: string[]
}

export type CampaignRecipient = BasicUser & {
  source: 'SEGMENT' | 'MANUAL'
}

function resolveRecipientRole(targetRole: UserRole | null) {
  if (!targetRole) return { in: ['CLIENT', 'PARTNER'] as UserRole[] }
  return targetRole
}

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.map((item) => String(item || '').trim()).filter(Boolean)))
}

export function parseRecipientControl(metadata: string | null | undefined): RecipientControl {
  if (!metadata) return { includeUserIds: [], excludeUserIds: [] }

  try {
    const parsed = JSON.parse(metadata) as { recipientControl?: { includeUserIds?: unknown; excludeUserIds?: unknown } }
    const control = parsed?.recipientControl
    return {
      includeUserIds: sanitizeIds(control?.includeUserIds),
      excludeUserIds: sanitizeIds(control?.excludeUserIds),
    }
  } catch {
    return { includeUserIds: [], excludeUserIds: [] }
  }
}

export function mergeRecipientControlMetadata(
  metadata: string | null | undefined,
  control: RecipientControl
) {
  let parsed: Record<string, unknown> = {}
  if (metadata) {
    try {
      parsed = JSON.parse(metadata) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  }

  parsed.recipientControl = {
    includeUserIds: sanitizeIds(control.includeUserIds),
    excludeUserIds: sanitizeIds(control.excludeUserIds),
  }

  return JSON.stringify(parsed)
}

export function resolveDestination(channel: MessagingChannel, user: { id: string; email: string; phone: string | null }) {
  if (channel === 'PUSH') return `user:${user.id}`
  if (channel === 'EMAIL') return user.email
  return user.phone
}

export async function resolveCampaignRecipients(params: {
  targetRole: UserRole | null
  targetCity: City | null
  metadata?: string | null
  controlOverride?: RecipientControl
  take?: number
}) {
  const take = Math.min(params.take || 2000, 10000)
  const control = params.controlOverride || parseRecipientControl(params.metadata)
  const includeSet = new Set(control.includeUserIds)
  const excludeSet = new Set(control.excludeUserIds)

  const segmentUsers = await prisma.user.findMany({
    where: {
      role: resolveRecipientRole(params.targetRole),
      isActive: true,
      ...(params.targetCity
        ? {
            OR: [
              { role: 'CLIENT', addresses: { some: { city: params.targetCity, isActive: true } } },
              { role: 'PARTNER', partnerProfile: { city: params.targetCity } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, phone: true, role: true },
    take,
  })

  const manualUsers = includeSet.size
    ? await prisma.user.findMany({
        where: {
          id: { in: Array.from(includeSet) },
          isActive: true,
        },
        select: { id: true, name: true, email: true, phone: true, role: true },
        take,
      })
    : []

  const userMap = new Map<string, CampaignRecipient>()

  for (const user of segmentUsers) {
    userMap.set(user.id, { ...user, source: 'SEGMENT' })
  }

  for (const user of manualUsers) {
    if (!userMap.has(user.id)) {
      userMap.set(user.id, { ...user, source: 'MANUAL' })
    }
  }

  excludeSet.forEach((userId) => {
    userMap.delete(userId)
  })

  const users = Array.from(userMap.values())

  return {
    users,
    includeUserIds: Array.from(includeSet),
    excludeUserIds: Array.from(excludeSet),
    segmentCount: segmentUsers.length,
    manualIncludedCount: manualUsers.filter((user) => !segmentUsers.find((segment) => segment.id === user.id)).length,
  }
}
