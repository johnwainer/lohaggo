import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-service-use-categories-id')

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  icon: z.string().min(1).max(8).optional(),
  description: z.string().max(220).optional().nullable(),
  order: z.number().int().min(0).max(200).optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const category = await prisma.serviceUseCategory.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
        ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    })

    return NextResponse.json({ category })
  } catch (error: any) {
    logger.error('Error updating service use category', error || undefined)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'El slug ya existe.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.serviceUseCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error deleting service use category', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
