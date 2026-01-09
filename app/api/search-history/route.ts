import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const searchHistory = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      distinct: ['query']
    })

    return NextResponse.json(searchHistory)
  } catch (error) {
    console.error('Error fetching search history:', error)
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { query } = await request.json()

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Búsqueda inválida' }, { status: 400 })
    }

    const searchHistory = await prisma.searchHistory.create({
      data: {
        userId: user.id,
        query: query.trim()
      }
    })

    await prisma.searchHistory.deleteMany({
      where: {
        userId: user.id,
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    return NextResponse.json(searchHistory)
  } catch (error) {
    console.error('Error saving search history:', error)
    return NextResponse.json({ error: 'Error al guardar búsqueda' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      await prisma.searchHistory.delete({
        where: { 
          id,
          userId: user.id
        }
      })
    } else {
      await prisma.searchHistory.deleteMany({
        where: { userId: user.id }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting search history:', error)
    return NextResponse.json({ error: 'Error al eliminar historial' }, { status: 500 })
  }
}
