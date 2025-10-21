import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const popular = searchParams.get("popular")
    const search = searchParams.get("search")

    const where: any = {}

    if (category) {
      where.category = { slug: category }
    }

    if (popular === "true") {
      where.popular = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: { partners: true }
        }
      },
      orderBy: [
        { popular: "desc" },
        { name: "asc" }
      ]
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error("Error fetching services:", error)
    return NextResponse.json(
      { error: "Error al obtener servicios" },
      { status: 500 }
    )
  }
}
