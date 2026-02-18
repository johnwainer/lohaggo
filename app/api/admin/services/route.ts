import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-services')

const serviceSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().min(4).max(1000),
  icon: z.string().min(1).max(8),
  categoryId: z.string().min(1),
  basePrice: z.number().positive(),
  duration: z.number().int().positive().max(1440),
  popular: z.boolean(),
})

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      include: {
        category: { select: { id: true, name: true, icon: true, slug: true } },
        useCategories: {
          include: {
            useCategory: { select: { id: true, name: true, slug: true, icon: true } },
          },
        },
        _count: {
          select: {
            partners: true,
            bookings: true,
          },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.category.findMany({
      select: { id: true, name: true, slug: true, icon: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
  ])

  return NextResponse.json({
    services: services.map((service) => ({
      ...service,
      useCategories: service.useCategories.map((entry) => entry.useCategory),
    })),
    categories,
  })
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = serviceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const created = await prisma.service.create({
      data: parsed.data,
      include: {
        category: { select: { id: true, name: true, icon: true, slug: true } },
        _count: { select: { partners: true, bookings: true } },
      },
    })

    return NextResponse.json({ service: created }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating service', error || undefined)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug ya existe.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
