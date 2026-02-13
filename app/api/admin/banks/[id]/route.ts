import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-banks-id')

const bankUpdateSchema = z.object({
  code: z.string().min(2).max(30).optional(),
  name: z.string().min(2).max(120).optional(),
  country: z.string().length(2).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  accountNumberMinLength: z.number().int().min(4).max(30).optional(),
  accountNumberMaxLength: z.number().int().min(4).max(30).optional(),
  supportsSavings: z.boolean().optional(),
  supportsChecking: z.boolean().optional(),
})

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await ensureAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await context.params

    const body = await request.json()
    const parsed = bankUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.errors }, { status: 400 })
    }

    const existing = await prisma.bankCatalog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 })
    }

    const min = parsed.data.accountNumberMinLength ?? existing.accountNumberMinLength
    const max = parsed.data.accountNumberMaxLength ?? existing.accountNumberMaxLength
    if (min > max) {
      return NextResponse.json({ error: 'Rango de cuenta inválido' }, { status: 400 })
    }

    const bank = await prisma.bankCatalog.update({
      where: { id },
      data: {
        ...(parsed.data.code ? { code: parsed.data.code.toUpperCase().trim() } : {}),
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.country ? { country: parsed.data.country.toUpperCase() } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.accountNumberMinLength !== undefined
          ? { accountNumberMinLength: parsed.data.accountNumberMinLength }
          : {}),
        ...(parsed.data.accountNumberMaxLength !== undefined
          ? { accountNumberMaxLength: parsed.data.accountNumberMaxLength }
          : {}),
        ...(parsed.data.supportsSavings !== undefined ? { supportsSavings: parsed.data.supportsSavings } : {}),
        ...(parsed.data.supportsChecking !== undefined ? { supportsChecking: parsed.data.supportsChecking } : {}),
      },
    })

    return NextResponse.json({ bank })
  } catch (error) {
    logger.error('Error updating bank catalog entry', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  try {
    const session = await ensureAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await context.params

    const bank = await prisma.bankCatalog.findUnique({ where: { id } })
    if (!bank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 })
    }

    await prisma.bankCatalog.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting bank catalog entry', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
