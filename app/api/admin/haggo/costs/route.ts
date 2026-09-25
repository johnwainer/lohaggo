import { NextResponse } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { haggoCosts } from '@/lib/haggo/views'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json(await haggoCosts(), { headers: { 'Cache-Control': 'no-store' } })
}
