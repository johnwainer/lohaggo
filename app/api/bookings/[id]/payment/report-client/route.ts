import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-report-client')

const reportSchema = z.object({
  method: z.enum(['CASH', 'DIRECT_TRANSFER']),
  note: z.string().max(500).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Solo el cliente puede reportar el pago' }, { status: 403 })
    }

    const body = await request.json()
    const validation = reportSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos invalidos', details: validation.error.flatten() }, { status: 400 })
    }

    const config = await prisma.platformConfig.findFirst({
      select: { cashEnabled: true, transferEnabled: true },
    })
    if (validation.data.method === 'CASH' && !config?.cashEnabled) {
      return NextResponse.json({ error: 'El pago en efectivo no esta habilitado' }, { status: 400 })
    }
    if (validation.data.method === 'DIRECT_TRANSFER' && !config?.transferEnabled) {
      return NextResponse.json({ error: 'La transferencia directa no esta habilitada' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true, partner: { include: { user: true } } },
    })
    if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (booking.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'La reserva debe estar completada para reportar el pago' }, { status: 400 })
    }

    const partnerAlreadyReported = booking.payment?.confirmationStatus === 'PARTNER_REPORTED'
    const matchesPartner = partnerAlreadyReported && booking.payment?.partnerConfirmedMethod === validation.data.method

    let confirmationStatus: 'CLIENT_REPORTED' | 'CONFIRMED' | 'DISPUTED' = 'CLIENT_REPORTED'
    let paymentStatus: 'PENDING' | 'APPROVED' = 'PENDING'
    let isDisputed = false

    if (partnerAlreadyReported) {
      if (matchesPartner) {
        confirmationStatus = 'CONFIRMED'
        paymentStatus = 'APPROVED'
      } else {
        confirmationStatus = 'DISPUTED'
        isDisputed = true
      }
    }

    const payment = await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        userId: user.id,
        amount: booking.totalPrice,
        serviceAmount: booking.totalPrice,
        clientCommission: 0,
        clientCommissionRate: 0,
        totalAmount: booking.totalPrice,
        status: paymentStatus,
        confirmationStatus,
        clientReportedMethod: validation.data.method,
        clientReportedAt: new Date(),
        clientReportNote: validation.data.note,
        paidAt: paymentStatus === 'APPROVED' ? new Date() : undefined,
      },
      update: {
        confirmationStatus,
        status: paymentStatus,
        clientReportedMethod: validation.data.method,
        clientReportedAt: new Date(),
        clientReportNote: validation.data.note,
        paidAt: paymentStatus === 'APPROVED' ? new Date() : undefined,
        partnerRejectedAt: null,
        rejectionReason: null,
      },
    })

    if (confirmationStatus === 'CONFIRMED' && booking.partner?.user) {
      await createNotification({
        userId: booking.partner.user.id,
        type: 'PAYMENT_CONFIRMED_BY_PARTNER',
        title: 'Pago confirmado por el cliente',
        message: 'El cliente confirmo el metodo de pago. La reserva esta marcada como pagada.',
        data: { bookingId: booking.id, kind: 'PAYMENT_CONFIRMED' },
      })
    } else if (confirmationStatus === 'CLIENT_REPORTED' && booking.partner?.user) {
      await createNotification({
        userId: booking.partner.user.id,
        type: 'PAYMENT_REPORTED_BY_CLIENT',
        title: 'Cliente reporto el pago',
        message: `El cliente reporto haber pagado en ${validation.data.method === 'CASH' ? 'efectivo' : 'transferencia'}. Confirma la recepcion.`,
        data: { bookingId: booking.id, method: validation.data.method, kind: 'PAYMENT_REPORTED_BY_CLIENT' },
      })
    } else if (isDisputed) {
      if (booking.partner?.user) {
        await createNotification({
          userId: booking.partner.user.id,
          type: 'PAYMENT_REJECTED_BY_PARTNER',
          title: 'Discrepancia en el metodo de pago',
          message: 'El metodo reportado por el cliente no coincide con el tuyo. Un administrador revisara el caso.',
          data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTED' },
        })
      }
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
      await Promise.all(admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'PAYMENT_REJECTED_BY_PARTNER',
          title: 'Disputa de pago',
          message: `Booking ${booking.id}: cliente reporto ${validation.data.method}, socio habia reportado ${booking.payment?.partnerConfirmedMethod}.`,
          data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTE_ADMIN_ALERT' },
        })
      ))
    }

    logger.info('Client reported payment', { bookingId: booking.id, userId: user.id, method: validation.data.method })

    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    logger.error('Error reporting client payment', error)
    return NextResponse.json({ error: 'Error al reportar pago' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Solo el cliente puede des-reportar' }, { status: 403 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    })
    if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    if (booking.userId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (!booking.payment || booking.payment.confirmationStatus !== 'CLIENT_REPORTED') {
      return NextResponse.json({ error: 'No hay reporte para des-hacer' }, { status: 400 })
    }

    const payment = await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        confirmationStatus: 'NONE',
        clientReportedMethod: null,
        clientReportedAt: null,
        clientReportNote: null,
      },
    })

    logger.info('Client un-reported payment', { bookingId: booking.id, userId: user.id })
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    logger.error('Error un-reporting client payment', error)
    return NextResponse.json({ error: 'Error al des-reportar pago' }, { status: 500 })
  }
}
