import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorTrackingStatus } from '@/lib/system/errors'

export const dynamic = 'force-dynamic'

/** For uptime monitors: 200 when the app and its database answer, 503 when the database does not. Only the error tracker's last write time and failure count besides. */
export async function GET() {
  const t0 = Date.now()
  const db = await Promise.race([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
  ])
  // Last time an error was written (so a silent tracker shows) and whether this instance failed to write any
  const t = db ? await errorTrackingStatus().catch(() => null) : null
  const body = {
    status: db ? 'ok' : 'degraded', db: db ? 'ok' : 'down', ms: Date.now() - t0, time: new Date().toISOString(),
    errorTracking: t ? { lastWriteAt: t.lastGroupWriteAt, writeFailures: t.failures } : null,
  }
  return NextResponse.json(body, { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
