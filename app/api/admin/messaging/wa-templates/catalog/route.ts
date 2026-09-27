import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { catalogStatus } from '@/lib/messaging/wa-registry'
import { templateSendsSince } from '@/lib/messaging/wa-send'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function payload(fresh: boolean) {
  const [rows, sends] = await Promise.all([catalogStatus({ fresh }), templateSendsSince(new Date(Date.now() - 24 * 3600_000)).catch(() => [])])
  const sent = new Map(sends.map((s) => [s.template, s.sent]))
  return {
    checkedAt: new Date().toISOString(),
    rows: rows.map((r) => ({ ...r, sent24h: sent.get(r.name) ?? 0 })),
    // Sends through templates outside the catalog (legacy fallbacks) in the same window
    legacy24h: sends.filter((s) => !rows.some((r) => r.name === s.template)),
  }
}

/** Catalog of WhatsApp templates with Meta's state, final category, event and sends in 24 h. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await payload(false))
}

/** «Refrescar estado»: drops the registry cache and reads Twilio again. */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await payload(true))
}
