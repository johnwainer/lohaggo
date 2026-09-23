import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

export const dynamic = 'force-dynamic'

// Signed CDN URLs Meta hands out for Messenger / Instagram attachments
function isMetaMediaUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com)$/i.test(hostname)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return new NextResponse('Unauthorized', { status: 401 })

  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  const isTwilio = url.startsWith('https://api.twilio.com/') || url.startsWith('https://media.twiliocdn.com/')
  const isMetaCdn = isMetaMediaUrl(url)
  if (!isTwilio && !isMetaCdn) {
    return new NextResponse('Invalid media URL', { status: 400 })
  }

  const headers: Record<string, string> = {}
  if (isTwilio) {
    const runtimeConfig = await getMessagingProviderRuntimeConfig()
    const conf = runtimeConfig.twilio?.config
    if (!conf?.accountSid || !conf?.authToken) {
      return new NextResponse('Twilio not configured', { status: 500 })
    }
    headers.Authorization = `Basic ${Buffer.from(`${conf.accountSid}:${conf.authToken}`).toString('base64')}`
  }

  const mediaRes = await fetch(url, { headers })
  if (!mediaRes.ok) {
    return new NextResponse('Failed to fetch media', { status: mediaRes.status })
  }

  const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream'
  const disposition = request.nextUrl.searchParams.get('download') === '1'
    ? `attachment; filename="adjunto"`
    : 'inline'

  return new NextResponse(mediaRes.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
