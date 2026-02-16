import { NextRequest, NextResponse } from 'next/server'
import type { City, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import {
  resolveCampaignRecipients,
  resolveDestination,
  type RecipientControl,
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

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = request.nextUrl.searchParams.get('campaignId')
  const channel = (request.nextUrl.searchParams.get('channel') || 'EMAIL') as MessagingChannel
  const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()

  const controlOverride = parseControlFromRequest(request)
  const hasOverride = controlOverride.includeUserIds.length > 0 || controlOverride.excludeUserIds.length > 0

  let targetRole = request.nextUrl.searchParams.get('targetRole') as UserRole | null
  let targetCity = request.nextUrl.searchParams.get('targetCity') as City | null
  let metadata: string | null = null

  if (campaignId) {
    const campaign = await prisma.messagingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, targetRole: true, targetCity: true, metadata: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    targetRole = campaign.targetRole
    targetCity = campaign.targetCity
    metadata = campaign.metadata
  }

  const recipients = await resolveCampaignRecipients({
    targetRole: targetRole || null,
    targetCity: targetCity || null,
    metadata,
    controlOverride: hasOverride ? controlOverride : undefined,
    take: 2500,
  })

  const filtered = recipients.users
    .filter((user) => {
      if (!search) return true
      const haystack = `${user.name} ${user.email} ${user.phone || ''}`.toLowerCase()
      return haystack.includes(search)
    })
    .map((user) => {
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

  const eligibleCount = filtered.filter((item) => item.eligible).length
  const ineligibleCount = filtered.length - eligibleCount

  return NextResponse.json({
    recipients: filtered,
    summary: {
      total: filtered.length,
      eligible: eligibleCount,
      ineligible: ineligibleCount,
      segmentCount: recipients.segmentCount,
      manualIncludedCount: recipients.manualIncludedCount,
      excludedCount: recipients.excludeUserIds.length,
      includeUserIds: recipients.includeUserIds,
      excludeUserIds: recipients.excludeUserIds,
    },
  })
}
