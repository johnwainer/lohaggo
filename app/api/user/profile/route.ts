import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { userProfileSchema, validateRequest, sanitizeUrl } from '@/lib/validation'
import { normalizePhone } from '@/lib/phone'


const logger = createLogger('user-profile')

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const validation = await validateRequest(userProfileSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { name, phone, email } = validation.data

    const updateData: any = { name }

    if (phone) {
      updateData.phone = normalizePhone(phone as string)
    }

    if (body.image !== undefined) {
      if (body.image) {
        try {
          updateData.image = sanitizeUrl(body.image)
        } catch {
          return NextResponse.json({ error: 'URL de imagen inválida' }, { status: 400 })
        }
      } else {
        updateData.image = null
      }
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        phone: true
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    logger.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 })
  }
}
