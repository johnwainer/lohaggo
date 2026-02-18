import { NextRequest, NextResponse } from 'next/server'
import { UserRole, type City } from '@prisma/client'

import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { expandSearchTerms } from '@/lib/searchSynonyms'

type DayRow = { day: Date; count: bigint }
type HourRow = { hour: number; count: bigint }

const DAY_IN_MS = 24 * 60 * 60 * 1000
const ALLOWED_WINDOWS = new Set([7, 30, 90, 365])

function normalizeDays(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '30', 10)
  if (!Number.isFinite(parsed)) return 30
  return ALLOWED_WINDOWS.has(parsed) ? parsed : 30
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Number((((current - previous) / previous) * 100).toFixed(2))
}

function formatCityLabel(city?: City | null): string {
  if (!city) return 'Sin ciudad'
  return city
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildServiceSearchWhere(query: string) {
  const terms = expandSearchTerms(query).slice(0, 8)

  const nameMatches = terms.map((term) => ({
    name: { contains: term, mode: 'insensitive' as const },
  }))

  const descriptionMatches = terms.map((term) => ({
    description: { contains: term, mode: 'insensitive' as const },
  }))

  return {
    OR: [
      { name: { contains: query, mode: 'insensitive' as const } },
      { description: { contains: query, mode: 'insensitive' as const } },
      { category: { name: { contains: query, mode: 'insensitive' as const } } },
      ...nameMatches,
      ...descriptionMatches,
    ],
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = normalizeDays(searchParams.get('days'))

    const now = new Date()
    const endDate = new Date(now)
    const startDate = new Date(now.getTime() - days * DAY_IN_MS)
    const previousStartDate = new Date(startDate.getTime() - days * DAY_IN_MS)

    const [
      totalSearches,
      previousPeriodSearches,
      uniqueUsersRows,
      uniqueQueriesRows,
      topQueriesRaw,
      recentSearchesRaw,
      byUserRaw,
      byDayRaw,
      byHourRaw,
    ] = await Promise.all([
      prisma.searchHistory.count({ where: { createdAt: { gte: startDate } } }),
      prisma.searchHistory.count({ where: { createdAt: { gte: previousStartDate, lt: startDate } } }),
      prisma.searchHistory.findMany({
        where: { createdAt: { gte: startDate } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.searchHistory.groupBy({
        by: ['query'],
        where: { createdAt: { gte: startDate } },
      }),
      prisma.searchHistory.groupBy({
        by: ['query'],
        where: { createdAt: { gte: startDate } },
        _count: { query: true },
        orderBy: { _count: { query: 'desc' } },
        take: 50,
      }),
      prisma.searchHistory.findMany({
        where: { createdAt: { gte: startDate } },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
              partnerProfile: { select: { city: true } },
              addresses: {
                select: { city: true, isPrimary: true, createdAt: true },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      prisma.searchHistory.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: startDate } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 25,
      }),
      prisma.$queryRaw<DayRow[]>`
        SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
        FROM "SearchHistory"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
        FROM "SearchHistory"
        WHERE "createdAt" >= ${startDate}
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour ASC
      `,
    ])

    const topQueries = topQueriesRaw.map((row) => ({
      query: row.query,
      count: row._count.query,
      length: row.query.trim().length,
      words: row.query.trim().split(/\s+/).filter(Boolean).length,
    }))

    const queryCoverage = await Promise.all(
      topQueries.map(async (entry) => {
        const where = buildServiceSearchWhere(entry.query)

        const [matchingServices, matchingPartners] = await Promise.all([
          prisma.service.count({ where }),
          prisma.partnerService.count({
            where: {
              active: true,
              partner: { isActive: true },
              service: where,
            },
          }),
        ])

        return {
          ...entry,
          matchingServices,
          matchingPartners,
          hasCoverage: matchingServices > 0,
        }
      })
    )

    const byDayMap = new Map(
      byDayRaw.map((row) => [new Date(row.day).toISOString().slice(0, 10), Number(row.count)])
    )

    const searchesByDay = Array.from({ length: days }, (_, offset) => {
      const d = new Date(startDate.getTime() + offset * DAY_IN_MS)
      const key = d.toISOString().slice(0, 10)
      return {
        date: key,
        count: byDayMap.get(key) ?? 0,
      }
    })

    const searchesByHour = Array.from({ length: 24 }, (_, hour) => {
      const found = byHourRaw.find((row) => Number(row.hour) === hour)
      return { hour, count: found ? Number(found.count) : 0 }
    })

    const repeatUserCount = byUserRaw.filter((row) => row._count.userId > 1).length
    const uniqueUserCount = uniqueUsersRows.length
    const uniqueQueryCount = uniqueQueriesRows.length

    const userIds = byUserRaw.map((row) => row.userId)
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            partnerProfile: { select: { city: true } },
            addresses: {
              select: { city: true, isPrimary: true, createdAt: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))

    const searchesByRoleAccumulator: Record<UserRole, number> = {
      ADMIN: 0,
      CLIENT: 0,
      PARTNER: 0,
    }

    const searchesByCityAccumulator = new Map<string, number>()

    const topUsers = byUserRaw.map((row) => {
      const user = userMap.get(row.userId)
      const searchCount = row._count.userId

      const role = user?.role ?? UserRole.CLIENT
      searchesByRoleAccumulator[role] += searchCount

      const inferredCity = user?.partnerProfile?.city ?? user?.addresses?.[0]?.city ?? null
      const cityLabel = formatCityLabel(inferredCity)
      searchesByCityAccumulator.set(cityLabel, (searchesByCityAccumulator.get(cityLabel) ?? 0) + searchCount)

      return {
        userId: row.userId,
        userName: user?.name ?? 'Sin nombre',
        userEmail: user?.email ?? 'Sin correo',
        role,
        city: cityLabel,
        searchCount,
      }
    })

    const searchesByRole = Object.entries(searchesByRoleAccumulator)
      .map(([role, count]) => ({ role, count }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)

    const searchesByCity = Array.from(searchesByCityAccumulator.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const top10Count = queryCoverage.slice(0, 10).reduce((acc, item) => acc + item.count, 0)
    const singleSearchQueryCount = queryCoverage.filter((item) => item.count === 1).length
    const uncoveredQueries = queryCoverage.filter((item) => !item.hasCoverage)

    const recentSearches = recentSearchesRaw.map((item) => {
      const inferredCity = item.user.partnerProfile?.city ?? item.user.addresses?.[0]?.city ?? null

      return {
        id: item.id,
        query: item.query,
        userName: item.user.name,
        userEmail: item.user.email,
        role: item.user.role,
        city: formatCityLabel(inferredCity),
        createdAt: item.createdAt,
      }
    })

    const response = {
      summary: {
        periodDays: days,
        totalSearches,
        previousPeriodSearches,
        searchesDeltaPct: pctChange(totalSearches, previousPeriodSearches),
        uniqueUsers: uniqueUserCount,
        uniqueQueries: uniqueQueryCount,
        averageSearchesPerUser: uniqueUserCount > 0 ? Number((totalSearches / uniqueUserCount).toFixed(2)) : 0,
        repeatUsers: repeatUserCount,
        repeatUsersRate: uniqueUserCount > 0 ? Number(((repeatUserCount / uniqueUserCount) * 100).toFixed(2)) : 0,
        top10Share: totalSearches > 0 ? Number(((top10Count / totalSearches) * 100).toFixed(2)) : 0,
        singleSearchQueryRate: uniqueQueryCount > 0 ? Number(((singleSearchQueryCount / uniqueQueryCount) * 100).toFixed(2)) : 0,
        uncoveredQueries: uncoveredQueries.length,
        uncoveredQueriesRate: queryCoverage.length > 0 ? Number(((uncoveredQueries.length / queryCoverage.length) * 100).toFixed(2)) : 0,
      },
      trends: {
        searchesByDay,
        searchesByHour,
      },
      segmentation: {
        searchesByRole,
        searchesByCity,
      },
      topQueries: queryCoverage,
      uncoveredQueries,
      topUsers,
      recentSearches,
      generatedAt: endDate.toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching search analytics:', error)
    return NextResponse.json(
      {
        error: 'Error retrieving analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
