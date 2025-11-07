import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-stats')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    const [
      totalUsers,
      totalPartners,
      totalBookings,
      totalServices,
      totalRevenue,
      pendingBookings,
      completedBookings,
      activeRequests,
      usersThisMonth,
      usersLastMonth,
      bookingsThisMonth,
      bookingsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.partnerProfile.count(),
      prisma.booking.count(),
      prisma.service.count(),
      prisma.booking.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalPrice: true }
      }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.serviceRequest.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
        }
      }),
      prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.booking.count({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
        }
      }),
      prisma.booking.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth }
        },
        _sum: { totalPrice: true }
      }),
      prisma.booking.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
        },
        _sum: { totalPrice: true }
      }),
    ])

    const usersTrend = usersLastMonth > 0
      ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100
      : 0

    const bookingsTrend = bookingsLastMonth > 0
      ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100
      : 0

    const revenueTrend = (revenueLastMonth._sum.totalPrice || 0) > 0
      ? (((revenueThisMonth._sum.totalPrice || 0) - (revenueLastMonth._sum.totalPrice || 0)) / (revenueLastMonth._sum.totalPrice || 0)) * 100
      : 0

    const stats = {
      totalUsers,
      totalPartners,
      totalBookings,
      totalServices,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      pendingBookings,
      completedBookings,
      activeRequests,
      trends: {
        users: Math.round(usersTrend * 10) / 10,
        bookings: Math.round(bookingsTrend * 10) / 10,
        revenue: Math.round(revenueTrend * 10) / 10,
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Error fetching stats:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
