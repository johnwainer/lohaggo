import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('addresses-id')

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addressId = params.id
    const body = await request.json()
    const { label, street, number, complement, neighborhood, city, postalCode, instructions, isPrimary } = body

    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: session.user.id
      }
    })

    if (!existingAddress) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
    }

    if (isPrimary) {
      await prisma.address.updateMany({
        where: {
          userId: session.user.id,
          isPrimary: true,
          id: { not: addressId }
        },
        data: {
          isPrimary: false
        }
      })
    }

    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: {
        label,
        street,
        number,
        complement,
        neighborhood,
        city,
        postalCode,
        instructions,
        isPrimary
      }
    })

    return NextResponse.json(updatedAddress)
  } catch (error) {
    logger.error('Error updating address:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar dirección' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addressId = params.id

    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: session.user.id
      }
    })

    if (!existingAddress) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
    }

    await prisma.address.update({
      where: { id: addressId },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Dirección eliminada exitosamente' })
  } catch (error) {
    logger.error('Error deleting address:', error || undefined)
    return NextResponse.json({ error: 'Error al eliminar dirección' }, { status: 500 })
  }
}
