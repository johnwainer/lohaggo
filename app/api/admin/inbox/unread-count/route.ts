export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ count: 0 })

  const result = await prisma.conversation.aggregate({
    _sum: { unreadCount: true },
    where: { unreadCount: { gt: 0 } },
  })

  return NextResponse.json({ count: result._sum.unreadCount ?? 0 })
}
