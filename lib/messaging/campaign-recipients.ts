import type { City, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type BasicUser = {
  id: string
  name: string
  email: string
  phone: string | null
  pushSubscription: string | null
  role: UserRole
}

export type RecipientControl = {
  includeUserIds: string[]
  excludeUserIds: string[]
}

export type CampaignAudienceFilter = {
  partnerFilterMode?: 'ALL' | 'CATEGORY' | 'SERVICE'
  partnerCategoryIds: string[]
  partnerServiceIds: string[]
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

function parseMetadataObject(metadata: string | null | undefined): Record<string, unknown> {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function parseRecipientControl(metadata: string | null | undefined): RecipientControl {
  const parsed = parseMetadataObject(metadata) as { recipientControl?: { includeUserIds?: unknown; excludeUserIds?: unknown } }
  const control = parsed?.recipientControl
  return {
    includeUserIds: sanitizeIds(control?.includeUserIds),
    excludeUserIds: sanitizeIds(control?.excludeUserIds),
  }
}

export function parseCampaignAudience(metadata: string | null | undefined): CampaignAudienceFilter {
  const parsed = parseMetadataObject(metadata) as {
    audience?: { partnerFilterMode?: unknown; partnerCategoryIds?: unknown; partnerServiceIds?: unknown }
  }
  const modeRaw = String(parsed?.audience?.partnerFilterMode || 'ALL').toUpperCase()
  const partnerFilterMode: CampaignAudienceFilter['partnerFilterMode'] =
    modeRaw === 'CATEGORY' ? 'CATEGORY' : modeRaw === 'SERVICE' ? 'SERVICE' : 'ALL'
  return {
    partnerFilterMode,
    partnerCategoryIds: sanitizeIds(parsed?.audience?.partnerCategoryIds),
    partnerServiceIds: sanitizeIds(parsed?.audience?.partnerServiceIds),
  }
}

export function mergeRecipientControlMetadata(
  metadata: string | null | undefined,
  control: RecipientControl
) {
  const parsed = parseMetadataObject(metadata)

  parsed.recipientControl = {
    includeUserIds: sanitizeIds(control.includeUserIds),
    excludeUserIds: sanitizeIds(control.excludeUserIds),
  }

  return JSON.stringify(parsed)
}

export function mergeCampaignAudienceMetadata(
  metadata: string | null | undefined,
  audience: CampaignAudienceFilter
) {
  const parsed = parseMetadataObject(metadata)

  parsed.audience = {
    partnerFilterMode: audience.partnerFilterMode || 'ALL',
    partnerCategoryIds: sanitizeIds(audience.partnerCategoryIds),
    partnerServiceIds: sanitizeIds(audience.partnerServiceIds),
  }

  return JSON.stringify(parsed)
}

export function resolveDestination(channel: MessagingChannel, user: { id: string; email: string; phone: string | null }) {
  if (channel === 'PUSH') return (user as { pushSubscription?: string | null }).pushSubscription ? `user:${user.id}` : null
  if (channel === 'EMAIL') return user.email
  return user.phone
}

export async function resolveCampaignRecipients(params: {
  targetRole: UserRole | null
  targetCity: City | null
  metadata?: string | null
  controlOverride?: RecipientControl
  audienceOverride?: CampaignAudienceFilter
  take?: number
  includeInactive?: boolean
  search?: string
}) {
  const take = Math.min(params.take || 2000, 10000)
  const activeFilter = params.includeInactive ? {} : { isActive: true }
  const control = params.controlOverride || parseRecipientControl(params.metadata)
  const audience = params.audienceOverride || parseCampaignAudience(params.metadata)
  const partnerFilterMode = audience.partnerFilterMode || 'ALL'
  const partnerCategoryIds = sanitizeIds(audience.partnerCategoryIds)
  const partnerServiceIds = sanitizeIds(audience.partnerServiceIds)
  const includeSet = new Set(control.includeUserIds)
  const excludeSet = new Set(control.excludeUserIds)

  const searchTerm = (params.search || '').trim()
  const searchFilter = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' as const } },
          { email: { contains: searchTerm, mode: 'insensitive' as const } },
          { phone: { contains: searchTerm } },
        ],
      }
    : {}

  const enforcePartnerRole =
    partnerFilterMode === 'CATEGORY' || partnerFilterMode === 'SERVICE' || partnerCategoryIds.length > 0 || partnerServiceIds.length > 0

  const roleFilter = enforcePartnerRole ? 'PARTNER' : resolveRecipientRole(params.targetRole)

  const partnerServiceWhere =
    partnerFilterMode === 'SERVICE' && partnerServiceIds.length
      ? {
          services: {
            some: {
              active: true,
              serviceId: { in: partnerServiceIds },
            },
          },
        }
      : undefined

  const partnerCategoryWhere =
    partnerFilterMode === 'CATEGORY' && partnerCategoryIds.length
      ? {
          services: {
            some: {
              active: true,
              service: { categoryId: { in: partnerCategoryIds } },
            },
          },
        }
      : undefined

  // When targetRole is null (manual-only mode), skip the segment query entirely.
  // Recipients come exclusively from includeUserIds + search results.
  const segmentUsers = params.targetRole
    ? await prisma.user.findMany({
        where: {
          role: roleFilter,
          ...activeFilter,
          ...searchFilter,
          ...((partnerServiceWhere || partnerCategoryWhere) && {
            partnerProfile: {
              ...(partnerServiceWhere || {}),
              ...(partnerCategoryWhere || {}),
            },
          }),
          ...(params.targetCity
            ? {
                OR: [
                  { role: 'CLIENT', addresses: { some: { city: params.targetCity, isActive: true } } },
                  { role: 'PARTNER', partnerProfile: { city: params.targetCity } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, email: true, phone: true, pushSubscription: true, role: true },
        take,
      })
    : []

  // In MANUAL mode with a search term, find matching users across all roles (limit 50 for search results).
  const searchResultUsers = !params.targetRole && searchTerm
    ? await prisma.user.findMany({
        where: {
          ...searchFilter,
          ...activeFilter,
          role: { in: ['PARTNER', 'CLIENT'] as UserRole[] },
        },
        select: { id: true, name: true, email: true, phone: true, pushSubscription: true, role: true },
        take: 50,
        orderBy: { name: 'asc' },
      })
    : []

  const manualUsers = includeSet.size
    ? await prisma.user.findMany({
        where: {
          id: { in: Array.from(includeSet) },
          ...activeFilter,
        },
        select: { id: true, name: true, email: true, phone: true, pushSubscription: true, role: true },
        take,
      })
    : []

  const userMap = new Map<string, CampaignRecipient>()

  for (const user of segmentUsers) {
    userMap.set(user.id, { ...user, source: 'SEGMENT' })
  }

  for (const user of searchResultUsers) {
    if (!userMap.has(user.id)) {
      userMap.set(user.id, { ...user, source: 'MANUAL' })
    }
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
    partnerServiceIds,
    partnerCategoryIds,
    partnerFilterMode,
    segmentCount: segmentUsers.length,
    manualIncludedCount: manualUsers.filter((user) => !segmentUsers.find((segment) => segment.id === user.id)).length,
  }
}
