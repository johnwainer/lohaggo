import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('magic-generate')

const TTL_HOURS = 24

// Per-admin rate limit: max 50 tokens per hour
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 50
const adminRateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(adminEmail: string, requested: number): boolean {
  const now = Date.now()
  const entry = adminRateMap.get(adminEmail)
  if (!entry || now > entry.resetAt) {
    adminRateMap.set(adminEmail, { count: requested, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count + requested > RATE_LIMIT_MAX) return false
  entry.count += requested
  return true
}

function isSafeRedirect(url: string, appOrigin: string): boolean {
  if (!url) return false
  // Allow relative paths only
  if (url.startsWith('/') && !url.startsWith('//')) return true
  // Allow same-origin absolute URLs
  try {
    return new URL(url).origin === appOrigin
  } catch {
    return false
  }
}

/**
 * POST /api/auth/magic/generate
 * Admin-only. Generates magic login tokens.
 * Body:
 *   userIds?:               string[]                            — explicit list (max 50); omit for bulk audience
 *   audience?:              'ALL_PARTNERS' | 'ALL_CLIENTS' | 'ALL_USERS'
 *   redirectUrl?:           string                              — must be same-origin or relative path
 *   requirePasswordChange?: boolean                             — show change-password banner (default false)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
  const appOrigin = appUrl ? new URL(appUrl).origin : ''

  // Validate and sanitize redirectUrl — reject external URLs
  const rawRedirect: string = body.redirectUrl ?? '/partner/dashboard'
  if (!isSafeRedirect(rawRedirect, appOrigin)) {
    return NextResponse.json({ error: 'redirectUrl inválida: solo se permiten rutas internas' }, { status: 400 })
  }
  // Normalise to path-only (strip origin if absolute same-origin URL was supplied)
  let redirectUrl = rawRedirect
  try {
    const parsed = new URL(rawRedirect)
    if (parsed.origin === appOrigin) redirectUrl = parsed.pathname + parsed.search + parsed.hash
  } catch { /* already a relative path */ }

  const requirePasswordChange: boolean = Boolean(body.requirePasswordChange)
  const audience: string = body.audience ?? 'ALL_PARTNERS'

  let userIds: string[] = []

  if (Array.isArray(body.userIds) && body.userIds.length > 0) {
    if (body.userIds.length > 50) {
      return NextResponse.json({ error: 'Máximo 50 usuarios por solicitud' }, { status: 400 })
    }
    userIds = body.userIds
  } else {
    const roleFilter =
      audience === 'ALL_CLIENTS' ? { role: 'CLIENT' as const } :
      audience === 'ALL_USERS'   ? { role: { in: ['PARTNER', 'CLIENT'] as ('PARTNER' | 'CLIENT')[] } } :
                                   { role: 'PARTNER' as const }
    const rows = await prisma.user.findMany({ where: roleFilter, select: { id: true }, take: 50 })
    userIds = rows.map(r => r.id)
  }

  if (!checkRateLimit(session.user.email!, userIds.length)) {
    return NextResponse.json(
      { error: `Límite de ${RATE_LIMIT_MAX} tokens por hora alcanzado` },
      { status: 429 }
    )
  }

  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000)
  const results: Array<{ userId: string; token: string; url: string }> = []

  for (const userId of userIds) {
    try {
      const token = randomBytes(32).toString('hex')
      await prisma.magicToken.create({
        data: { userId, token, redirectUrl, requirePasswordChange, expiresAt },
      })
      results.push({ userId, token, url: `${appUrl}/auth/magic?token=${token}` })
    } catch (err) {
      logger.error('Failed to generate magic token', { userId, err })
    }
  }

  logger.info('Magic tokens generated', {
    count: results.length,
    audience,
    requirePasswordChange,
    adminEmail: session.user.email,
  })
  return NextResponse.json({ count: results.length, tokens: results })
}
