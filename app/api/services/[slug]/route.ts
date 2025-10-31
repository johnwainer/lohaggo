import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where: { slug: params.slug },
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
    console.error("Error fetching servicio:", error)
    return NextResponse.json(
      { error: "Error al obtener servicio" },
      { status: 500 }
    )
  }
}