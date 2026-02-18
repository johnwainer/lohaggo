import { NextRequest, NextResponse } from 'next/server'
import type { TaxDocumentStatus, TaxDocumentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

function buildDocumentNumber(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${prefix}-${stamp}-${random}`
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as TaxDocumentStatus | null
  const type = request.nextUrl.searchParams.get('type') as TaxDocumentType | null
  const query = request.nextUrl.searchParams.get('q')?.trim()

  const documents = await prisma.taxDocument.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(query
        ? {
            OR: [
              { documentNumber: { contains: query, mode: 'insensitive' } },
              { generatedBy: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      payment: { select: { id: true, totalAmount: true, status: true, bookingId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return NextResponse.json({ documents })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.type || body?.subtotalAmount === undefined || body?.totalAmount === undefined) {
    return NextResponse.json({ error: 'type, subtotalAmount y totalAmount son requeridos' }, { status: 400 })
  }

  const type = body.type as TaxDocumentType
  const prefix = type === 'WITHHOLDING_CERTIFICATE' ? 'RET' : type === 'CREDIT_NOTE' ? 'NC' : 'FAC'
  const documentNumber = body.documentNumber || buildDocumentNumber(prefix)

  const document = await prisma.taxDocument.create({
    data: {
      documentNumber,
      type,
      status: (body.status as TaxDocumentStatus) || 'PENDING',
      paymentId: body.paymentId || null,
      userId: body.userId || null,
      subtotalAmount: Number(body.subtotalAmount),
      taxAmount: body.taxAmount !== undefined ? Number(body.taxAmount) : 0,
      withholdingAmount: body.withholdingAmount !== undefined ? Number(body.withholdingAmount) : 0,
      totalAmount: Number(body.totalAmount),
      currency: body.currency || 'COP',
      issueDate: body.issueDate ? new Date(body.issueDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sentAt: body.sentAt ? new Date(body.sentAt) : null,
      generatedBy: admin.email,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'tax_document.create',
    entityType: 'TaxDocument',
    entityId: document.id,
    route: '/api/admin/tax-documents',
    details: `${document.type} ${document.documentNumber}`,
    request,
  })

  return NextResponse.json({ document }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const document = await prisma.taxDocument.update({
    where: { id: body.id },
    data: {
      ...(body.status !== undefined ? { status: body.status as TaxDocumentStatus } : {}),
      ...(body.issueDate !== undefined ? { issueDate: body.issueDate ? new Date(body.issueDate) : null } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...(body.sentAt !== undefined ? { sentAt: body.sentAt ? new Date(body.sentAt) : null } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata ? JSON.stringify(body.metadata) : null } : {}),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'tax_document.update',
    entityType: 'TaxDocument',
    entityId: document.id,
    route: '/api/admin/tax-documents',
    details: `${document.type} ${document.status}`,
    request,
  })

  return NextResponse.json({ document })
}
