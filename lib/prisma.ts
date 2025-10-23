import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Verificar que las variables de entorno de Supabase estén configuradas
const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ Database URL is not defined!')
  console.error('Available env vars:', Object.keys(process.env).filter(key => 
    key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('SUPABASE')
  ))
  throw new Error('POSTGRES_PRISMA_URL or DATABASE_URL environment variable is not defined. Please check your Vercel environment variables.')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
