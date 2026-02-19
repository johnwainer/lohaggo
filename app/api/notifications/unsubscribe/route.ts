import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'

const logger = createLogger('notifications-unsubscribe')

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        pushSubscription: null,
        notificationsPushEnabled: false,
      }
    })

    logger.info('Push subscription removed successfully', { userId: user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'notifications-unsubscribe')
  }
}
