import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { setSessionCookie } from '@/lib/session-cookie'

export const dynamic = 'force-dynamic'

const logger = createLogger('magic-validate')

/**
 * GET /api/auth/magic/validate?token=xxx
 * Validates a magic token, marks it used, sets a NextAuth session cookie,
 * and returns the redirectUrl so the client page can navigate.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const magic = await prisma.magicToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          phone: true,
          role: true,
          isActive: true,
          partnerProfile: { select: { id: true } },
        },
      },
    },
  })

  if (!magic) {
    return NextResponse.json({ error: 'Enlace inválido o ya utilizado.' }, { status: 400 })
  }

  if (magic.usedAt) {
    return NextResponse.json({ error: 'Este enlace ya fue utilizado. Inicia sesión normalmente.' }, { status: 400 })
  }

  if (magic.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Este enlace ha expirado. Solicita uno nuevo.' }, { status: 400 })
  }

  if (!magic.user.isActive) {
    return NextResponse.json({ error: 'Tu cuenta está inactiva. Contacta al soporte.' }, { status: 403 })
  }

  // Claim atomically: two concurrent requests with the same token cannot both get a session
  const claimed = await prisma.magicToken.updateMany({
    where: { id: magic.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) {
    return NextResponse.json({ error: 'Este enlace ya fue utilizado. Inicia sesión normalmente.' }, { status: 400 })
  }

  const response = NextResponse.json({
    ok: true,
    redirectUrl: magic.redirectUrl,
  })
  try {
    await setSessionCookie(response, magic.user, { needsPasswordUpdate: magic.requirePasswordChange })
  } catch {
    logger.error('NEXTAUTH_SECRET not configured')
    return NextResponse.json({ error: 'Error de configuración.' }, { status: 500 })
  }

  logger.info('Magic token validated', { userId: magic.userId })
  return response
}
