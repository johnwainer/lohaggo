import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 30

export async function GET() {
  const flags = await prisma.featureFlag.findMany({
    where: { key: { in: ['whatsapp_float_button', 'help_float_button'] } },
    select: { key: true, enabled: true, metadata: true },
  })

  const result: Record<string, { enabled: boolean; config: Record<string, string> }> = {}
  for (const flag of flags) {
    let config: Record<string, string> = {}
    try { if (flag.metadata) config = JSON.parse(flag.metadata) } catch { /* ignore */ }
    result[flag.key] = { enabled: flag.enabled, config }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
