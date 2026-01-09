
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const totalSearches = await prisma.searchHistory.count({
      where: {
        createdAt: { gte: startDate }
      }
    })

    const uniqueUsers = await prisma.searchHistory.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: { userId: true },
      distinct: ['userId']
    })

    const topSearches = await prisma.searchHistory.groupBy({
      by: ['query'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        query: true
      },
      orderBy: {
        _count: {
          query: 'desc'
        }
      },
      take: 20
    })

    const searchesByDay = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM "SearchHistory"
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `

    const recentSearches = await prisma.searchHistory.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const searchesByUser = await prisma.searchHistory.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        userId: true
      },
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: 10
    })

    const userDetails = await prisma.user.findMany({
      where: {
        id: {
          in: searchesByUser.map(s => s.userId)
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    const topUserSearches = searchesByUser.map(item => {
      const user = userDetails.find(u => u.id === item.userId)
      return {
        userId: item.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        searchCount: item._count.userId
      }
    })

    return NextResponse.json({
      summary: {
        totalSearches,
        uniqueUsers: uniqueUsers.length,
        averageSearchesPerUser: uniqueUsers.length > 0 ? (totalSearches / uniqueUsers.length).toFixed(2) : 0,
        period: `${days} days`
      },
      topSearches: topSearches.map(item => ({
        query: item.query,
        count: item._count.query
      })),
      searchesByDay: searchesByDay.map(item => ({
        date: item.date,
        count: Number(item.count)
      })),
      topUserSearches,
      recentSearches: recentSearches.map(item => ({
        id: item.id,
        query: item.query,
        userName: item.user.name,
        userEmail: item.user.email,
        createdAt: item.createdAt
      }))
    })
  } catch (error) {
    console.error('Error fetching search analytics:', error)
    return NextResponse.json({ error: 'Error retrieving analytics' }, { status: 500 })
  }
}
