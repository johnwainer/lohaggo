import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL

console.log('🔍 Checking database configuration...')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set')
console.log('POSTGRES_PRISMA_URL:', process.env.POSTGRES_PRISMA_URL ? '✅ Set' : '❌ Not set')

if (!databaseUrl) {
  console.error('❌ Database URL is not defined!')
  console.error('Available env vars:', Object.keys(process.env).filter(key =>
    key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('SUPABASE')
  ))
  throw new Error('POSTGRES_PRISMA_URL or DATABASE_URL environment variable is not defined. Please check your environment variables.')
}

console.log('✅ Database URL configured')

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

console.log('✅ Prisma Client initialized')

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
