import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuthSessionMetrics } from '@/lib/monitoring-metrics'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const byHour = getAuthSessionMetrics(24)
  const totals = byHour.reduce(
    (acc, item) => {
      acc.total += item.total
      acc.success += item.success
      acc.rateLimited += item.rateLimited
      acc.errors += item.errors
      return acc
    },
    { total: 0, success: 0, rateLimited: 0, errors: 0 }
  )

  return NextResponse.json({
    window: '24h',
    generatedAt: new Date().toISOString(),
    totals,
    byHour,
  })
}
