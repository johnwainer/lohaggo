import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'


const logger = createLogger('notifications-subscribe')

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { subscription } = body

    if (!subscription) {
      return NextResponse.json(
        { error: "Suscripción requerida" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pushSubscription: JSON.stringify(subscription)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error || undefined)
    return NextResponse.json(
      { error: "Error al suscribirse" },
      { status: 500 }
    )
  }
}
