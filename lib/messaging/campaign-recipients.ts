import type { City, MessagingChannel, Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { clientSegmentWhere, parseClientSegment, zoneUserIds, type ClientSegment } from '@/lib/messaging/campaign-segments'

type BasicUser = {
  id: string
  name: string
  email: string
  phone: string | null
  pushSubscription: string | null
  role: UserRole
}

const RECIPIENT_PAGE = 2000
/** Safety bound for one send: 25 pages of 2000 (50 000 people). */
const MAX_RECIPIENT_PAGES = 25

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
  clientSegmentOverride?: ClientSegment
  take?: number
  /** Whole segment in pages (for sending), not capped by `take`. */
  all?: boolean
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

  const clientSegment = params.clientSegmentOverride || parseClientSegment(params.metadata)
  const appliesClientSegment = Boolean(params.targetRole) && roleFilter === 'CLIENT' && clientSegment.type !== 'all'
  let clientSegmentFilter = null as ReturnType<typeof clientSegmentWhere>
  if (appliesClientSegment) {
    let zoneIds: string[] | undefined
    if (clientSegment.type === 'zone' && clientSegment.zoneKeys.length) {
      const [zoneRequests, addresses] = await Promise.all([
        prisma.serviceRequest.findMany({
          where: { zone: { in: clientSegment.zoneKeys }, user: { role: 'CLIENT' } },
          select: { userId: true, zone: true },
          distinct: ['userId'],
        }),
        prisma.address.findMany({
          where: { isActive: true, user: { role: 'CLIENT', excludedFromMarketing: false } },
          select: { userId: true, neighborhood: true, isPrimary: true, createdAt: true },
          take: 50000,
        }),
      ])
      zoneIds = zoneUserIds(clientSegment.zoneKeys, zoneRequests, addresses)
    }
    clientSegmentFilter = clientSegmentWhere(clientSegment, { zoneUserIds: zoneIds })
  }

  const hasPartnerProfileFilter = partnerServiceWhere || partnerCategoryWhere || partnerWithoutDocsWhere || partnerWithoutStudiesWhere || partnerWithoutServicesWhere || partnerOnlyVerifiedWhere

  // Search, city and client segment each narrow the audience: combined with AND (spreading two `OR`s
  // into one object kept only the last one)
  const cityFilter = params.targetCity
    ? {
        OR: [
          { role: 'CLIENT' as const, addresses: { some: { city: params.targetCity, isActive: true } } },
          { role: 'CLIENT' as const, serviceRequests: { some: { city: params.targetCity } } },
          { role: 'PARTNER' as const, partnerProfile: { city: params.targetCity } },
        ],
      }
    : null
  const and: Prisma.UserWhereInput[] = []
  if (searchTerm) and.push(searchFilter as Prisma.UserWhereInput)
  if (cityFilter) and.push(cityFilter)
  if (clientSegmentFilter) and.push(clientSegmentFilter as Prisma.UserWhereInput)
  const segmentWhere: Prisma.UserWhereInput = {
    role: roleFilter,
    excludedFromMarketing: false,
    ...activeFilter,
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
    ...(and.length ? { AND: and } : {}),
  }
  const userSelect = { id: true, name: true, email: true, phone: true, pushSubscription: true, role: true } as const

  // When targetRole is null (manual-only mode), skip the segment query entirely.
  // Recipients come exclusively from includeUserIds + search results.
  // `all`: the whole segment, read in pages (sending); otherwise the first `take` (preview).
  let segmentUsers: BasicUser[] = []
  if (params.targetRole && params.all) {
    let cursor: string | null = null
    for (let page = 0; page < MAX_RECIPIENT_PAGES; page++) {
      const batch: BasicUser[] = await prisma.user.findMany({
        where: segmentWhere, select: userSelect, orderBy: { id: 'asc' }, take: RECIPIENT_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      segmentUsers.push(...batch)
      if (batch.length < RECIPIENT_PAGE) break
      cursor = batch[batch.length - 1].id
    }
  } else if (params.targetRole) {
    segmentUsers = await prisma.user.findMany({ where: segmentWhere, select: userSelect, orderBy: { id: 'asc' }, take })
  }
  const segmentTotal = params.targetRole
    ? segmentUsers.length < take && !params.all ? segmentUsers.length : await prisma.user.count({ where: segmentWhere })
    : 0

  // In MANUAL mode with a search term, find matching users across all roles (limit 50 for search results).
  const searchResultUsers = !params.targetRole && searchTerm
    ? await prisma.user.findMany({
        where: {
          ...searchFilter,
          ...activeFilter,
          excludedFromMarketing: false,
          role: { in: ['PARTNER', 'CLIENT'] as UserRole[] },
        },
        select: { id: true, name: true, email: true, phone: true, pushSubscription: true, role: true },
        take: 50,
        orderBy: { name: 'asc' },
      })
    : []

  // Incluir manualmente sigue respetando la exclusión: si un admin agregó a alguien
  // por ID y luego fue excluido, no debe colarse al envío.
  const manualUsers = includeSet.size
    ? await prisma.user.findMany({
        where: {
          id: { in: Array.from(includeSet) },
          excludedFromMarketing: false,
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
    clientSegment: appliesClientSegment ? clientSegment : null,
    segmentCount: segmentUsers.length,
    /** Everyone in the segment; more than `segmentCount` when the preview was capped («X de Y»). */
    segmentTotal,
    manualIncludedCount: manualUsers.filter((user) => !segmentUsers.find((segment) => segment.id === user.id)).length,
  }
}
