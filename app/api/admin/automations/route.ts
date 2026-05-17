import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { DEFAULT_AUTOMATION_RULES } from '@/lib/messaging/automation-service'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-automations')

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await prisma.automationRule.findMany({
    orderBy: [{ trigger: 'asc' }, { delayHours: 'asc' }],
    include: {
      _count: { select: { executions: true } },
    },
  })

  // Aggregate execution stats per rule
  const stats = await prisma.automationExecution.groupBy({
    by: ['ruleId', 'status'],
    _count: { id: true },
  })

  const statsByRule: Record<string, Record<string, number>> = {}
  for (const s of stats) {
    if (!statsByRule[s.ruleId]) statsByRule[s.ruleId] = {}
    statsByRule[s.ruleId][s.status] = s._count.id
  }

  const result = rules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    trigger: r.trigger,
    targetRole: r.targetRole,
    delayHours: r.delayHours,
    channels: JSON.parse(r.channels) as string[],
    waTemplateFn: r.waTemplateFn,
    customBody: r.customBody,
    subject: r.subject,
    isActive: r.isActive,
    stats: {
      total: r._count.executions,
      sent: statsByRule[r.id]?.SENT ?? 0,
      failed: statsByRule[r.id]?.FAILED ?? 0,
      pending: statsByRule[r.id]?.PENDING ?? 0,
      skipped: statsByRule[r.id]?.SKIPPED ?? 0,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))

  return NextResponse.json({ rules: result })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Seed defaults
  if (body.action === 'seed') {
    const existing = await prisma.automationRule.count()
    if (existing > 0) {
      return NextResponse.json({ message: 'Rules already exist', count: existing })
    }
    const created = await prisma.automationRule.createMany({
      data: DEFAULT_AUTOMATION_RULES.map((r) => ({
        ...r,
        targetRole: r.targetRole ?? null,
      })),
      skipDuplicates: true,
    })
    logger.info('Seeded default automation rules', { count: created.count, adminId: admin.id })
    return NextResponse.json({ seeded: created.count })
  }

  // Create new rule
  const { name, description, trigger, targetRole, delayHours, channels, waTemplateFn, customBody, subject, isActive } = body

  if (!name || !trigger || !channels?.length) {
    return NextResponse.json({ error: 'name, trigger y channels son requeridos' }, { status: 400 })
  }

  const rule = await prisma.automationRule.create({
    data: {
      name,
      description: description ?? null,
      trigger,
      targetRole: targetRole ?? null,
      delayHours: Number(delayHours ?? 0),
      channels: JSON.stringify(Array.isArray(channels) ? channels : [channels]),
      waTemplateFn: waTemplateFn ?? null,
      customBody: customBody ?? null,
      subject: subject ?? null,
      isActive: Boolean(isActive ?? true),
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const data: any = {}
  if ('name' in updates) data.name = updates.name
  if ('description' in updates) data.description = updates.description
  if ('isActive' in updates) data.isActive = Boolean(updates.isActive)
  if ('delayHours' in updates) data.delayHours = Number(updates.delayHours)
  if ('channels' in updates) data.channels = JSON.stringify(Array.isArray(updates.channels) ? updates.channels : [updates.channels])
  if ('waTemplateFn' in updates) data.waTemplateFn = updates.waTemplateFn ?? null
  if ('customBody' in updates) data.customBody = updates.customBody ?? null
  if ('subject' in updates) data.subject = updates.subject ?? null

  const rule = await prisma.automationRule.update({ where: { id }, data })
  return NextResponse.json({ rule })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await prisma.automationRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
