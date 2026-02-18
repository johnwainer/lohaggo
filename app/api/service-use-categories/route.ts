import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('service-use-categories-public')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await prisma.serviceUseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        description: true,
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    logger.error('Error fetching service use categories', error || undefined)
    return NextResponse.json({ error: 'Error al cargar categorías de uso' }, { status: 500 })
  }
}
