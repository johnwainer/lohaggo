import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addresses = await prisma.address.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(addresses)
  } catch (error) {
    console.error('Error fetching addresses:', error)
    return NextResponse.json({ error: 'Error al obtener direcciones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { label, street, number, complement, neighborhood, city, postalCode, instructions, isPrimary } = body

    if (!label || !street || !number || !neighborhood || !city) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (isPrimary) {
      await prisma.address.updateMany({
        where: {
          userId: session.user.id,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      })
    }

    const address = await prisma.address.create({
      data: {
        userId: session.user.id,
        label,
        street,
        number,
        complement,
        neighborhood,
        city,
        postalCode,
        instructions,
        isPrimary: isPrimary || false
      }
    })

    return NextResponse.json(address, { status: 201 })
  } catch (error) {
    console.error('Error creating address:', error)
    return NextResponse.json({ error: 'Error al crear dirección' }, { status: 500 })
  }
}
