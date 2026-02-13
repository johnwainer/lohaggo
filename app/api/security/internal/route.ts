import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import type { AdminSeverity } from '@prisma/client'

const logger = createLogger('security-internal-api')

export const dynamic = 'force-dynamic'

const AUTO_BLOCK_WINDOW_MINUTES = 10
const AUTO_BLOCK_THRESHOLD = 8
const AUTO_BLOCK_HOURS = 24

function getInternalToken() {
  return env.SECURITY_INTERNAL_TOKEN || env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET
}

function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get('x-security-token')
  const expected = getInternalToken()
  return Boolean(provided && expected && provided === expected)
}

function isBlockedAndValid(blockedIp: { isActive: boolean; expiresAt: Date | null }) {
  if (!blockedIp.isActive) return false
  if (!blockedIp.expiresAt) return true
  return blockedIp.expiresAt > new Date()
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = request.nextUrl.searchParams.get('ip')
  if (!ip) {
    return NextResponse.json({ blocked: false })
  }

  const blockedIp = await prisma.blockedIp.findUnique({
    where: { ipAddress: ip },
    select: {
      ipAddress: true,
      reason: true,
      isActive: true,
      blockedAt: true,
      expiresAt: true,
      unblockReason: true,
      blockSource: true,
    },
  })

  if (!blockedIp || !isBlockedAndValid(blockedIp)) {
    return NextResponse.json({ blocked: false })
  }

  return NextResponse.json({
    blocked: true,
    reason: blockedIp.reason,
    blockSource: blockedIp.blockSource,
    blockedAt: blockedIp.blockedAt,
    expiresAt: blockedIp.expiresAt,
  })
}

type SecurityIngestBody = {
  ipAddress?: string
  path?: string
  method?: string
  query?: string
  userAgent?: string
  threatType?: string
  severity?: AdminSeverity
  source?: string
  statusCode?: number
  metadata?: Record<string, unknown> | null
  shouldEvaluateAutoblock?: boolean
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as SecurityIngestBody
    const ipAddress = (body.ipAddress || '').trim()
    const path = body.path || '/'
    const method = body.method || 'GET'
    const threatType = (body.threatType || '').trim()

    if (!ipAddress || !threatType) {
      return NextResponse.json({ error: 'ipAddress y threatType son requeridos' }, { status: 400 })
    }

    const createdEvent = await prisma.securityEvent.create({
      data: {
        ipAddress,
        path,
        method,
        query: body.query || null,
        userAgent: body.userAgent || null,
        threatType,
        severity: body.severity || 'MEDIUM',
        source: body.source || 'edge-middleware',
        statusCode: body.statusCode ?? null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
      select: { id: true, severity: true, createdAt: true },
    })

    await prisma.blockedIp.updateMany({
      where: { ipAddress, isActive: true },
      data: { lastSeenAt: new Date() },
    })

    let blocked = false
    const shouldEvaluateAutoblock = body.shouldEvaluateAutoblock !== false
    if (shouldEvaluateAutoblock) {
      const cutoff = new Date(Date.now() - AUTO_BLOCK_WINDOW_MINUTES * 60 * 1000)
      const recentHits = await prisma.securityEvent.count({
        where: {
          ipAddress,
          createdAt: { gte: cutoff },
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      })

      if (recentHits >= AUTO_BLOCK_THRESHOLD) {
        const expiresAt = new Date(Date.now() + AUTO_BLOCK_HOURS * 60 * 60 * 1000)
        await prisma.blockedIp.upsert({
          where: { ipAddress },
          update: {
            isActive: true,
            reason: `Auto-bloqueo por ${recentHits} eventos de seguridad (${AUTO_BLOCK_WINDOW_MINUTES}m)`,
            blockSource: 'automation',
            blockedAt: new Date(),
            expiresAt,
            unblockedAt: null,
            unblockedBy: null,
            unblockReason: null,
            lastSeenAt: new Date(),
          },
          create: {
            ipAddress,
            reason: `Auto-bloqueo por ${recentHits} eventos de seguridad (${AUTO_BLOCK_WINDOW_MINUTES}m)`,
            blockSource: 'automation',
            isActive: true,
            blockedAt: new Date(),
            expiresAt,
            lastSeenAt: new Date(),
          },
        })

        await prisma.securityEvent.update({
          where: { id: createdEvent.id },
          data: { blocked: true },
        })
        blocked = true
      }
    }

    return NextResponse.json({ ok: true, blocked })
  } catch (error) {
    logger.error('security ingest failed', { error })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
