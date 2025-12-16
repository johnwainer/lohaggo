import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { paymentRateLimiter } from '@/lib/rate-limit'
import { paymentProcessSchema, validateRequest } from '@/lib/validation'

const logger = createLogger('payments-process')

async function handlePOST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const validation = await validateRequest(paymentProcessSchema, body)

    if (!validation.success) {
      return validation.error
    }

    const { bookingId, paymentMethodId } = validation.data

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        user: true,
        payment: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (booking.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Solo se pueden pagar servicios completados' },
        { status: 400 }
      )
    }

    if (booking.payment && booking.payment.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Esta reserva ya ha sido pagada' },
        { status: 400 }
      )
    }

    let clientCommissionRate: number
    let partnerCommissionRate: number

    if (
      booking.clientCommissionRate !== null &&
      booking.clientCommissionRate !== undefined &&
      booking.partnerCommissionRate !== null &&
      booking.partnerCommissionRate !== undefined
    ) {
      clientCommissionRate = Number(booking.clientCommissionRate)
      partnerCommissionRate = Number(booking.partnerCommissionRate)
      logger.debug('Using saved commission rates from booking', {
        bookingId,
        rateSource: 'booking'
      })
    } else {
      const config = await prisma.platformConfig.findFirst()
      if (!config) {
        return NextResponse.json(
          { error: 'Configuración de la plataforma no encontrada' },
          { status: 500 }
        )
      }
      clientCommissionRate = Number(config.clientCommissionRate)
      partnerCommissionRate = Number(config.partnerCommissionRate)
      logger.warn('Using current platform commission rates', {
        bookingId,
        rateSource: 'platform'
      })
    }

    const serviceAmount = booking.totalPrice
    const clientCommission = (serviceAmount * clientCommissionRate) / 100
    const totalAmount = serviceAmount + clientCommission

    logger.info('Processing payment', {
      bookingId,
      userId: session.user.id,
      clientCommissionRate,
      partnerCommissionRate,
    })

    let paymentId: string

    if (booking.payment) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: 'APPROVED',
          paymentMethodId: paymentMethodId || null,
          amount: totalAmount,
          serviceAmount,
          clientCommission,
          clientCommissionRate,
          totalAmount, // Redundant but kept for consistency with original code if needed, or just remove duplicate key in object literal if strict
          paidAt: new Date(),
          paymentMethodType: 'credit_card',
          paymentType: 'credit_card',
          transactionAmount: totalAmount,
          netReceivedAmount: totalAmount * 0.95,
          mercadopagoFee: totalAmount * 0.05,
        },
      })
      paymentId = booking.payment.id
    } else {
      const newPayment = await prisma.payment.create({
        data: {
          bookingId,
          userId: session.user.id,
          paymentMethodId: paymentMethodId || null,
          status: 'APPROVED',
          amount: totalAmount,
          serviceAmount,
          clientCommission,
          clientCommissionRate,
          totalAmount,
          paidAt: new Date(),
          paymentMethodType: 'credit_card',
          paymentType: 'credit_card',
          transactionAmount: totalAmount,
          netReceivedAmount: totalAmount * 0.95,
          mercadopagoFee: totalAmount * 0.05,
        },
      })
      paymentId = newPayment.id
    }

    if (booking.partnerId) {
      const partnerCommission = (serviceAmount * partnerCommissionRate) / 100
      const netAmount = serviceAmount - partnerCommission

      const existingPayout = await prisma.payout.findUnique({
        where: { paymentId },
      })

      if (!existingPayout) {
        await prisma.payout.create({
          data: {
            paymentId,
            partnerId: booking.partnerId,
            amount: serviceAmount,
            partnerCommission,
            partnerCommissionRate,
            netAmount,
            status: 'PENDING',
          },
        })
      }

      await prisma.partnerProfile.update({
        where: { id: booking.partnerId },
        data: {
          completedServicesCount: {
            increment: 1
          }
        }
      })
    }

    await prisma.user.update({
      where: { id: booking.userId },
      data: {
        completedServicesCount: {
          increment: 1
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pago procesado exitosamente',
      amount: totalAmount,
    })
  } catch (error) {
    logger.error('Error processing payment', error)
    return NextResponse.json(
      { error: 'Error al procesar el pago' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return paymentRateLimiter(req, handlePOST);
}
