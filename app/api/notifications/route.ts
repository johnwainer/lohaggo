import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('notifications')

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    const where: any = { userId: user.id }
    if (unreadOnly) {
      where.read = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    })

    return NextResponse.json(notifications)
  } catch (error) {
    logger.error('Error fetching notifications:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener notificaciones" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationId, markAllAsRead } = body

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          read: false
        },
        data: {
          read: true
        }
      })
      return NextResponse.json({ success: true })
    }

    if (notificationId) {
      await prisma.notification.update({
        where: {
          id: notificationId,
          userId: user.id
        },
        data: {
          read: true
        }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: "Parámetros inválidos" },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Error updating notification:', error || undefined)
    return NextResponse.json(
      { error: "Error al actualizar notificación" },
      { status: 500 }
    )
  }
}
