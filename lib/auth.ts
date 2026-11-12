import { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { overLimit, unhit } from "@/lib/rate-limit-store"
import { refreshTokenFromDb } from "@/lib/auth-refresh"
import { env } from "@/lib/env"
import {
  getClientIpFromHeaders,
  isLikelyBotSubmission,
  verifyTurnstileToken,
} from "@/lib/security/bot-protection"

const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LIMIT_MAX_ATTEMPTS = 8
const LOGIN_IP_MAX_ATTEMPTS = 60

/** Same text for unknown account, wrong password and deactivated account: nothing reveals which accounts exist. */
export const INVALID_CREDENTIALS_MESSAGE = "Correo o contraseña incorrectos"

// Compared against when the account does not exist, so the response time does not tell either
let dummyHash: string | null = null
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("no-such-account", 10))

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
          throw new Error("Email y contraseña requeridos")
        }

        const normalizedEmail = credentials.email.toLowerCase().trim()
        const clientIp = getClientIpFromHeaders(req?.headers)
        const loginLimitKey = `${normalizedEmail}:${clientIp}`

        const accountLimit = await overLimit(`login:${loginLimitKey}`, LOGIN_LIMIT_WINDOW_MS, LOGIN_LIMIT_MAX_ATTEMPTS)
        const ipLimit = await overLimit(`login-ip:${clientIp}`, LOGIN_LIMIT_WINDOW_MS, LOGIN_IP_MAX_ATTEMPTS)
        if (accountLimit.blocked || ipLimit.blocked) {
          const waitMin = Math.max(1, Math.ceil(Math.max(accountLimit.blocked ? accountLimit.retryAfterSec : 0, ipLimit.blocked ? ipLimit.retryAfterSec : 0) / 60))
          throw new Error(`Demasiados intentos. Intenta nuevamente en ${waitMin} minuto${waitMin === 1 ? "" : "s"}.`)
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
            throw new Error("No fue posible validar el acceso. Intenta nuevamente.")
          }

          const isCaptchaValid = await verifyTurnstileToken({
            token: credentials.captchaToken,
            remoteIp: clientIp,
            expectedAction: 'login',
          })

          if (!isCaptchaValid) {
            throw new Error("Verificación anti-bot inválida.")
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { partnerProfile: true }
        })

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user?.password ?? getDummyHash()
        )

        if (!user || !isPasswordValid || !user.isActive) {
          throw new Error(INVALID_CREDENTIALS_MESSAGE)
        }

        // Only failures count: a successful login gives back both hits so shared IPs (offices, mobile carriers) are not locked out
        await unhit(`login:${loginLimitKey}`, LOGIN_LIMIT_WINDOW_MS)
        await unhit(`login-ip:${clientIp}`, LOGIN_LIMIT_WINDOW_MS)

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
        token.needsPasswordUpdate = (user as any).needsPasswordUpdate ?? false
      }
      if (!user) {
        // Role and isActive are confirmed against the DB at most every 5 minutes (a demoted or deactivated user loses access in minutes)
        token = await refreshTokenFromDb(token, async (id) => {
          const u = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true, partnerProfile: { select: { id: true } } } })
          return u ? { role: u.role, isActive: u.isActive, partnerId: u.partnerProfile?.id ?? null } : null
        })
      } else {
        token.checkedAt = Date.now()
        token.invalid = false
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
      if (trigger === 'update' && session?.needsPasswordUpdate !== undefined) {
        token.needsPasswordUpdate = session.needsPasswordUpdate
      }
      return token
    },
    async session({ session, token }) {
      if (token.invalid) {
        // Deleted or deactivated account: no user, so every `session?.user` check refuses
        return { expires: session.expires } as typeof session
      }
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
        session.user.needsPasswordUpdate = token.needsPasswordUpdate as boolean | undefined
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
        ...(env.NEXTAUTH_COOKIE_DOMAIN ? { domain: env.NEXTAUTH_COOKIE_DOMAIN } : {}),
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
