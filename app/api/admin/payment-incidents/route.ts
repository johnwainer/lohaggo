import { NextRequest, NextResponse } from 'next/server'
import type { PaymentIncidentStatus, PaymentIncidentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { calculateSlaDueAt, severityForIncident, supportQueueForIncident } from '@/lib/launch-ops'

async function resolveIncidentRelations(input: {
  paymentId?: string | null
  bookingId?: string | null
  userId?: string | null
  partnerId?: string | null
}) {
  let paymentId = input.paymentId || null
  let bookingId = input.bookingId || null
  let userId = input.userId || null
  let partnerId = input.partnerId || null

  if (!paymentId && !bookingId && !userId && !partnerId) {
    throw new Error('Debes relacionar el incidente al menos con pago, reserva, usuario o socio')
  }

  if (paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        bookingId: true,
        booking: { select: { partnerId: true } },
      },
    })
    if (!payment) throw new Error('paymentId inválido')

    if (bookingId && bookingId !== payment.bookingId) {
      throw new Error('bookingId no coincide con paymentId')
    }
    if (userId && userId !== payment.userId) {
      throw new Error('userId no coincide con paymentId')
    }
    if (partnerId && payment.booking.partnerId && partnerId !== payment.booking.partnerId) {
      throw new Error('partnerId no coincide con el socio de la reserva asociada al pago')
    }

    bookingId = payment.bookingId
    userId = payment.userId
    partnerId = partnerId || payment.booking.partnerId || null
  }

  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, partnerId: true },
    })
    if (!booking) throw new Error('bookingId inválido')

    if (userId && userId !== booking.userId) {
      throw new Error('userId no coincide con bookingId')
    }
    if (partnerId && booking.partnerId && partnerId !== booking.partnerId) {
      throw new Error('partnerId no coincide con bookingId')
    }

    userId = booking.userId
    partnerId = partnerId || booking.partnerId || null
  }

  if (userId) {
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!userExists) throw new Error('userId inválido')
  }

  if (partnerId) {
    const partner = await prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      select: { id: true, userId: true },
    })
    if (!partner) throw new Error('partnerId inválido')

    if (userId && userId === partner.userId) {
      throw new Error('Un incidente no puede usar el mismo usuario como cliente y socio')
    }
  }

  return { paymentId, bookingId, userId, partnerId }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as PaymentIncidentStatus | null
  const type = request.nextUrl.searchParams.get('type') as PaymentIncidentType | null
  const severity = request.nextUrl.searchParams.get('severity') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  const query = request.nextUrl.searchParams.get('q')?.trim()

  const incidents = await prisma.paymentIncident.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { incidentType: type } : {}),
      ...(severity ? { severity } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { assignedTo: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      payment: { select: { id: true, amount: true, totalAmount: true, status: true, mercadopagoId: true } },
      booking: { select: { id: true, status: true, scheduledDate: true, totalPrice: true } },
      user: { select: { id: true, name: true, email: true } },
      partner: { select: { id: true, user: { select: { name: true, email: true } } } },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ incidents })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.title || !body?.description || !body?.incidentType) {
    return NextResponse.json({ error: 'title, description e incidentType son requeridos' }, { status: 400 })
  }

  const incidentType = body.incidentType as PaymentIncidentType
  if ((incidentType === 'PAYMENT_FAILURE' || incidentType === 'CHARGEBACK') && !body.paymentId) {
    return NextResponse.json(
      { error: 'paymentId es obligatorio para incidentes de fallo de pago o contracargo' },
      { status: 400 }
    )
  }

  let relationData: { paymentId: string | null; bookingId: string | null; userId: string | null; partnerId: string | null }
  try {
    relationData = await resolveIncidentRelations({
      paymentId: body.paymentId,
      bookingId: body.bookingId,
      userId: body.userId,
      partnerId: body.partnerId,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Relaciones inválidas' }, { status: 400 })
  }

  const severity = body.severity || severityForIncident(incidentType)
  const slaDueAt = body.slaDueAt ? new Date(body.slaDueAt) : calculateSlaDueAt(severity)

  const incident = await prisma.paymentIncident.create({
    data: {
      ...relationData,
      incidentType,
      severity,
      status: body.status || 'OPEN',
      source: body.source || 'admin',
      title: body.title,
      description: body.description,
      rootCause: body.rootCause || null,
      assignedTo: body.assignedTo || admin.email,
      slaDueAt,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await prisma.paymentIncidentEvent.create({
    data: {
      incidentId: incident.id,
      actorEmail: admin.email,
      action: 'INCIDENT_CREATED',
      note: `Incidente creado por ${admin.email}`,
    },
  })

  await prisma.adminSupportCase.create({
    data: {
      userId: incident.userId,
      bookingId: incident.bookingId,
      priority: incident.severity,
      status: 'OPEN',
      queue: supportQueueForIncident(incidentType),
      subject: `[${incidentType}] ${incident.title}`,
      description: incident.description,
      assignedTo: incident.assignedTo,
      slaDueAt,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'payment_incident.create',
    entityType: 'PaymentIncident',
    entityId: incident.id,
    route: '/api/admin/payment-incidents',
    details: incident.title,
    request,
  })

  return NextResponse.json({ incident }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const current = await prisma.paymentIncident.findUnique({
    where: { id: body.id },
    select: { status: true },
  })
  if (!current) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })

  const nextStatus = body.status as PaymentIncidentStatus | undefined
  if (nextStatus) {
    const allowedTransitions: Record<PaymentIncidentStatus, PaymentIncidentStatus[]> = {
      OPEN: ['INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED'],
      INVESTIGATING: ['ACTION_REQUIRED', 'RESOLVED', 'CLOSED'],
      ACTION_REQUIRED: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'INVESTIGATING'],
      CLOSED: [],
    }
    if (!allowedTransitions[current.status].includes(nextStatus) && nextStatus !== current.status) {
      return NextResponse.json(
        { error: `Transición inválida de ${current.status} a ${nextStatus}` },
        { status: 400 }
      )
    }
  }

  const updateData: {
    status?: PaymentIncidentStatus
    assignedTo?: string | null
    rootCause?: string | null
    resolvedAt?: Date | null
    closedAt?: Date | null
    acknowledgedAt?: Date | null
  } = {
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo || null } : {}),
    ...(body.rootCause !== undefined ? { rootCause: body.rootCause || null } : {}),
  }

  if (nextStatus === 'INVESTIGATING' || nextStatus === 'ACTION_REQUIRED') {
    updateData.acknowledgedAt = new Date()
  }
  if (nextStatus === 'RESOLVED') {
    updateData.resolvedAt = new Date()
  }
  if (nextStatus === 'CLOSED') {
    updateData.closedAt = new Date()
  }

  const incident = await prisma.paymentIncident.update({
    where: { id: body.id },
    data: updateData,
  })

  await prisma.paymentIncidentEvent.create({
    data: {
      incidentId: incident.id,
      actorEmail: admin.email,
      action: 'INCIDENT_UPDATED',
      note: `Estado ${incident.status}${body.note ? ` · ${body.note}` : ''}`,
      metadata: JSON.stringify({
        status: incident.status,
        assignedTo: incident.assignedTo,
      }),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'payment_incident.update',
    entityType: 'PaymentIncident',
    entityId: incident.id,
    route: '/api/admin/payment-incidents',
    details: `Estado: ${incident.status}`,
    request,
  })

  return NextResponse.json({ incident })
}
