import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('magic-generate')

const TTL_HOURS = 72

const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

/**
 * POST /api/auth/magic/generate
 * Admin-only. Generates magic login tokens.
 * Body:
 *   userIds?:               string[]   — explicit list; omit for bulk audience
 *   audience?:              'PARTNERS_WITHOUT_DOCS' | 'ALL_PARTNERS' | 'ALL_CLIENTS' | 'ALL_USERS'
 *   redirectUrl?:           string     — where to send after login (default /partner/verification)
 *   requirePasswordChange?: boolean    — whether to show the change-password banner (default false)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const redirectUrl: string = body.redirectUrl ?? '/partner/verification'
  const requirePasswordChange: boolean = Boolean(body.requirePasswordChange)
  const audience: string = body.audience ?? 'PARTNERS_WITHOUT_DOCS'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''

  let userIds: string[] = []

  if (Array.isArray(body.userIds) && body.userIds.length > 0) {
    userIds = body.userIds
  } else {
    switch (audience) {
      case 'ALL_PARTNERS': {
        const rows = await prisma.user.findMany({ where: { role: 'PARTNER' }, select: { id: true } })
        userIds = rows.map(r => r.id)
        break
      }
      case 'ALL_CLIENTS': {
        const rows = await prisma.user.findMany({ where: { role: 'CLIENT' }, select: { id: true } })
        userIds = rows.map(r => r.id)
        break
      }
      case 'ALL_USERS': {
        const rows = await prisma.user.findMany({ where: { role: { in: ['PARTNER', 'CLIENT'] } }, select: { id: true } })
        userIds = rows.map(r => r.id)
        break
      }
      default: { // PARTNERS_WITHOUT_DOCS
        const allPartners = await prisma.user.findMany({ where: { role: 'PARTNER' }, select: { id: true } })
        const verifiedIds = new Set(
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
        userIds = allPartners.map(p => p.id).filter(id => !verifiedIds.has(id))
        break
      }
    }
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
