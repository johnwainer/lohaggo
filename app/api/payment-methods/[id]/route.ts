import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'


const logger = createLogger('payment-methods-id')

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Solo clientes pueden acceder' }, { status: 403 })
    }

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id },
    })

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Método de pago no encontrado' }, { status: 404 })
    }

    if (paymentMethod.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (paymentMethod.isDefault) {
      const otherMethods = await prisma.paymentMethod.count({
        where: {
          userId: session.user.id,
          isActive: true,
          id: { not: id },
        },
      })

      if (otherMethods > 0) {
        return NextResponse.json(
          { error: 'No puedes eliminar el método predeterminado. Primero establece otro como predeterminado.' },
          { status: 400 }
        )
      }
    }

    await prisma.paymentMethod.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting payment method:', error || undefined)
    return NextResponse.json(
      { error: 'Error al eliminar método de pago' },
      { status: 500 }
    )
  }
}
