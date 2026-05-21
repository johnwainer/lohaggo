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
    metadata: r.metadata,
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

  // Seed defaults — upsert selectivo: solo inserta reglas que no existan por nombre
  if (body.action === 'seed') {
    const existingNames = new Set(
      (await prisma.automationRule.findMany({ select: { name: true } })).map(r => r.name)
    )
    const toInsert = DEFAULT_AUTOMATION_RULES.filter(r => !existingNames.has(r.name))
    if (toInsert.length === 0) {
      return NextResponse.json({ seeded: 0, message: 'Todas las reglas por defecto ya existen' })
    }
    const created = await prisma.automationRule.createMany({
      data: toInsert.map(r => ({ ...r, targetRole: r.targetRole ?? null })),
      skipDuplicates: true,
    })
    logger.info('Seeded default automation rules', { count: created.count, adminId: admin.id })
    return NextResponse.json({ seeded: created.count })
  }

  // Reseed — upsert todos los defaults por nombre (actualiza mensajes/canales existentes)
  if (body.action === 'reseed') {
    let updated = 0, inserted = 0
    for (const rule of DEFAULT_AUTOMATION_RULES) {
      const existing = await prisma.automationRule.findFirst({ where: { name: rule.name } })
      if (existing) {
        await prisma.automationRule.update({
          where: { id: existing.id },
          data: {
            description: rule.description,
            trigger: rule.trigger,
            targetRole: rule.targetRole ?? null,
            delayHours: rule.delayHours,
            channels: rule.channels,
            waTemplateFn: rule.waTemplateFn,
            subject: rule.subject,
            customBody: rule.customBody,
          },
        })
        updated++
      } else {
        await prisma.automationRule.create({ data: { ...rule, targetRole: rule.targetRole ?? null } })
        inserted++
      }
    }
    logger.info('Reseeded automation rules', { updated, inserted, adminId: admin.id })
    return NextResponse.json({ updated, inserted })
  }

  // Create new rule
  const { name, description, trigger, targetRole, delayHours, channels, waTemplateFn, customBody, subject, isActive, metadata } = body

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
      metadata: metadata ?? null,
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
  if ('metadata' in updates) data.metadata = updates.metadata ?? null
  if ('targetRole' in updates) data.targetRole = updates.targetRole ?? null

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
