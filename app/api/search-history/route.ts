import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeSearchQuery } from '@/lib/filters/searchFilter'
import { expandSearchTerms } from '@/lib/searchSynonyms'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
    return NextResponse.json({ error: 'Error retrieving search history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { query, hasResults } = await request.json()

    const sanitized = sanitizeSearchQuery(query)

    if (!sanitized) {
      return NextResponse.json({
        error: 'Invalid search query',
        message: 'The search term contains inappropriate content or is invalid'
      }, { status: 400 })
    }

    if (hasResults === false) {
      return NextResponse.json({
        message: 'Search with no results was not saved'
      }, { status: 200 })
    }

    const citySlug = request.headers.get('x-city-slug') || 'medellin'
    const searchTerms = expandSearchTerms(sanitized)

    const services = await prisma.service.findMany({
      where: {
        OR: [
          { name: { contains: sanitized, mode: 'insensitive' } },
          { description: { contains: sanitized, mode: 'insensitive' } },
          { category: { name: { contains: sanitized, mode: 'insensitive' } } },
          ...searchTerms.map(term => ({
            name: { contains: term, mode: 'insensitive' }
          }))
        ]
      },
      take: 1
    })

    if (services.length === 0) {
      return NextResponse.json({
        message: 'Search with no results was not saved'
      }, { status: 200 })
    }

    const existingHistory = await prisma.searchHistory.findFirst({
      where: {
        userId: user.id,
        query: sanitized
      }
    })

    if (existingHistory) {
      return NextResponse.json({
        message: 'Search already exists in history'
      }, { status: 200 })
    }

    const searchHistory = await prisma.searchHistory.create({
      data: {
        userId: user.id,
        query: sanitized
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
    return NextResponse.json({ error: 'Error saving search' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
    return NextResponse.json({ error: 'Error deleting search history' }, { status: 500 })
  }
}
