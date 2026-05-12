import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('services-slug')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const citySlug = searchParams.get('city') || 'medellin'

  try {
    // Obtener la ciudad desde la DB para convertir slug a enum
    const cityRecord = await prisma.cityConfig.findUnique({
      where: { slug: citySlug }
    })

    if (!cityRecord) {
      return NextResponse.json(
        { error: "Ciudad no válida" },
        { status: 400 }
      )
    }

    // Normalizar nombre de ciudad a formato enum
    const cityEnum = cityRecord.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_')

    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        category: true,
        partners: {
          where: {
            active: true,
            partner: {
              city: cityEnum as any,
              isActive: true,
              verified: true,
            }
          },
          include: {
            partner: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                    image: true,
                  }
                },
                documents: {
                  where: { status: 'APPROVED' },
                  select: { type: true, status: true }
                }
              }
            }
          }
        }
      }
    })

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...service,
      partners: service.partners,
    })
  } catch (error) {
    logger.error('Error fetching servicio:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener servicio" },
      { status: 500 }
    )
  }
}
