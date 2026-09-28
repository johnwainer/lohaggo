import { prisma } from '@/lib/prisma'
import { campaignRefCode, campaignResults } from '@/lib/messaging/campaign-tracking'

export type CampaignResults = { code: string; solicitudes: number; reservas: number }

/**
 * Requests and bookings credited to each started campaign: ServiceRequest.acquisition / lastTouch with
 * campaign or ref `cmp-<code>` created after the campaign started, and the bookings of those requests.
 */
export async function loadCampaignResults(campaigns: Array<{ id: string; startedAt: Date | null }>): Promise<Map<string, CampaignResults>> {
  const out = new Map<string, CampaignResults>()
  const started = campaigns.filter((c): c is { id: string; startedAt: Date } => Boolean(c.startedAt))
  if (!started.length) return out
  const since = new Date(Math.min(...started.map((c) => c.startedAt.getTime())))
  const requests = await prisma.serviceRequest.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { acquisition: { path: ['campaign'], string_starts_with: 'cmp-' } },
        { lastTouch: { path: ['campaign'], string_starts_with: 'cmp-' } },
        { acquisition: { path: ['ref'], string_starts_with: 'cmp-' } },
        { lastTouch: { path: ['ref'], string_starts_with: 'cmp-' } },
      ],
    },
    select: { id: true, createdAt: true, acquisition: true, lastTouch: true },
    take: 20000,
  })
  const bookings = requests.length
    ? await prisma.booking.findMany({
        where: { proposal: { serviceRequestId: { in: requests.map((r) => r.id) } } },
        select: { proposal: { select: { serviceRequestId: true } } },
      })
    : []
  const flat = bookings.map((b) => ({ serviceRequestId: b.proposal?.serviceRequestId ?? null }))
  for (const c of started) out.set(c.id, campaignResults(campaignRefCode(c.id), c.startedAt, requests, flat))
  return out
}
