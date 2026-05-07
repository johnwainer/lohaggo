import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { userUpdateSchema } from '@/lib/validation/user-schemas'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-users')

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const where = role ? { role: role as any } : {}

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            serviceRequests: true,
          }
        },
        partnerProfile: {
          select: {
            rating: true,
            totalReviews: true,
            verified: true,
            city: true,
            isActive: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    logger.error('Error fetching users:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const validation = await validateRequest(userUpdateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { userId, role } = validation.data

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role }
    })

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error updating user:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting user:', error || undefined)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
