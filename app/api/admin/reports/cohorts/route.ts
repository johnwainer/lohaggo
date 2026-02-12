import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

type CohortRow = {
  cohort: string
  users: number
  completedBookings: number
  activeUsers: number
  activationRate: number
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - 6)

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since }, role: { in: ['CLIENT', 'PARTNER'] } },
    select: {
      id: true,
      createdAt: true,
      bookings: {
        where: { createdAt: { gte: since } },
        select: { status: true },
      },
    },
  })

  const map = new Map<string, CohortRow>()

  for (const user of users) {
    const cohort = monthKey(user.createdAt)
    if (!map.has(cohort)) {
      map.set(cohort, {
        cohort,
        users: 0,
        completedBookings: 0,
        activeUsers: 0,
        activationRate: 0,
      })
    }

    const row = map.get(cohort)!
    row.users += 1

    const completed = user.bookings.filter((b) => b.status === 'COMPLETED').length
    row.completedBookings += completed
    if (user.bookings.length > 0) row.activeUsers += 1
  }

  const cohorts = Array.from(map.values())
    .sort((a, b) => a.cohort.localeCompare(b.cohort))
    .map((row) => ({
      ...row,
      activationRate: row.users === 0 ? 0 : Number(((row.activeUsers / row.users) * 100).toFixed(2)),
    }))

  return NextResponse.json({ cohorts })
}
