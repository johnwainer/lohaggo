import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cities = await prisma.cityConfig.findMany({
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(cities)
  } catch (error) {
    console.error('Error fetching cities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, status, order, latitude, longitude, lanzamiento, fechaLanzamiento } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    const city = await prisma.cityConfig.create({
      data: {
        name,
        slug,
        status: status ?? 'ACTIVE',
        order: order ?? 0,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        lanzamiento: lanzamiento ?? false,
        fechaLanzamiento: fechaLanzamiento ? new Date(fechaLanzamiento) : null
      }
    })

    return NextResponse.json(city, { status: 201 })
  } catch (error) {
    console.error('Error creating city:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
