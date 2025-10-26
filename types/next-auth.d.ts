import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      partnerId?: string
      image?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    partnerId?: string
    image?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    partnerId?: string
    image?: string | null
  }
}