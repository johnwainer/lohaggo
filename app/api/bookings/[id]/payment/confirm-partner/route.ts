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
      return NextResponse.json({ error: 'Solo el socio puede confirmar la recepcion' }, { status: 403 })
    }

    const body = await request.json()
    const validation = confirmSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos invalidos', details: validation.error.flatten() }, { status: 400 })
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

    let confirmationStatus: 'CONFIRMED' | 'PARTNER_REPORTED' | 'DISPUTED' = 'PARTNER_REPORTED'
    let paymentStatus: 'PENDING' | 'APPROVED' = 'PENDING'
    let isDisputed = false

    if (clientReported) {
      if (booking.payment?.clientReportedMethod === partnerMethod) {
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
      await createNotification({
        userId: booking.userId,
        type: 'BOOKING_COMPLETED',
        title: 'Pago confirmado por el socio',
        message: `El socio confirmo la recepcion del pago. Tu reserva esta marcada como pagada.`,
        data: { bookingId: booking.id, kind: 'PAYMENT_CONFIRMED' },
      })
    } else if (confirmationStatus === 'PARTNER_REPORTED') {
      await createNotification({
        userId: booking.userId,
        type: 'BOOKING_COMPLETED',
        title: 'El socio reporto haber recibido el pago',
        message: 'Confirma desde tu panel para cerrar la reserva.',
        data: { bookingId: booking.id, method: partnerMethod, kind: 'PAYMENT_REPORTED_BY_PARTNER' },
      })
    } else if (isDisputed) {
      await createNotification({
        userId: booking.userId,
        type: 'BOOKING_COMPLETED',
        title: 'Discrepancia en el metodo de pago',
        message: 'El metodo reportado no coincide con el del socio. Un administrador revisara el caso.',
        data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTED' },
      })

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
      await Promise.all(admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'BOOKING_COMPLETED',
          title: 'Disputa de pago',
          message: `Booking ${booking.id}: cliente reporto ${booking.payment?.clientReportedMethod}, socio reporto ${partnerMethod}.`,
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
