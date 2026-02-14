import { NextRequest, NextResponse } from 'next/server'
import type { AdminSeverity, SupportQueue } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { calculateSlaDueAt } from '@/lib/launch-ops'

type PlaybookAction = 'TEMP_BLOCK_IP' | 'ESCALATE_REVIEW' | 'CREATE_SUPPORT_CASE'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body.action as PlaybookAction
  if (!action) return NextResponse.json({ error: 'action es requerido' }, { status: 400 })

  const results: Record<string, unknown> = {}

  if (action === 'TEMP_BLOCK_IP') {
    const ipAddress = String(body.ipAddress || '').trim()
    if (!ipAddress) return NextResponse.json({ error: 'ipAddress es requerido' }, { status: 400 })

    const hours = Number(body.hours || 24)
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
    const block = await prisma.blockedIp.upsert({
      where: { ipAddress },
      update: {
        isActive: true,
        reason: body.reason || 'Bloqueo temporal por playbook',
        blockSource: 'playbook',
        blockedBy: admin.email,
        blockedAt: new Date(),
        expiresAt,
        unblockedAt: null,
        unblockedBy: null,
        unblockReason: null,
      },
      create: {
        ipAddress,
        reason: body.reason || 'Bloqueo temporal por playbook',
        blockSource: 'playbook',
        isActive: true,
        blockedBy: admin.email,
        expiresAt,
      },
    })
    results.blockedIp = block
  }

  if (action === 'ESCALATE_REVIEW' || action === 'CREATE_SUPPORT_CASE') {
    const severity = (body.severity || 'HIGH') as AdminSeverity
    const queue = (body.queue || 'RISK') as SupportQueue
    const supportCase = await prisma.adminSupportCase.create({
      data: {
        userId: body.userId || null,
        bookingId: body.bookingId || null,
        requestId: body.requestId || null,
        priority: severity,
        status: 'OPEN',
        queue,
        subject: body.subject || `Playbook ${action}`,
        description: body.description || 'Caso creado desde playbook de riesgo',
        assignedTo: body.assignedTo || admin.email,
        slaDueAt: calculateSlaDueAt(severity),
      },
    })
    results.supportCase = supportCase
  }

  if (body.fraudSignalId) {
    const signal = await prisma.fraudSignal.update({
      where: { id: body.fraudSignalId },
      data: {
        status: 'ACKNOWLEDGED',
        details: body.signalNote || 'Procesado por playbook',
      },
    })
    results.fraudSignal = signal
  }

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: `risk.playbook.${action.toLowerCase()}`,
    entityType: 'RiskPlaybook',
    route: '/api/admin/risk/playbook',
    details: JSON.stringify({ action, ip: body.ipAddress || null }),
    request,
  })

  return NextResponse.json({ ok: true, results })
}
