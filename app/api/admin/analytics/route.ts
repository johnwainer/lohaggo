import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        month: date.toLocaleString('es-ES', { month: 'short' }),
        year: date.getFullYear(),
        date
      }
    }).reverse()

    const bookingsByMonth = await Promise.all(
      last12Months.map(async ({ date }) => {
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1)
        const count = await prisma.booking.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextMonth
            }
          }
        })
        const revenue = await prisma.booking.aggregate({
          where: {
            status: 'COMPLETED',
            createdAt: {
              gte: date,
              lt: nextMonth
            }
          },
          _sum: { totalPrice: true }
        })
        return {
          count,
          revenue: revenue._sum.totalPrice || 0
        }
      })
    )

    const usersByMonth = await Promise.all(
      last12Months.map(async ({ date }) => {
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1)
        return await prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextMonth
            }
          }
        })
      })
    )

    const bookingsByStatus = await prisma.booking.groupBy({
      by: ['status'],
      _count: true
    })

    const bookingsByService = await prisma.booking.groupBy({
      by: ['serviceId'],
      _count: true,
      orderBy: {
        _count: {
          serviceId: 'desc'
        }
      },
      take: 10
    })

    const serviceDetails = await prisma.service.findMany({
      where: {
        id: {
          in: bookingsByService.map(b => b.serviceId)
        }
      },
      select: {
        id: true,
        name: true,
        icon: true
      }
    })

    const topServices = bookingsByService.map(b => ({
      ...b,
      service: serviceDetails.find(s => s.id === b.serviceId)
    }))

    const revenueByCity = await prisma.booking.groupBy({
      by: ['city'],
      where: { status: 'COMPLETED' },
      _sum: { totalPrice: true },
      _count: true
    })

    return NextResponse.json({
      bookingsByMonth: {
        labels: last12Months.map(m => `${m.month} ${m.year}`),
        bookings: bookingsByMonth.map(b => b.count),
        revenue: bookingsByMonth.map(b => b.revenue)
      },
      usersByMonth: {
        labels: last12Months.map(m => `${m.month} ${m.year}`),
        users: usersByMonth
      },
      bookingsByStatus,
      topServices,
      revenueByCity
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Error al obtener analíticas' }, { status: 500 })
  }
}
