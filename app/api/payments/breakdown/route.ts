import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { bookingId } = await req.json()

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId es requerido' },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      )
    }

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const config = await prisma.platformConfig.findFirst()

    if (!config) {
      return NextResponse.json(
        { error: 'Configuración de la plataforma no encontrada' },
        { status: 500 }
      )
    }

    const clientCommissionRate = Number(config.clientCommissionRate)
    const serviceAmount = booking.totalPrice
    const clientCommission = (serviceAmount * clientCommissionRate) / 100
    const totalAmount = serviceAmount + clientCommission

    return NextResponse.json({
      breakdown: {
        serviceAmount,
        clientCommission,
        clientCommissionRate,
        totalAmount,
      },
    })
  } catch (error) {
    console.error('Error al calcular desglose:', error)
    return NextResponse.json(
      { error: 'Error al calcular el desglose' },
      { status: 500 }
    )
  }
}
