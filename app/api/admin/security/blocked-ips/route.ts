import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

function parseExpiresAt(raw: string | undefined): Date | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.nextUrl.searchParams.get('ip')?.trim()
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

  const now = new Date()
  const blockedIps = await prisma.blockedIp.findMany({
    where: {
      ...(ip ? { ipAddress: { contains: ip, mode: 'insensitive' } } : {}),
      ...(includeInactive
        ? {}
        : {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          }),
    },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ blockedIps })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const ipAddress = (body.ipAddress || '').trim()
  const reason = (body.reason || '').trim()

  if (!ipAddress || !reason) {
    return NextResponse.json({ error: 'ipAddress y reason son requeridos' }, { status: 400 })
  }

  const expiresAt = parseExpiresAt(body.expiresAt)
  const block = await prisma.blockedIp.upsert({
    where: { ipAddress },
    update: {
      isActive: true,
      reason,
      blockSource: 'admin',
      blockedBy: admin.email,
      blockedAt: new Date(),
      expiresAt,
      unblockedAt: null,
      unblockedBy: null,
      unblockReason: null,
    },
    create: {
      ipAddress,
      reason,
      blockSource: 'admin',
      isActive: true,
      blockedBy: admin.email,
      blockedAt: new Date(),
      expiresAt,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'security.block_ip',
    entityType: 'BlockedIp',
    entityId: block.id,
    details: `${ipAddress} - ${reason}`,
    request,
  })

  return NextResponse.json({ block }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const ipAddress = (body.ipAddress || '').trim()
  if (!ipAddress) {
    return NextResponse.json({ error: 'ipAddress es requerido' }, { status: 400 })
  }

  const action = body.action
  if (action === 'UNBLOCK') {
    const updated = await prisma.blockedIp.update({
      where: { ipAddress },
      data: {
        isActive: false,
        unblockedAt: new Date(),
        unblockedBy: admin.email,
        unblockReason: (body.unblockReason || '').trim() || 'Sin motivo',
      },
    })

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'security.unblock_ip',
      entityType: 'BlockedIp',
      entityId: updated.id,
      details: `${ipAddress}`,
      request,
    })

    return NextResponse.json({ block: updated })
  }

  if (action === 'UPDATE') {
    const updated = await prisma.blockedIp.update({
      where: { ipAddress },
      data: {
        reason: body.reason ? String(body.reason).trim() : undefined,
        expiresAt:
          body.expiresAt !== undefined ? parseExpiresAt(body.expiresAt ? String(body.expiresAt) : undefined) : undefined,
      },
    })

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'security.update_block_ip',
      entityType: 'BlockedIp',
      entityId: updated.id,
      details: `${ipAddress}`,
      request,
    })

    return NextResponse.json({ block: updated })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
