import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [searches, requests, proposals, bookings, completed, cancelled] = await Promise.all([
    prisma.searchHistory.count({ where: { createdAt: { gte: from } } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: from } } }),
    prisma.proposal.count({ where: { createdAt: { gte: from } } }),
    prisma.booking.count({ where: { createdAt: { gte: from } } }),
    prisma.booking.count({ where: { createdAt: { gte: from }, status: 'COMPLETED' } }),
    prisma.booking.count({ where: { createdAt: { gte: from }, status: 'CANCELLED' } }),
  ])

  const sampleRequests = await prisma.serviceRequest.findMany({
    where: { createdAt: { gte: from } },
    select: {
      id: true,
      createdAt: true,
      proposals: {
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
    take: 300,
  })

  const proposalLeadTimes = sampleRequests
    .filter((r) => r.proposals.length > 0)
    .map((r) => r.proposals[0].createdAt.getTime() - r.createdAt.getTime())

  const avgTimeToFirstProposalMinutes =
    proposalLeadTimes.length === 0
      ? null
      : Math.round(proposalLeadTimes.reduce((a, b) => a + b, 0) / proposalLeadTimes.length / 60000)

  const quality = {
    avgTimeToFirstProposalMinutes,
    completionRate: bookings === 0 ? 0 : Number(((completed / bookings) * 100).toFixed(2)),
    cancellationRate: bookings === 0 ? 0 : Number(((cancelled / bookings) * 100).toFixed(2)),
  }

  const funnel = {
    searches,
    requests,
    proposals,
    bookings,
    completed,
  }

  return NextResponse.json({ rangeDays: 30, funnel, quality })
}
