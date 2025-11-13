import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, active, order } = body

    const city = await prisma.cityConfig.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order })
      }
    })

    return NextResponse.json(city)
  } catch (error) {
    console.error('Error updating city:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.cityConfig.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'City deleted successfully' })
  } catch (error) {
    console.error('Error deleting city:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
