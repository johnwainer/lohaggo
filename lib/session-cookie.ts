import type { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { env } from '@/lib/env'

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60

export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
  phone: string | null
  role: string
  isActive: boolean
  partnerProfile?: { id: string } | null
}

/**
 * Signs in `user` on `response` with the same NextAuth JWT cookie the credentials login sets (same secret
 * as authOptions in lib/auth.ts). Used by the magic link and by the WhatsApp code login.
 */
export async function setSessionCookie(response: NextResponse, user: SessionUser, opts: { needsPasswordUpdate?: boolean } = {}) {
  const secret = env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const jwtToken = await encode({
    secret,
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      role: user.role,
      partnerId: user.partnerProfile?.id,
      phone: user.phone,
      isActive: user.isActive,
      needsPasswordUpdate: Boolean(opts.needsPasswordUpdate),
      iat: now,
      exp: now + SESSION_MAX_AGE,
    },
    maxAge: SESSION_MAX_AGE,
  })
  const isProduction = env.NODE_ENV === 'production'
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.cookies.set(isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token', jwtToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: isProduction,
    ...(env.NEXTAUTH_COOKIE_DOMAIN ? { domain: env.NEXTAUTH_COOKIE_DOMAIN } : {}),
  })
}
