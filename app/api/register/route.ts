import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, phone, role, city, services } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      )
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear usuario
    const userData: any = {
      email,
      password: hashedPassword,
      name,
      phone,
      role: role || "CLIENT"
    }

    // Si es socio, crear perfil de socio con ciudad y servicios
    if (role === "PARTNER") {
      userData.partnerProfile = {
        create: {
          bio: "",
          rating: 0,
          totalReviews: 0,
          verified: false,
          city: city || "MEDELLIN",
        }
      }
    }

    const user = await prisma.user.create({
      data: userData,
      include: {
        partnerProfile: true
      }
    })

    // Si es socio y tiene servicios seleccionados, crear las relaciones
    if (role === "PARTNER" && user.partnerProfile && Array.isArray(services) && services.length > 0) {
      // Obtener los IDs de los servicios por sus slugs
      const serviceRecords = await prisma.service.findMany({
        where: {
          slug: {
            in: services
          }
        }
      })

      // Crear las relaciones PartnerService
      const partnerServices = serviceRecords.map((service: { id: string; basePrice: number }) => ({
        partnerId: user.partnerProfile!.id,
        serviceId: service.id,
        price: service.basePrice,
        city: city || "MEDELLIN",
        active: true,
      }))

      await prisma.partnerService.createMany({
        data: partnerServices
      })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }, { status: 201 })
  } catch (error) {
    console.error("Error registering user:", error)
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    )
  }
}
