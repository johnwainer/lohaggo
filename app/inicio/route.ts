import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Where the installed app opens (manifest start_url): the partner lands in their panel, the admin in theirs,
 * and clients and visitors on the home page (the place to ask for a service). The UTM tag is kept.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  let path = '/'
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role === 'PARTNER') path = '/partner'
    else if (session?.user?.role === 'ADMIN') path = '/admin'
  } catch {
    path = '/'
  }
  const target = new URL(path, url.origin)
  target.searchParams.set('utm_source', url.searchParams.get('utm_source') || 'pwa')
  return NextResponse.redirect(target, 307)
}
