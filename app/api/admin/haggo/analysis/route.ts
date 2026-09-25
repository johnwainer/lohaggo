import { NextRequest, NextResponse } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { haggoAnalysis } from '@/lib/haggo/views'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json(await haggoAnalysis({ status: request.nextUrl.searchParams.get('status') ?? undefined }), { headers: { 'Cache-Control': 'no-store' } })
}
