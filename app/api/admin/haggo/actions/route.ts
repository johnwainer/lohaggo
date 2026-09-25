import { NextRequest, NextResponse } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { listActions } from '@/lib/haggo/actions/views'

export const dynamic = 'force-dynamic'

/** «Propuestas» (view=pending) and «Decisiones» (view=history, with filters). */
export async function GET(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const q = request.nextUrl.searchParams
  const clean = (k: string) => { const v = q.get(k); return v && /^[\w.-]{1,40}$/.test(v) ? v : null }
  return NextResponse.json({ actions: await listActions({ view: q.get('view') === 'history' ? 'history' : 'pending', domain: clean('domain'), origin: clean('origin'), status: clean('status') }) }, { headers: { 'Cache-Control': 'no-store' } })
}
