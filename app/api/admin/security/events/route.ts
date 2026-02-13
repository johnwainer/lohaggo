import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import type { AdminSeverity } from '@prisma/client'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const ip = searchParams.get('ip')?.trim() || undefined
  const threatType = searchParams.get('threatType')?.trim() || undefined
  const severity = searchParams.get('severity')?.trim() || undefined
  const blocked = searchParams.get('blocked')
  const limit = Math.min(Number(searchParams.get('limit') || 200), 1000)

  const events = await prisma.securityEvent.findMany({
    where: {
      ...(ip ? { ipAddress: { contains: ip, mode: 'insensitive' } } : {}),
      ...(threatType ? { threatType } : {}),
      ...(severity ? { severity: severity as AdminSeverity } : {}),
      ...(blocked === 'true' ? { blocked: true } : blocked === 'false' ? { blocked: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const [openBlocksCount, last24hCount, highSeverity24hCount] = await Promise.all([
    prisma.blockedIp.count({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.securityEvent.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    }),
  ])

  return NextResponse.json({
    events,
    summary: {
      openBlocksCount,
      last24hCount,
      highSeverity24hCount,
    },
  })
}
