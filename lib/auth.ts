import { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { env } from "@/lib/env"
import { recordOperationalMetric } from "@/lib/monitoring-metrics"
import {
  getClientIpFromHeaders,
  isLikelyBotSubmission,
  verifyTurnstileToken,
} from "@/lib/security/bot-protection"

const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LIMIT_MAX_ATTEMPTS = 8
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>()

function isLoginLimited(key: string): boolean {
  const now = Date.now()
  const existing = loginAttemptMap.get(key)
  if (!existing || now > existing.resetAt) {
    loginAttemptMap.set(key, { count: 1, resetAt: now + LOGIN_LIMIT_WINDOW_MS })
    return false
  }
  existing.count += 1
  return existing.count > LOGIN_LIMIT_MAX_ATTEMPTS
}

function resetLoginLimit(key: string) {
  loginAttemptMap.delete(key)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        captchaToken: { label: "Captcha Token", type: "text" },
        honeypot: { label: "Honeypot", type: "text" },
        formStartedAt: { label: "Form Started At", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          recordOperationalMetric('login_failure')
          throw new Error("Email y contraseña requeridos")
        }

        const normalizedEmail = credentials.email.toLowerCase().trim()
        const clientIp = getClientIpFromHeaders(req?.headers)
        const loginLimitKey = `${normalizedEmail}:${clientIp}`

        if (isLoginLimited(loginLimitKey)) {
          recordOperationalMetric('login_failure')
          throw new Error("Demasiados intentos. Intenta nuevamente en unos minutos.")
        }

        const hasBotSignals = Boolean(
          credentials.honeypot || credentials.formStartedAt || credentials.captchaToken
        )

        if (hasBotSignals) {
          if (
            isLikelyBotSubmission({
              honeypot: credentials.honeypot,
              formStartedAt: credentials.formStartedAt,
            })
          ) {
            recordOperationalMetric('login_failure')
            throw new Error("No fue posible validar el acceso. Intenta nuevamente.")
          }

          const isCaptchaValid = await verifyTurnstileToken({
            token: credentials.captchaToken,
            remoteIp: clientIp,
            expectedAction: 'login',
          })

          if (!isCaptchaValid) {
            recordOperationalMetric('login_failure')
            throw new Error("Verificación anti-bot inválida.")
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { partnerProfile: true }
        })

        if (!user) {
          recordOperationalMetric('login_failure')
          throw new Error("Usuario no encontrado")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          recordOperationalMetric('login_failure')
          throw new Error("Contraseña incorrecta")
        }

        resetLoginLimit(loginLimitKey)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          phone: user.phone,
          role: user.role,
          partnerId: user.partnerProfile?.id,
          clientRating: user.clientRating,
          clientTotalReviews: user.clientTotalReviews,
          isActive: user.isActive
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.partnerId = user.partnerId
        token.image = user.image
        token.phone = user.phone
        token.clientRating = user.clientRating
        token.clientTotalReviews = user.clientTotalReviews
        token.isActive = user.isActive
      }
      if (trigger === 'update' && session?.name) {
        token.name = session.name
      }
      if (trigger === 'update' && session?.image !== undefined) {
        token.image = session.image
      }
      if (trigger === 'update' && session?.phone !== undefined) {
        token.phone = session.phone
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.partnerId = token.partnerId as string | undefined
        session.user.name = token.name as string
        session.user.image = token.image as string | null | undefined
        session.user.phone = token.phone as string | null | undefined
        session.user.clientRating = token.clientRating as number | undefined
        session.user.clientTotalReviews = token.clientTotalReviews as number | undefined
        session.user.isActive = token.isActive as boolean | undefined
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: parseInt(env.SESSION_MAX_AGE, 10),
    updateAge: parseInt(env.SESSION_UPDATE_AGE, 10),
  },
  cookies: {
    sessionToken: {
      name:
        env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
      },
    },
  },
  secret: env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET,
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { partnerProfile: true }
  })

  return user
}
