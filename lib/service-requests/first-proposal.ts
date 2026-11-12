/**
 * «La primera propuesta suele llegar en ~X min»: the median time from a request to its first proposal over
 * the last 30 days. With too few requests to say, the default (7 min) is shown so the label is never empty.
 */
import { prisma } from '@/lib/prisma'

export const DEFAULT_FIRST_PROPOSAL_MIN = 7
const MIN_SAMPLES = 10
const WINDOW_MS = 30 * 24 * 3600_000
const CACHE_MS = 60 * 60_000

/** Median of the samples (minutes), or the default when there are fewer than `min` of them. Pure. */
export function medianFirstProposalMinutes(samples: number[], min = MIN_SAMPLES): number {
  const valid = samples.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b)
  if (valid.length < min) return DEFAULT_FIRST_PROPOSAL_MIN
  const mid = Math.floor(valid.length / 2)
  const median = valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2
  return Math.max(1, Math.round(median))
}

/** «~7 min» · «~25 min» · «~2 h». Rounded to the nearest 5 min over 10 min, to whole hours over 90 min. */
export function firstProposalLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return '~7 min'
  if (minutes <= 10) return `~${Math.round(minutes)} min`
  if (minutes <= 90) return `~${Math.round(minutes / 5) * 5} min`
  return `~${Math.round(minutes / 60)} h`
}

/** Minutes between each request and its first proposal, from rows already ordered by proposal time. Pure. */
export function firstProposalDeltas(rows: Array<{ serviceRequestId: string; createdAt: Date; serviceRequest: { createdAt: Date } }>): number[] {
  const seen = new Set<string>()
  const out: number[] = []
  for (const r of rows) {
    if (seen.has(r.serviceRequestId)) continue
    seen.add(r.serviceRequestId)
    out.push((r.createdAt.getTime() - r.serviceRequest.createdAt.getTime()) / 60_000)
  }
  return out
}

let cached: { at: number; minutes: number } | null = null

export async function typicalFirstProposalMinutes(now = Date.now()): Promise<number> {
  if (cached && now - cached.at < CACHE_MS) return cached.minutes
  try {
    const rows = await prisma.proposal.findMany({
      where: { createdAt: { gte: new Date(now - WINDOW_MS) } },
      orderBy: { createdAt: 'asc' },
      select: { serviceRequestId: true, createdAt: true, serviceRequest: { select: { createdAt: true } } },
      take: 2000,
    })
    cached = { at: now, minutes: medianFirstProposalMinutes(firstProposalDeltas(rows)) }
  } catch {
    cached = { at: now, minutes: DEFAULT_FIRST_PROPOSAL_MIN }
  }
  return cached.minutes
}
