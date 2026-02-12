import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { env } from './lib/env'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const authSecret = env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : (request as any).ip || 'unknown'
  return `${ip}-${request.nextUrl.pathname}`
}

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

function cleanupRateLimitMap() {
  const now = Date.now()
  const entries = Array.from(rateLimitMap.entries())
  for (const [key, record] of entries) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

setInterval(cleanupRateLimitMap, 60000)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/auth')) {
    // NextAuth client polls /api/auth/session frequently during navigation.
    // Keep this endpoint permissive to avoid false logouts due to 429s.
    if (pathname === '/api/auth/session') {
      const key = getRateLimitKey(request)
      const allowed = checkRateLimit(key, 300, 5 * 60 * 1000)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many session requests. Please try again later.' },
          { status: 429 }
        )
      }
    } else if (pathname === '/api/auth/csrf' || pathname === '/api/auth/providers') {
      const key = getRateLimitKey(request)
      const allowed = checkRateLimit(key, 120, 5 * 60 * 1000)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many authentication requests. Please try again later.' },
          { status: 429 }
        )
      }
    } else {
      // Keep stricter limits for auth-sensitive endpoints (signin/callback/etc.)
      const key = getRateLimitKey(request)
      const allowed = checkRateLimit(key, 30, 15 * 60 * 1000)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many authentication attempts. Please try again later.' },
          { status: 429 }
        )
      }
    }
  }

  if (pathname.startsWith('/api/payments/webhook')) {
    const key = getRateLimitKey(request)
    const allowed = checkRateLimit(key, 100, 60 * 60 * 1000)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const key = getRateLimitKey(request)
    const allowed = checkRateLimit(key, 300, 60 * 1000)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }
  }

  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request, secret: authSecret })

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (pathname.startsWith('/partner')) {
    const token = await getToken({ req: request, secret: authSecret })

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (token.role !== 'PARTNER' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/my-ratings')
  ) {
    const token = await getToken({ req: request, secret: authSecret })

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Partner/admin should use their own panels, not client dashboard routes.
    if (pathname.startsWith('/dashboard') && token.role !== 'CLIENT' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  const response = NextResponse.next()

  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      env.NEXT_PUBLIC_APP_URL,
      ...(env.ALLOWED_ORIGIN?.split(',') || []),
    ].filter(Boolean)

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/partner/:path*',
    '/dashboard/:path*',
    '/profile',
    '/notifications',
    '/my-ratings',
  ],
}
