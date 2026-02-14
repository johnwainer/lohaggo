import { NextRequest, NextResponse } from 'next/server'
import type { City, ComplianceRuleType, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await prisma.complianceRule.findMany({
    orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ rules })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.key || !body?.name || !body?.ruleType || !body?.description) {
    return NextResponse.json({ error: 'key, name, ruleType y description son requeridos' }, { status: 400 })
  }

  const rule = await prisma.complianceRule.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description,
      ruleType: body.ruleType as ComplianceRuleType,
      enabled: body.enabled ?? true,
      country: body.country || 'CO',
      city: body.city ? (body.city as City) : null,
      serviceSlug: body.serviceSlug || null,
      partnerRole: body.partnerRole ? (body.partnerRole as UserRole) : 'PARTNER',
      riskThreshold: body.riskThreshold !== undefined ? Number(body.riskThreshold) : null,
      requiredDocuments: body.requiredDocuments ? JSON.stringify(body.requiredDocuments) : null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'compliance_rule.create',
    entityType: 'ComplianceRule',
    entityId: rule.id,
    route: '/api/admin/compliance/rules',
    details: `${rule.key} (${rule.ruleType})`,
    request,
  })

  return NextResponse.json({ rule }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const rule = await prisma.complianceRule.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.ruleType !== undefined ? { ruleType: body.ruleType as ComplianceRuleType } : {}),
      ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
      ...(body.country !== undefined ? { country: body.country || 'CO' } : {}),
      ...(body.city !== undefined ? { city: body.city ? (body.city as City) : null } : {}),
      ...(body.serviceSlug !== undefined ? { serviceSlug: body.serviceSlug || null } : {}),
      ...(body.partnerRole !== undefined ? { partnerRole: body.partnerRole ? (body.partnerRole as UserRole) : null } : {}),
      ...(body.riskThreshold !== undefined ? { riskThreshold: body.riskThreshold !== null ? Number(body.riskThreshold) : null } : {}),
      ...(body.requiredDocuments !== undefined
        ? { requiredDocuments: body.requiredDocuments ? JSON.stringify(body.requiredDocuments) : null }
        : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata ? JSON.stringify(body.metadata) : null } : {}),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'compliance_rule.update',
    entityType: 'ComplianceRule',
    entityId: rule.id,
    route: '/api/admin/compliance/rules',
    details: `${rule.key} enabled=${rule.enabled}`,
    request,
  })

  return NextResponse.json({ rule })
}
