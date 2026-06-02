import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-confirm-partner')

const confirmSchema = z.object({
  method: z.enum(['CASH', 'DIRECT_TRANSFER']),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.role !== 'PARTNER' || !user.partnerProfile) {
      return NextResponse.json({ error: 'Solo el socio puede confirmar la recepción' }, { status: 403 })
    }

    const body = await request.json()
    const validation = confirmSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: validation.error.flatten() }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true, user: true },
    })
    if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    if (booking.partnerId !== user.partnerProfile.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (booking.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'La reserva debe estar completada' }, { status: 400 })
    }

    const partnerMethod = validation.data.method
    const clientReported = booking.payment?.confirmationStatus === 'CLIENT_REPORTED'

    // Caso A (sin reporte previo del cliente): el socio marca como recibido y la
    // reserva queda confirmada/pagada inmediatamente desde su perspectiva.
    // Caso B (cliente ya reportó): se valida que coincidan los métodos.
    let confirmationStatus: 'CONFIRMED' | 'DISPUTED' = 'CONFIRMED'
    let paymentStatus: 'PENDING' | 'APPROVED' = 'APPROVED'
    let isDisputed = false

    if (clientReported && booking.payment?.clientReportedMethod !== partnerMethod) {
      confirmationStatus = 'DISPUTED'
      paymentStatus = 'PENDING'
      isDisputed = true
    }

    const payment = await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        userId: booking.userId,
        amount: booking.totalPrice,
        serviceAmount: booking.totalPrice,
        clientCommission: 0,
        clientCommissionRate: 0,
        totalAmount: booking.totalPrice,
        status: paymentStatus,
        confirmationStatus,
        partnerConfirmedMethod: partnerMethod,
        partnerConfirmedAt: new Date(),
        paidAt: paymentStatus === 'APPROVED' ? new Date() : undefined,
      },
      update: {
        confirmationStatus,
        status: paymentStatus,
        partnerConfirmedMethod: partnerMethod,
        partnerConfirmedAt: new Date(),
        paidAt: paymentStatus === 'APPROVED' ? new Date() : undefined,
        partnerRejectedAt: null,
        rejectionReason: null,
      },
    })

    if (confirmationStatus === 'CONFIRMED') {
      const wasClientReport = clientReported
      await createNotification({
        userId: booking.userId,
        type: 'PAYMENT_CONFIRMED_BY_PARTNER',
        title: wasClientReport
          ? 'Pago confirmado por el socio'
          : 'El socio marcó tu reserva como pagada',
        message: wasClientReport
          ? 'El socio confirmó la recepción del pago. Tu reserva está marcada como pagada.'
          : 'El socio confirmó haber recibido el pago. Tu reserva queda marcada como pagada.',
        data: { bookingId: booking.id, kind: 'PAYMENT_CONFIRMED' },
      })
    } else if (isDisputed) {
      await createNotification({
        userId: booking.userId,
        type: 'PAYMENT_REJECTED_BY_PARTNER',
        title: 'Discrepancia en el método de pago',
        message: 'El método reportado no coincide con el del socio. Un administrador revisará el caso.',
        data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTED' },
      })

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
      await Promise.all(admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'PAYMENT_REJECTED_BY_PARTNER',
          title: 'Disputa de pago',
          message: `Booking ${booking.id}: cliente reportó ${booking.payment?.clientReportedMethod}, socio reportó ${partnerMethod}.`,
          data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTE_ADMIN_ALERT' },
        })
      ))
    }

    logger.info('Partner confirmed payment', {
      bookingId: booking.id,
      partnerUserId: user.id,
      method: partnerMethod,
      confirmationStatus,
    })

    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    logger.error('Error confirming partner payment', error)
    return NextResponse.json({ error: 'Error al confirmar pago' }, { status: 500 })
  }
}
