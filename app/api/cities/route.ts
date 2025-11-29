import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching cities from database...')
    console.log('📊 Database URL configured:', !!process.env.DATABASE_URL || !!process.env.POSTGRES_PRISMA_URL)

    const cities = await prisma.cityConfig.findMany({
      orderBy: { order: 'asc' }
    })

    console.log('✅ Cities fetched successfully:', cities.length)
    return NextResponse.json(cities)
  } catch (error) {
    console.error('❌ Error fetching cities:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
        hasPostgresUrl: !!process.env.POSTGRES_URL_NON_POOLING,
        nodeEnv: process.env.NODE_ENV
      }
    })
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}