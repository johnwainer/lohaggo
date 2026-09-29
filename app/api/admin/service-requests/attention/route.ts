import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { scanAttention } from '@/lib/admin/request-360'

export const dynamic = 'force-dynamic'

/** Requests with attention flags (last 30 days plus live bookings), worst first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ items: await scanAttention() })
}
