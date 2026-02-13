import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { authOptions } from '@/lib/auth'
import { env } from '@/lib/env'


const logger = createLogger('admin-delete-last-payment')

export async function DELETE() {
  try {
    // Esta ruta es destructiva y no debe estar habilitada en producción.
    if (env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Operación no permitida en producción' },
        { status: 403 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Obtener el último pago
    const lastPayment = await prisma.payment.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        booking: {
          include: {
            service: true,
            user: true,
          },
        },
        payout: true,
      },
    })

    if (!lastPayment) {
      return NextResponse.json(
        { error: 'No se encontraron pagos en la base de datos' },
        { status: 404 }
      )
    }

    const paymentInfo = {
      id: lastPayment.id,
      bookingId: lastPayment.bookingId,
      cliente: lastPayment.booking.user.name,
      servicio: lastPayment.booking.service.name,
      monto: lastPayment.totalAmount,
      estado: lastPayment.status,
    }

    // Eliminar el payout asociado si existe
    if (lastPayment.payout) {
      await prisma.payout.delete({
        where: { id: lastPayment.payout.id },
      })
    }

    // Eliminar el pago
    await prisma.payment.delete({
      where: { id: lastPayment.id },
    })

    // Actualizar el estado del booking a PENDING
    await prisma.booking.update({
      where: { id: lastPayment.bookingId },
      data: {
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      message: 'Pago eliminado exitosamente',
      payment: paymentInfo,
    })
  } catch (error) {
    logger.error('Error al eliminar pago:', error || undefined)
    return NextResponse.json(
      { error: 'Error al eliminar el pago' },
      { status: 500 }
    )
  }
}
