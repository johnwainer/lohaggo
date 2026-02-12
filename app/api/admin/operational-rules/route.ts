import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { ensureDefaultOperationalRules } from '@/lib/admin-defaults'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureDefaultOperationalRules()

  const rules = await prisma.operationalRule.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ rules })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.key || !body?.name || !body?.threshold) {
    return NextResponse.json({ error: 'key, name, threshold requeridos' }, { status: 400 })
  }

  const rule = await prisma.operationalRule.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description || null,
      enabled: body.enabled ?? true,
      threshold: body.threshold,
      windowMinutes: body.windowMinutes ?? 5,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'operational_rule.create',
    entityType: 'OperationalRule',
    entityId: rule.id,
    details: rule.key,
    request,
  })

  return NextResponse.json({ rule }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const rule = await prisma.operationalRule.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      enabled: body.enabled,
      threshold: body.threshold,
      windowMinutes: body.windowMinutes,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'operational_rule.update',
    entityType: 'OperationalRule',
    entityId: rule.id,
    details: `${rule.key}: ${rule.enabled ? 'enabled' : 'disabled'}`,
    request,
  })

  return NextResponse.json({ rule })
}
