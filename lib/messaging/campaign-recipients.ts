import type { City, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'

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
  partnerWithoutDocs?: boolean
  partnerWithoutStudies?: boolean
  partnerWithoutServices?: boolean
  partnerOnlyActive?: boolean
  partnerOnlyVerified?: boolean
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
    audience?: { partnerFilterMode?: unknown; partnerCategoryIds?: unknown; partnerServiceIds?: unknown; partnerWithoutDocs?: unknown; partnerWithoutStudies?: unknown; partnerWithoutServices?: unknown; partnerOnlyActive?: unknown; partnerOnlyVerified?: unknown }
  }
  const modeRaw = String(parsed?.audience?.partnerFilterMode || 'ALL').toUpperCase()
  const partnerFilterMode: CampaignAudienceFilter['partnerFilterMode'] =
    modeRaw === 'CATEGORY' ? 'CATEGORY' : modeRaw === 'SERVICE' ? 'SERVICE' : 'ALL'
  return {
    partnerFilterMode,
    partnerCategoryIds: sanitizeIds(parsed?.audience?.partnerCategoryIds),
    partnerServiceIds: sanitizeIds(parsed?.audience?.partnerServiceIds),
    partnerWithoutDocs: Boolean(parsed?.audience?.partnerWithoutDocs),
    partnerWithoutStudies: Boolean(parsed?.audience?.partnerWithoutStudies),
    partnerWithoutServices: Boolean(parsed?.audience?.partnerWithoutServices),
    partnerOnlyActive: Boolean(parsed?.audience?.partnerOnlyActive),
    partnerOnlyVerified: Boolean(parsed?.audience?.partnerOnlyVerified),
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
    partnerWithoutDocs: Boolean(audience.partnerWithoutDocs),
    partnerWithoutStudies: Boolean(audience.partnerWithoutStudies),
    partnerWithoutServices: Boolean(audience.partnerWithoutServices),
    partnerOnlyActive: Boolean(audience.partnerOnlyActive),
    partnerOnlyVerified: Boolean(audience.partnerOnlyVerified),
  }

  return JSON.stringify(parsed)
}

export function resolveDestination(channel: MessagingChannel, user: { id: string; email: string; phone: string | null }) {
  if (channel === 'PUSH') return (user as { pushSubscription?: string | null }).pushSubscription ? `user:${user.id}` : null
  if (channel === 'EMAIL') return user.email
  return normalizePhone(user.phone)
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
  const control = params.controlOverride || parseRecipientControl(params.metadata)
  const audience = params.audienceOverride || parseCampaignAudience(params.metadata)
  const forceActive = Boolean(audience.partnerOnlyActive)
  const activeFilter = forceActive || !params.includeInactive ? { isActive: true } : {}
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

  const partnerWithoutDocs = audience.partnerWithoutDocs ?? false
  const partnerWithoutStudies = audience.partnerWithoutStudies ?? false
  const partnerWithoutServices = audience.partnerWithoutServices ?? false
  const partnerOnlyVerified = audience.partnerOnlyVerified ?? false

  const enforcePartnerRole =
    partnerFilterMode === 'CATEGORY' || partnerFilterMode === 'SERVICE' ||
    partnerCategoryIds.length > 0 || partnerServiceIds.length > 0 ||
    partnerWithoutDocs || partnerWithoutStudies || partnerWithoutServices || partnerOnlyVerified

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

  const IDENTITY_DOC_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
  const STUDY_DOC_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

  const partnerWithoutDocsWhere = partnerWithoutDocs
    ? {
        documents: {
          none: {
            type: { in: IDENTITY_DOC_TYPES as never[] },
            status: 'APPROVED' as const,
          },
        },
      }
    : undefined

  const partnerWithoutStudiesWhere = partnerWithoutStudies
    ? {
        documents: {
          none: {
            type: { in: STUDY_DOC_TYPES as never[] },
            status: 'APPROVED' as const,
          },
        },
      }
    : undefined

  const partnerWithoutServicesWhere = partnerWithoutServices
    ? {
        services: {
          none: { active: true },
        },
      }
    : undefined

  const partnerOnlyVerifiedWhere = partnerOnlyVerified
    ? {
        documents: {
          some: {
            type: { in: IDENTITY_DOC_TYPES as never[] },
            status: 'APPROVED' as const,
          },
        },
      }
    : undefined

  const hasPartnerProfileFilter = partnerServiceWhere || partnerCategoryWhere || partnerWithoutDocsWhere || partnerWithoutStudiesWhere || partnerWithoutServicesWhere || partnerOnlyVerifiedWhere

  // When targetRole is null (manual-only mode), skip the segment query entirely.
  // Recipients come exclusively from includeUserIds + search results.
  const segmentUsers = params.targetRole
    ? await prisma.user.findMany({
        where: {
          role: roleFilter,
          ...activeFilter,
          ...searchFilter,
          ...(hasPartnerProfileFilter && {
            partnerProfile: {
              ...(partnerServiceWhere || {}),
              ...(partnerCategoryWhere || {}),
              ...(partnerWithoutDocsWhere || {}),
              ...(partnerWithoutStudiesWhere || {}),
              ...(partnerWithoutServicesWhere || {}),
              ...(partnerOnlyVerifiedWhere || {}),
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
