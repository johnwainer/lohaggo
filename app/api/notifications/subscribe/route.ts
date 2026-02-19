import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { validatePushSubscription, sanitizePushSubscription } from '@/lib/notifications/pushValidation'

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

    const validation = validatePushSubscription(subscription)

    if (!validation.success) {
      logger.warn('Invalid push subscription format', { error: validation.error, userId: user.id })
      return NextResponse.json(
        { error: `Formato de suscripción inválido: ${validation.error}` },
        { status: 400 }
      )
    }

    const sanitizedSubscription = sanitizePushSubscription(validation.data)

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        pushSubscription: sanitizedSubscription,
        notificationsPushEnabled: true,
      }
    })

    logger.info('Push subscription saved successfully', { userId: user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'notifications-subscribe')
  }
}
