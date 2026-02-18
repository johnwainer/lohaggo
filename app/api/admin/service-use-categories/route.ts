import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-service-use-categories')

const createSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  icon: z.string().min(1).max(8).optional(),
  description: z.string().max(220).optional().nullable(),
  order: z.number().int().min(0).max(200).optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.serviceUseCategory.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          services: true,
        },
      },
    },
  })

  return NextResponse.json({ categories })
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const currentCount = await prisma.serviceUseCategory.count()
    if (currentCount >= 10) {
      return NextResponse.json({ error: 'Solo se permiten hasta 10 categorías de uso.' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const category = await prisma.serviceUseCategory.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        icon: parsed.data.icon || '🏷️',
        description: parsed.data.description || null,
        order: parsed.data.order ?? currentCount + 1,
        isActive: parsed.data.isActive ?? true,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating service use category', error || undefined)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'El slug ya existe.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
