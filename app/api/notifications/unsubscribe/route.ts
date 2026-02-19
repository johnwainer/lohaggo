import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { createLogger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { getToken } from 'next-auth/jwt'
import { env } from '@/lib/env'

const logger = createLogger('notifications-unsubscribe')

async function resolveCurrentUser(request: NextRequest) {
  const current = await getCurrentUser()
  if (current) return current

  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET,
  })

  if (!token?.sub) return null

  return prisma.user.findUnique({
    where: { id: token.sub },
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveCurrentUser(request)

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
