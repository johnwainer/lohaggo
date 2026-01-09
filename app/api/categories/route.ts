import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('categories')

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { services: true }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(categories)
  } catch (error) {
    logger.error('Error fetching categories:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    )
  }
}
