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
  try {
    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        category: true,
        partners: {
          where: { active: true },
          include: {
            partner: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                  }
                },
                documents: {
                  where: {
                    status: 'APPROVED'
                  },
                  select: {
                    type: true,
                    status: true
                  }
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

    return NextResponse.json(service)
  } catch (error) {
    logger.error('Error fetching servicio:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener servicio" },
      { status: 500 }
    )
  }
}