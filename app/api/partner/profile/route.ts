import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'


const logger = createLogger('partner-profile')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        partnerProfile: {
          include: {
            services: {
              include: {
                service: true
              }
            },
            documents: true
          }
        }
      }
    })

    if (!user?.partnerProfile) {
      return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    }

    return NextResponse.json(user.partnerProfile)
  } catch (error) {
    logger.error('Error fetching partner profile:', error)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { isCompany, companyName, companyNit } = body

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
    })
    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const updated = await prisma.partnerProfile.update({
      where: { userId: session.user.id },
      data: {
        ...(typeof isCompany === 'boolean' ? { isCompany } : {}),
        ...(companyName !== undefined ? { companyName: companyName?.trim() || null } : {}),
        ...(companyNit !== undefined ? { companyNit: companyNit?.trim() || null } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Error updating partner profile:', error)
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })
  }
}
