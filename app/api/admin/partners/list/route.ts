import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        documents: {
          where: { status: 'APPROVED' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(partners)
  } catch (error) {
    console.error('Error fetching partners:', error)
    return NextResponse.json({ error: 'Error al obtener socios' }, { status: 500 })
  }
}
