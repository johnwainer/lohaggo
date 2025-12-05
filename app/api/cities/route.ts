import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('cities')

export async function GET(request: NextRequest) {
  try {
    const cities = await prisma.cityConfig.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(cities)
  } catch (error) {
    logger.error('Error fetching cities:', error || undefined)
    return NextResponse.json({ error: 'Error fetching cities' }, { status: 500 })
  }
}