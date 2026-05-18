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
 * Admin-only. Generates magic login tokens for a list of user IDs (or all unverified partners).
 * Body: { userIds?: string[], redirectUrl?: string }
 * Returns: { tokens: Array<{ userId, token, url }> }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const redirectUrl: string = body.redirectUrl ?? '/partner/verification'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''

  // Resolve target users — explicit list or all unverified partners
  let userIds: string[] = []

  if (Array.isArray(body.userIds) && body.userIds.length > 0) {
    userIds = body.userIds
  } else {
    // All partner users whose identity + background docs are NOT yet fully approved.
    // Query from User (not partnerProfile) to include partners with missing/inactive profiles.
    const allPartners = await prisma.user.findMany({
      where: { role: 'PARTNER' },
      select: { id: true },
    })

    const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

    const verifiedPartnerUserIds = new Set(
      (await prisma.partnerProfile.findMany({
        where: {
          AND: [
            { documents: { some: { type: { in: IDENTITY_TYPES as any }, status: 'APPROVED' } } },
            { documents: { some: { type: 'ANTECEDENTES', status: 'APPROVED' } } },
          ],
        },
        select: { userId: true },
      })).map(p => p.userId)
    )

    userIds = allPartners.map(p => p.id).filter(id => !verifiedPartnerUserIds.has(id))
  }

  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000)
  const results: Array<{ userId: string; token: string; url: string }> = []

  for (const userId of userIds) {
    try {
      const token = randomBytes(32).toString('hex')

      await prisma.magicToken.create({
        data: { userId, token, redirectUrl, expiresAt },
      })

      results.push({
        userId,
        token,
        url: `${appUrl}/auth/magic?token=${token}`,
      })
    } catch (err) {
      logger.error('Failed to generate magic token', { userId, err })
    }
  }

  logger.info('Magic tokens generated', { count: results.length })
  return NextResponse.json({ count: results.length, tokens: results })
}
