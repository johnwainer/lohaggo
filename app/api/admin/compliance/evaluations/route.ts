import { NextRequest, NextResponse } from 'next/server'
import type { ComplianceEvaluationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as ComplianceEvaluationStatus | null
  const partnerId = request.nextUrl.searchParams.get('partnerId')

  const evaluations = await prisma.complianceEvaluation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(partnerId ? { partnerId } : {}),
    },
    include: {
      partner: { select: { id: true, user: { select: { name: true, email: true } }, city: true, verified: true } },
      user: { select: { id: true, name: true, email: true } },
      rule: { select: { id: true, key: true, name: true, ruleType: true } },
    },
    orderBy: { evaluatedAt: 'desc' },
    take: 300,
  })

  return NextResponse.json({ evaluations })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.partnerId || !body?.status || !body?.findings) {
    return NextResponse.json({ error: 'partnerId, status y findings son requeridos' }, { status: 400 })
  }

  const evaluation = await prisma.complianceEvaluation.create({
    data: {
      partnerId: body.partnerId,
      userId: body.userId || null,
      ruleId: body.ruleId || null,
      status: body.status as ComplianceEvaluationStatus,
      score: body.score !== undefined ? Number(body.score) : 0,
      findings: body.findings,
      evaluatedBy: admin.email ?? 'admin',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'compliance_evaluation.create',
    entityType: 'ComplianceEvaluation',
    entityId: evaluation.id,
    route: '/api/admin/compliance/evaluations',
    details: `${evaluation.status} score=${evaluation.score}`,
    request,
  })

  return NextResponse.json({ evaluation }, { status: 201 })
}
