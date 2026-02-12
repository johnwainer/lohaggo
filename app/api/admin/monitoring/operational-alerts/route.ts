import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOperationalMetrics } from '@/lib/monitoring-metrics'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const operational = getOperationalMetrics(24)

  return NextResponse.json({
    window: '24h',
    generatedAt: new Date().toISOString(),
    ...operational,
  })
}
