export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 200)
  const events = await prisma.webhookEvent.findMany({
    where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, channel: true, externalId: true, status: true, detail: true, createdAt: true },
  }).catch(() => [])

  return NextResponse.json({ events })
}
