import { NextRequest, NextResponse } from 'next/server'
import type { TaxDocumentStatus, TaxDocumentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

function buildDocumentNumber(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${prefix}-${stamp}-${random}`
}

async function resolveTaxDocumentRelations(input: {
  type: TaxDocumentType
  paymentId?: string | null
  userId?: string | null
  totalAmount: number
}) {
  let paymentId = input.paymentId || null
  let userId = input.userId || null
  const { type, totalAmount } = input

  const paymentRequired = type === 'INVOICE' || type === 'CREDIT_NOTE'
  if (paymentRequired && !paymentId) {
    throw new Error('paymentId es obligatorio para factura o nota crédito')
  }
  if (!paymentId && !userId) {
    throw new Error('Debes relacionar el documento a un pago o usuario')
  }

  if (paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, userId: true, totalAmount: true },
    })
    if (!payment) throw new Error('paymentId inválido')
    if (userId && userId !== payment.userId) {
      throw new Error('userId no coincide con paymentId')
    }
    userId = payment.userId

    if (type === 'CREDIT_NOTE' && totalAmount > payment.totalAmount) {
      throw new Error('Una nota crédito no puede superar el total del pago')
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new Error('userId inválido')
  }

  return { paymentId, userId }
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
  const subtotalAmount = Number(body.subtotalAmount)
  const taxAmount = body.taxAmount !== undefined ? Number(body.taxAmount) : 0
  const withholdingAmount = body.withholdingAmount !== undefined ? Number(body.withholdingAmount) : 0
  const totalAmount = Number(body.totalAmount)

  if (![subtotalAmount, taxAmount, withholdingAmount, totalAmount].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Montos inválidos' }, { status: 400 })
  }
  if (subtotalAmount < 0 || taxAmount < 0 || withholdingAmount < 0 || totalAmount < 0) {
    return NextResponse.json({ error: 'Los montos no pueden ser negativos' }, { status: 400 })
  }

  const computedTotal = Number((subtotalAmount + taxAmount - withholdingAmount).toFixed(2))
  const payloadTotal = Number(totalAmount.toFixed(2))
  if (Math.abs(computedTotal - payloadTotal) > 1) {
    return NextResponse.json(
      { error: 'totalAmount debe ser consistente con subtotal + impuesto - retención' },
      { status: 400 }
    )
  }

  let relationData: { paymentId: string | null; userId: string | null }
  try {
    relationData = await resolveTaxDocumentRelations({
      type,
      paymentId: body.paymentId,
      userId: body.userId,
      totalAmount,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Relaciones inválidas' }, { status: 400 })
  }

  const prefix = type === 'WITHHOLDING_CERTIFICATE' ? 'RET' : type === 'CREDIT_NOTE' ? 'NC' : 'FAC'
  const documentNumber = body.documentNumber || buildDocumentNumber(prefix)

  const document = await prisma.taxDocument.create({
    data: {
      documentNumber,
      type,
      status: (body.status as TaxDocumentStatus) || 'PENDING',
      ...relationData,
      subtotalAmount,
      taxAmount,
      withholdingAmount,
      totalAmount,
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

  if (body.status) {
    const current = await prisma.taxDocument.findUnique({
      where: { id: body.id },
      select: { status: true },
    })
    if (!current) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    const nextStatus = body.status as TaxDocumentStatus
    const allowedTransitions: Record<TaxDocumentStatus, TaxDocumentStatus[]> = {
      PENDING: ['GENERATED', 'CANCELLED', 'ERROR'],
      GENERATED: ['SENT', 'ERROR', 'CANCELLED'],
      SENT: ['CANCELLED'],
      CANCELLED: [],
      ERROR: ['PENDING', 'GENERATED', 'CANCELLED'],
    }
    if (!allowedTransitions[current.status].includes(nextStatus) && current.status !== nextStatus) {
      return NextResponse.json(
        { error: `Transición inválida de ${current.status} a ${nextStatus}` },
        { status: 400 }
      )
    }
  }

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
