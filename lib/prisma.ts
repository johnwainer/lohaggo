import { PrismaClient } from '@prisma/client'
import { stripTracking, wantsTracking } from '@/lib/prisma-tracking'

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not defined in production')
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  })
  // Attribution (ServiceRequest / Booking acquisition + lastTouch: ad cookie ids, referrer) never rides along
  // in an include that ends up in a client's or partner's JSON: only queries that ask for it get it.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args)
          return wantsTracking(args) ? result : stripTracking(result)
        },
      },
    },
  }) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function disconnectPrisma() {
  await prisma.$disconnect()
}
