import { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña requeridos")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { partnerProfile: true }
        })

        if (!user) {
          throw new Error("Usuario no encontrado")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Contraseña incorrecta")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          partnerId: user.partnerProfile?.id,
          clientRating: user.clientRating,
          clientTotalReviews: user.clientTotalReviews
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
        token.clientRating = user.clientRating
        token.clientTotalReviews = user.clientTotalReviews
      }
      if (trigger === 'update' && session?.name) {
        token.name = session.name
      }
      if (trigger === 'update' && session?.image !== undefined) {
        token.image = session.image
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
        session.user.clientRating = token.clientRating as number | undefined
        session.user.clientTotalReviews = token.clientTotalReviews as number | undefined
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // session max age in seconds (defaults to 24 hours). Can be overridden via env.
    maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400", 10),
    // how often to update the session in seconds (defaults to 1 hour).
    updateAge: parseInt(process.env.SESSION_UPDATE_AGE || "3600", 10),
  },
  cookies: {
    // Secure cookie settings for session token. Name prefixed with "__Secure-" in production
    // to enforce secure cookies in browsers that respect the prefix.
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  // Support for secret rotation: prefer a CURRENT secret but fall back to the legacy secret.
  // If you need multiple active secrets, you can provide an array here (NextAuth supports that).
  secret: process.env.NEXTAUTH_SECRET_CURRENT || process.env.NEXTAUTH_SECRET,
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