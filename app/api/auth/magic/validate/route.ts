import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encode } from 'next-auth/jwt'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

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

  // Mark as used
  await prisma.magicToken.update({
    where: { id: magic.id },
    data: { usedAt: new Date() },
  })

  // Must use the same secret as authOptions in lib/auth.ts
  const secret = env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET
  if (!secret) {
    logger.error('NEXTAUTH_SECRET not configured')
    return NextResponse.json({ error: 'Error de configuración.' }, { status: 500 })
  }

  const maxAge = 30 * 24 * 60 * 60 // 30 days

  const jwtToken = await encode({
    secret,
    token: {
      sub: magic.user.id,
      name: magic.user.name,
      email: magic.user.email,
      picture: magic.user.image,
      role: magic.user.role,
      partnerId: magic.user.partnerProfile?.id,
      phone: magic.user.phone,
      isActive: magic.user.isActive,
      needsPasswordUpdate: magic.requirePasswordChange,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + maxAge,
    },
    maxAge,
  })

  const isProduction = env.NODE_ENV === 'production'
  const cookieName = isProduction
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  const response = NextResponse.json({
    ok: true,
    redirectUrl: magic.redirectUrl,
  })

  // Never let a proxy/CDN cache a token-bearing response.
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  response.cookies.set(cookieName, jwtToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
    secure: isProduction,
    ...(env.NEXTAUTH_COOKIE_DOMAIN ? { domain: env.NEXTAUTH_COOKIE_DOMAIN } : {}),
  })

  logger.info('Magic token validated', { userId: magic.userId })
  return response
}
