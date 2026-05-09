import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that require an authenticated session (any role)
const PROTECTED_PREFIXES = ['/partner', '/client', '/profile', '/servicios']

// Routes that require ADMIN role
const ADMIN_PREFIXES = ['/admin']

// API routes that require authentication (any role)
const PROTECTED_API_PREFIXES = [
  '/api/partner',
  '/api/client',
  '/api/user',
  '/api/bookings',
  '/api/notifications',
  '/api/upload',
  '/api/payouts',
]

// API routes that require ADMIN role
const ADMIN_API_PREFIXES = ['/api/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminPage = ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  const isProtectedPage = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAdminApi = ADMIN_API_PREFIXES.some(p => pathname.startsWith(p))
  const isProtectedApi = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))

  if (!isAdminPage && !isProtectedPage && !isAdminApi && !isProtectedApi) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Unauthenticated — redirect pages to login, return 401 for API
  if (!token) {
    if (isAdminPage || isProtectedPage) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Non-admin trying to access admin routes
  if ((isAdminPage || isAdminApi) && token.role !== 'ADMIN') {
    if (isAdminPage) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/partner/:path*',
    '/client/:path*',
    '/profile/:path*',
    '/servicios/:path*',
    '/api/admin/:path*',
    '/api/partner/:path*',
    '/api/client/:path*',
    '/api/user/:path*',
    '/api/bookings/:path*',
    '/api/notifications/:path*',
    '/api/upload/:path*',
    '/api/payouts/:path*',
  ],
}
