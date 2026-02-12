import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ flags })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.key || !body?.name) {
    return NextResponse.json({ error: 'key y name requeridos' }, { status: 400 })
  }

  const flag = await prisma.featureFlag.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description || null,
      enabled: Boolean(body.enabled),
      rolloutPercentage: body.rolloutPercentage ?? 100,
      targetRole: body.targetRole || null,
      targetCity: body.targetCity || null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'feature_flag.create',
    entityType: 'FeatureFlag',
    entityId: flag.id,
    details: flag.key,
    request,
  })

  return NextResponse.json({ flag }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const flag = await prisma.featureFlag.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      enabled: body.enabled,
      rolloutPercentage: body.rolloutPercentage,
      targetRole: body.targetRole,
      targetCity: body.targetCity,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'feature_flag.update',
    entityType: 'FeatureFlag',
    entityId: flag.id,
    details: `${flag.key} -> ${flag.enabled ? 'ON' : 'OFF'}`,
    request,
  })

  return NextResponse.json({ flag })
}
