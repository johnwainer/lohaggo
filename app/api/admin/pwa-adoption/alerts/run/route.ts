import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { runPwaAdoptionAlerts } from '@/lib/pwa/adoption-alerts'

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runPwaAdoptionAlerts()
  return NextResponse.json({
    ok: true,
    ...result,
  })
}
