import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      partnerId?: string
      image?: string | null
      phone?: string | null
      clientRating?: number
      clientTotalReviews?: number
      isActive?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    partnerId?: string
    image?: string | null
    phone?: string | null
    clientRating?: number
    clientTotalReviews?: number
    isActive?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    partnerId?: string
    image?: string | null
    phone?: string | null
    clientRating?: number
    clientTotalReviews?: number
    isActive?: boolean
  }
}