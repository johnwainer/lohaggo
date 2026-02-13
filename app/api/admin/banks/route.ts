import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { ensureColombiaBankCatalogSeed } from '@/lib/banking/catalog'

const logger = createLogger('admin-banks')

const bankCreateSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(120),
  country: z.string().length(2).default('CO'),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  accountNumberMinLength: z.number().int().min(4).max(30),
  accountNumberMaxLength: z.number().int().min(4).max(30),
  supportsSavings: z.boolean().optional(),
  supportsChecking: z.boolean().optional(),
})

function validateRange(min: number, max: number) {
  return min <= max
}

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function GET() {
  try {
    const session = await ensureAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureColombiaBankCatalogSeed()

    const banks = await prisma.bankCatalog.findMany({
      orderBy: [{ country: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ banks })
  } catch (error) {
    logger.error('Error fetching bank catalog', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await ensureAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = bankCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.errors }, { status: 400 })
    }

    const data = parsed.data
    if (!validateRange(data.accountNumberMinLength, data.accountNumberMaxLength)) {
      return NextResponse.json({ error: 'Rango de cuenta inválido' }, { status: 400 })
    }

    const bank = await prisma.bankCatalog.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        country: data.country.toUpperCase(),
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        accountNumberMinLength: data.accountNumberMinLength,
        accountNumberMaxLength: data.accountNumberMaxLength,
        supportsSavings: data.supportsSavings ?? true,
        supportsChecking: data.supportsChecking ?? true,
      },
    })

    return NextResponse.json({ bank }, { status: 201 })
  } catch (error) {
    logger.error('Error creating bank catalog entry', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
