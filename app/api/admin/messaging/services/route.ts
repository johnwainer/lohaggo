import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const services = await prisma.service.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    take: 600,
  })

  return NextResponse.json({
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      categoryName: service.category.name,
    })),
  })
}
