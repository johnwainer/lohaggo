import { NextRequest, NextResponse } from 'next/server'
import type { City, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import {
  parseCampaignAudience,
  resolveCampaignRecipients,
  resolveDestination,
  type RecipientControl,
  type CampaignAudienceFilter,
} from '@/lib/messaging/campaign-recipients'

function parseIds(value: string | null) {
  if (!value) return []
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
}

function parseControlFromRequest(request: NextRequest): RecipientControl {
  return {
    includeUserIds: parseIds(request.nextUrl.searchParams.get('includeUserIds')),
    excludeUserIds: parseIds(request.nextUrl.searchParams.get('excludeUserIds')),
  }
}

function parseAudienceFromRequest(request: NextRequest): CampaignAudienceFilter {
  const modeRaw = (request.nextUrl.searchParams.get('partnerFilterMode') || 'ALL').toUpperCase()
  const partnerFilterMode = modeRaw === 'CATEGORY' ? 'CATEGORY' : modeRaw === 'SERVICE' ? 'SERVICE' : 'ALL'
  return {
    partnerFilterMode,
    partnerCategoryIds: parseIds(request.nextUrl.searchParams.get('partnerCategoryIds')),
    partnerServiceIds: parseIds(request.nextUrl.searchParams.get('partnerServiceIds')),
    partnerWithoutDocs: request.nextUrl.searchParams.get('partnerWithoutDocs') === 'true',
    partnerWithoutStudies: request.nextUrl.searchParams.get('partnerWithoutStudies') === 'true',
    partnerWithoutServices: request.nextUrl.searchParams.get('partnerWithoutServices') === 'true',
    partnerOnlyActive: request.nextUrl.searchParams.get('partnerOnlyActive') === 'true',
    partnerOnlyVerified: request.nextUrl.searchParams.get('partnerOnlyVerified') === 'true',
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = request.nextUrl.searchParams.get('campaignId')
  const channel = (request.nextUrl.searchParams.get('channel') || 'EMAIL') as MessagingChannel
  const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()

  const controlOverride = parseControlFromRequest(request)
  const hasOverride = controlOverride.includeUserIds.length > 0 || controlOverride.excludeUserIds.length > 0
  const audienceOverride = parseAudienceFromRequest(request)
  const hasAudienceOverride =
    audienceOverride.partnerFilterMode !== 'ALL' ||
    audienceOverride.partnerCategoryIds.length > 0 ||
    audienceOverride.partnerServiceIds.length > 0 ||
    audienceOverride.partnerWithoutDocs === true ||
    audienceOverride.partnerWithoutStudies === true ||
    audienceOverride.partnerWithoutServices === true ||
    audienceOverride.partnerOnlyActive === true ||
    audienceOverride.partnerOnlyVerified === true

  let targetRole = request.nextUrl.searchParams.get('targetRole') as UserRole | null
  let targetCity = request.nextUrl.searchParams.get('targetCity') as City | null
  let metadata: string | null = null
  let campaignAudience: CampaignAudienceFilter | null = null

  if (campaignId) {
    const campaign = await prisma.messagingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, targetRole: true, targetCity: true, metadata: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    targetRole = campaign.targetRole
    targetCity = campaign.targetCity
    metadata = campaign.metadata
    campaignAudience = parseCampaignAudience(campaign.metadata)
  }

  const recipients = await resolveCampaignRecipients({
    targetRole: targetRole || null,
    targetCity: targetCity || null,
    metadata,
    controlOverride: hasOverride ? controlOverride : undefined,
    audienceOverride: hasAudienceOverride ? audienceOverride : campaignAudience || undefined,
    take: 2500,
    includeInactive: true,
    search: search || undefined,
  })

  const withEligibility = recipients.users.map((user) => {
    const destination = resolveDestination(channel, user)
    const eligible = Boolean(destination)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      source: user.source,
      destination: destination || null,
      eligible,
      reason: eligible ? null : 'Sin destino para este canal',
    }
  })

  const eligibleCount = withEligibility.filter((item) => item.eligible).length
  const ineligibleCount = withEligibility.length - eligibleCount

  return NextResponse.json({
    recipients: withEligibility,
    summary: {
      total: withEligibility.length,
      filteredTotal: withEligibility.length,
      eligible: eligibleCount,
      ineligible: ineligibleCount,
      segmentCount: recipients.segmentCount,
      manualIncludedCount: recipients.manualIncludedCount,
      excludedCount: recipients.excludeUserIds.length,
      partnerFilterMode: recipients.partnerFilterMode,
      partnerCategoryIds: recipients.partnerCategoryIds,
      partnerServiceIds: recipients.partnerServiceIds,
      includeUserIds: recipients.includeUserIds,
      excludeUserIds: recipients.excludeUserIds,
    },
  })
}
