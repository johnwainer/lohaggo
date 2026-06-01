import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('payment-reject-partner')

const rejectSchema = z.object({
  reason: z.string().min(5).max(500),
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
      return NextResponse.json({ error: 'Solo el socio puede rechazar el pago' }, { status: 403 })
    }

    const body = await request.json()
    const validation = rejectSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Razon de rechazo invalida', details: validation.error.flatten() }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    })
    if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    if (booking.partnerId !== user.partnerProfile.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (!booking.payment) {
      return NextResponse.json({ error: 'No hay reporte de pago para rechazar' }, { status: 400 })
    }

    const payment = await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        confirmationStatus: 'REJECTED_BY_PARTNER',
        status: 'PENDING',
        partnerRejectedAt: new Date(),
        rejectionReason: validation.data.reason,
        clientReportedMethod: null,
        clientReportedAt: null,
        clientReportNote: null,
        partnerConfirmedMethod: null,
        partnerConfirmedAt: null,
        paidAt: null,
      },
    })

    await createNotification({
      userId: booking.userId,
      type: 'PAYMENT_REJECTED_BY_PARTNER',
      title: 'El socio rechazo el pago reportado',
      message: `Motivo: ${validation.data.reason}. Por favor reporta el pago nuevamente desde tu panel.`,
      data: { bookingId: booking.id, kind: 'PAYMENT_REJECTED_BY_PARTNER', reason: validation.data.reason },
    })

    logger.info('Partner rejected payment', { bookingId: booking.id, partnerUserId: user.id })
    return NextResponse.json({ ok: true, payment })
  } catch (error) {
    logger.error('Error rejecting partner payment', error)
    return NextResponse.json({ error: 'Error al rechazar pago' }, { status: 500 })
  }
}
