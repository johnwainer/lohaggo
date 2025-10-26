import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    console.error('Error fetching partner profile:', error)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
