import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      partnerId?: string
      image?: string | null
      clientRating?: number
      clientTotalReviews?: number
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    partnerId?: string
    image?: string | null
    clientRating?: number
    clientTotalReviews?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    partnerId?: string
    image?: string | null
    clientRating?: number
    clientTotalReviews?: number
  }
}