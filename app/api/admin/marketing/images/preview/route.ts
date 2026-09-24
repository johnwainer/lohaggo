import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { isPexelsImageUrl } from '@/lib/marketing/images-core'

export const dynamic = 'force-dynamic'

/** Pexels thumbnails through our server: their CDN answers 503 when a page on another site embeds them. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return new NextResponse('Unauthorized', { status: 401 })
  const url = request.nextUrl.searchParams.get('url') || ''
  if (!isPexelsImageUrl(url)) return new NextResponse('Invalid url', { status: 400 })
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null)
  const type = res?.headers.get('content-type') || ''
  if (!res?.ok || !type.startsWith('image/')) return new NextResponse('Unavailable', { status: 404 })
  return new NextResponse(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } })
}
