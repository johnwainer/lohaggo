import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('magic-generate')

const TTL_HOURS = 72

/**
 * POST /api/auth/magic/generate
 * Admin-only. Generates magic login tokens.
 * Body:
 *   userIds?:               string[]                            — explicit list; omit for bulk audience
 *   audience?:              'ALL_PARTNERS' | 'ALL_CLIENTS' | 'ALL_USERS'
 *   redirectUrl?:           string                              — where to send after login
 *   requirePasswordChange?: boolean                             — show change-password banner (default false)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const redirectUrl: string = body.redirectUrl ?? '/partner/dashboard'
  const requirePasswordChange: boolean = Boolean(body.requirePasswordChange)
  const audience: string = body.audience ?? 'ALL_PARTNERS'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''

  let userIds: string[] = []

  if (Array.isArray(body.userIds) && body.userIds.length > 0) {
    userIds = body.userIds
  } else {
    const roleFilter =
      audience === 'ALL_CLIENTS' ? { role: 'CLIENT' as const } :
      audience === 'ALL_USERS'   ? { role: { in: ['PARTNER', 'CLIENT'] as ('PARTNER' | 'CLIENT')[] } } :
                                   { role: 'PARTNER' as const }
    const rows = await prisma.user.findMany({ where: roleFilter, select: { id: true } })
    userIds = rows.map(r => r.id)
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

  logger.info('Magic tokens generated', { count: results.length, audience, requirePasswordChange })
  return NextResponse.json({ count: results.length, tokens: results })
}
