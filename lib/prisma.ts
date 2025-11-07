import { PrismaClient } from '@prisma/client'
import { createLogger } from './logger'

const logger = createLogger('prisma')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL

const isDatabaseUrlSet = !!process.env.DATABASE_URL
const isPostgresUrlSet = !!process.env.POSTGRES_PRISMA_URL

logger.debug('Checking database configuration', {
  hasDatabaseUrl: isDatabaseUrlSet,
  hasPostgresUrl: isPostgresUrlSet,
})

if (!databaseUrl) {
  const availableEnvVars = Object.keys(process.env).filter(key =>
    key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('SUPABASE')
  )
  logger.error('Database URL is not defined', { availableEnvVars })
  throw new Error('POSTGRES_PRISMA_URL or DATABASE_URL environment variable is not defined. Please check your environment variables.')
}

logger.info('Database URL configured successfully')

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

logger.info('Prisma Client initialized')

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
