import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { env } from './lib/env'
import { recordAuthSessionMetric, recordOperationalMetric } from './lib/monitoring-metrics'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const blockedIpCache = new Map<string, { blocked: boolean; expiresAt: number }>()
const authSecret = env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET
const securityInternalToken = env.SECURITY_INTERNAL_TOKEN || authSecret
const blockedIpCacheTtlMs = 60 * 1000

const suspiciousPathPatterns = [
  '/wp-admin',
  '/wp-login',
  '/xmlrpc.php',
  '/.env',
  '/phpmyadmin',
  '/cgi-bin',
  '/boaform',
  '/server-status',
  '/vendor/phpunit',
]

const suspiciousUserAgentTokens = [
  'sqlmap',
  'nikto',
  'acunetix',
  'nmap',
  'masscan',
  'zgrab',
  'wpscan',
]

function getRoleHomePath(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'PARTNER':
      return '/partner'
    case 'CLIENT':
      return '/dashboard'
    default:
      return '/'
  }
}

function redirectToRoleHome(request: NextRequest, role?: string | null) {
  return NextResponse.redirect(new URL(getRoleHomePath(role), request.url))
}

function getRateLimitKey(request: NextRequest): string {
  const ip = getClientIp(request)
  return `${ip}-${request.nextUrl.pathname}`
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : (request as any).ip || 'unknown'
}

function getOriginRoute(request: NextRequest): string {
  const referer = request.headers.get('referer')
  if (!referer) return 'direct'
  try {
    const url = new URL(referer)
    return `${url.pathname}${url.search}`
  } catch {
    return referer
  }
}

function logAuthSessionTelemetry(request: NextRequest, status: number, rateLimitHit: boolean) {
  // Telemetría persistida por recordAuthSessionMetric/recordOperationalMetric.
  // Evitamos console output en runtime productivo.
  return
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

  const blockedEntries = Array.from(blockedIpCache.entries())
  for (const [key, value] of blockedEntries) {
    if (now > value.expiresAt) {
      blockedIpCache.delete(key)
    }
  }
}

setInterval(cleanupRateLimitMap, 60000)

async function queryBlockedIpStatus(request: NextRequest, ip: string): Promise<boolean> {
  if (!securityInternalToken || !ip || ip === 'unknown') return false

  const cacheEntry = blockedIpCache.get(ip)
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return cacheEntry.blocked
  }

  try {
    const url = `${request.nextUrl.origin}/api/security/internal?ip=${encodeURIComponent(ip)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-security-internal': '1',
        'x-security-token': securityInternalToken,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      blockedIpCache.set(ip, { blocked: false, expiresAt: Date.now() + blockedIpCacheTtlMs })
      return false
    }

    const data = (await response.json()) as { blocked?: boolean }
    const blocked = Boolean(data.blocked)
    blockedIpCache.set(ip, { blocked, expiresAt: Date.now() + blockedIpCacheTtlMs })
    return blocked
  } catch {
    blockedIpCache.set(ip, { blocked: false, expiresAt: Date.now() + blockedIpCacheTtlMs })
    return false
  }
}

async function reportSecurityThreat(
  request: NextRequest,
  payload: {
    ipAddress: string
    threatType: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    statusCode?: number
    metadata?: Record<string, unknown>
  }
) {
  if (!securityInternalToken || !payload.ipAddress || payload.ipAddress === 'unknown') return

  try {
    await fetch(`${request.nextUrl.origin}/api/security/internal`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-security-internal': '1',
        'x-security-token': securityInternalToken,
      },
      body: JSON.stringify({
        ipAddress: payload.ipAddress,
        path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
        method: request.method,
        query: request.nextUrl.search || null,
        userAgent: request.headers.get('user-agent') || null,
        threatType: payload.threatType,
        severity: payload.severity,
        source: 'edge-middleware',
        statusCode: payload.statusCode,
        metadata: payload.metadata || null,
      }),
      cache: 'no-store',
    })
  } catch {
    // Do not block request processing when telemetry persistence fails.
  }
}

function detectRequestThreat(request: NextRequest): { type: string; severity: 'HIGH' | 'CRITICAL' } | null {
  const path = request.nextUrl.pathname.toLowerCase()
  const search = request.nextUrl.search.toLowerCase()
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase()

  if (suspiciousPathPatterns.some((pattern) => path.includes(pattern))) {
    return { type: 'scanner_probe_path', severity: 'CRITICAL' }
  }

  const queryProbeRegex = /(\.\.\/|union(\s+all)?\s+select|<script|%3cscript|or\s+1=1|drop\s+table|sleep\()/i
  if (queryProbeRegex.test(search)) {
    return { type: 'query_injection_probe', severity: 'HIGH' }
  }

  if (suspiciousUserAgentTokens.some((token) => userAgent.includes(token))) {
    return { type: 'scanner_probe_user_agent', severity: 'HIGH' }
  }

  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  if (pathname === '/api/security/internal' && request.headers.get('x-security-internal') === '1') {
    return NextResponse.next()
  }

  const isBlocked = await queryBlockedIpStatus(request, ip)
  if (isBlocked) {
    await reportSecurityThreat(request, {
      ipAddress: ip,
      threatType: 'blocked_ip_attempt',
      severity: 'HIGH',
      statusCode: 403,
    })

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return new NextResponse('Access denied', { status: 403 })
  }

  const detectedThreat = detectRequestThreat(request)
  if (detectedThreat) {
    await reportSecurityThreat(request, {
      ipAddress: ip,
      threatType: detectedThreat.type,
      severity: detectedThreat.severity,
      statusCode: 403,
    })

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return new NextResponse('Forbidden', { status: 403 })
  }

  if (pathname.startsWith('/api/auth')) {
    // NextAuth client polls /api/auth/session frequently during navigation.
    // Keep this endpoint permissive to avoid false logouts due to 429s.
    if (pathname === '/api/auth/session') {
      const key = getRateLimitKey(request)
      const allowed = checkRateLimit(key, 300, 5 * 60 * 1000)
      if (!allowed) {
        recordAuthSessionMetric(429, true)
        recordOperationalMetric('auth_session_429')
        await reportSecurityThreat(request, {
          ipAddress: ip,
          threatType: 'rate_limit_auth_session',
          severity: 'MEDIUM',
          statusCode: 429,
        })
        logAuthSessionTelemetry(request, 429, true)
        return NextResponse.json(
          { error: 'Too many session requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'x-auth-session-rate-limit-hit': '1',
            },
          }
        )
      }

      recordAuthSessionMetric(200, false)
      logAuthSessionTelemetry(request, 200, false)
    } else if (pathname === '/api/auth/csrf' || pathname === '/api/auth/providers') {
      const key = getRateLimitKey(request)
      const allowed = checkRateLimit(key, 120, 5 * 60 * 1000)
      if (!allowed) {
        await reportSecurityThreat(request, {
          ipAddress: ip,
          threatType: 'rate_limit_auth_discovery',
          severity: 'MEDIUM',
          statusCode: 429,
        })
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
        await reportSecurityThreat(request, {
          ipAddress: ip,
          threatType: 'rate_limit_auth_sensitive',
          severity: 'HIGH',
          statusCode: 429,
        })
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
      await reportSecurityThreat(request, {
        ipAddress: ip,
        threatType: 'rate_limit_webhook',
        severity: 'HIGH',
        statusCode: 429,
      })
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
      await reportSecurityThreat(request, {
        ipAddress: ip,
        threatType: 'rate_limit_api_generic',
        severity: 'MEDIUM',
        statusCode: 429,
      })
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
      return redirectToRoleHome(request, token.role as string | null)
    }
  }

  if (pathname.startsWith('/partner')) {
    const token = await getToken({ req: request, secret: authSecret })

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (token.role !== 'PARTNER' && token.role !== 'ADMIN') {
      return redirectToRoleHome(request, token.role as string | null)
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

    if (token.role === 'ADMIN') {
      return redirectToRoleHome(request, token.role as string | null)
    }

    // Partner should use partner notifications endpoint.
    if (pathname.startsWith('/notifications') && token.role === 'PARTNER') {
      return NextResponse.redirect(new URL('/partner/notifications', request.url))
    }

    // Partner should use partner dashboard routes, not client dashboard routes.
    if (pathname.startsWith('/dashboard') && token.role === 'PARTNER') {
      return redirectToRoleHome(request, token.role as string | null)
    }

    if (
      (pathname.startsWith('/dashboard') || pathname.startsWith('/notifications') || pathname.startsWith('/my-ratings') || pathname.startsWith('/profile')) &&
      token.role !== 'CLIENT' &&
      token.role !== 'PARTNER'
    ) {
      return redirectToRoleHome(request, token.role as string | null)
    }
  }

  const response = NextResponse.next()

  if (pathname === '/api/auth/session') {
    response.headers.set('x-auth-session-rate-limit-hit', '0')
  }

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
