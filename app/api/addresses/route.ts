import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { addressSchema, validateRequest } from '@/lib/validation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'


const logger = createLogger('addresses')

const addressCreateSchema = addressSchema.extend({
  label: z.string().min(1, 'La etiqueta es requerida').max(50),
  number: z.string().min(1, 'El número es requerido').max(20),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(2, 'El barrio es requerido').max(100),
  postalCode: z.string().max(20).optional(),
  instructions: z.string().max(500).optional(),
  isPrimary: z.boolean().optional()
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addresses = await prisma.address.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(addresses)
  } catch (error) {
    logger.error('Error fetching addresses:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener direcciones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const validation = await validateRequest(addressCreateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const validatedData = validation.data

    if (validatedData.isPrimary) {
      await prisma.address.updateMany({
        where: {
          userId: session.user.id,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      })
    }

    const address = await prisma.address.create({
      data: {
        userId: session.user.id,
        label: validatedData.label,
        street: validatedData.street,
        number: validatedData.number,
        complement: validatedData.complement,
        neighborhood: validatedData.neighborhood,
        city: validatedData.city,
        postalCode: validatedData.postalCode,
        instructions: validatedData.instructions,
        isPrimary: validatedData.isPrimary || false
      }
    })

    return NextResponse.json(address, { status: 201 })
  } catch (error) {
    logger.error('Error creating address:', error || undefined)
    return NextResponse.json({ error: 'Error al crear dirección' }, { status: 500 })
  }
}
