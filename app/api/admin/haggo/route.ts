import { NextResponse } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { haggoOverview } from '@/lib/haggo/views'

export const dynamic = 'force-dynamic'

/** «Ahora»: state, schedule, budget, open findings and latest runs. */
export async function GET() {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json(await haggoOverview(), { headers: { 'Cache-Control': 'no-store' } })
}
