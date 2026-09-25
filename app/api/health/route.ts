import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** For uptime monitors: 200 when the app and its database answer, 503 when the database does not. No details exposed. */
export async function GET() {
  const t0 = Date.now()
  const db = await Promise.race([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
  ])
  const body = { status: db ? 'ok' : 'degraded', db: db ? 'ok' : 'down', ms: Date.now() - t0, time: new Date().toISOString() }
  return NextResponse.json(body, { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
