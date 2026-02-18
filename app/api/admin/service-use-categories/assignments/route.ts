import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-service-use-category-assignments')

const updateSchema = z.object({
  serviceId: z.string().min(1),
  categoryIds: z.array(z.string().min(1)).min(1).max(10),
})

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [categories, services] = await Promise.all([
    prisma.serviceUseCategory.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        isActive: true,
      },
    }),
    prisma.service.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        category: {
          select: { name: true },
        },
        useCategories: {
          select: {
            useCategoryId: true,
            useCategory: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    categories,
    services: services.map((service) => ({
      ...service,
      useCategories: service.useCategories.map((entry) => entry.useCategory),
    })),
  })
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { serviceId, categoryIds } = parsed.data

    await prisma.$transaction(async (tx) => {
      await tx.serviceUseCategoryAssignment.deleteMany({ where: { serviceId } })
      await tx.serviceUseCategoryAssignment.createMany({
        data: categoryIds.map((useCategoryId) => ({
          serviceId,
          useCategoryId,
        })),
        skipDuplicates: true,
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error updating assignments', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
