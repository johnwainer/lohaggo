import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roleParam = request.nextUrl.searchParams.get('role')
  const role = roleParam === 'CLIENT' || roleParam === 'PARTNER' ? roleParam : null
  const daysWithoutInstall = Number(request.nextUrl.searchParams.get('days') || 3)
  const minAttempts = Number(request.nextUrl.searchParams.get('attempts') || 2)

  const thresholdDate = new Date(Date.now() - daysWithoutInstall * 24 * 60 * 60 * 1000)

  const users = await prisma.user.findMany({
    where: {
      role: role ? role : { in: ['CLIENT', 'PARTNER'] },
      createdAt: { lte: thresholdDate },
      pwaAdoptionProfile: {
        installedAt: null,
        promptAttemptsWindow: { gte: minAttempts },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      pwaAdoptionProfile: {
        select: {
          abVariant: true,
          promptAttemptsWindow: true,
          lastContext: true,
          lastContextAt: true,
          pushEnabledAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 1000,
  })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    filters: { role, daysWithoutInstall, minAttempts },
    total: users.length,
    users,
  })
}
