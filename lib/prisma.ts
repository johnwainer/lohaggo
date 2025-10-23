import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Verificar que DATABASE_URL esté configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined!')
  console.error('Available env vars:', Object.keys(process.env).filter(key => 
    key.includes('DATABASE') || key.includes('POSTGRES')
  ))
  throw new Error('DATABASE_URL environment variable is not defined. Please check your Vercel environment variables.')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
