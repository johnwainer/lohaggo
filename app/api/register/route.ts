import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { City } from "@prisma/client"
import bcrypt from "bcryptjs"
import { createLogger } from '@/lib/logger'
import { registerRateLimiter } from '@/lib/rate-limit'
import { validateRequest } from '@/lib/validation'
import { registerSchema } from '@/lib/validation/auth-schemas'

const logger = createLogger('register')

export const dynamic = 'force-dynamic'

// Helper function to normalize city name to enum format
function normalizeCityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toUpperCase()
    .replace(/\s+/g, '_')
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = await validateRequest(registerSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { email, password, name, phone, role, city: citySlug, services } = validation.data

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

    // Si es socio y se proporcionó ciudad, validar y convertir slug a enum
    let cityEnum: City = City.MEDELLIN
    if (role === "PARTNER" && citySlug) {
      const cityRecord = await prisma.cityConfig.findUnique({
        where: { slug: citySlug }
      })

      if (!cityRecord) {
        return NextResponse.json(
          { error: "Ciudad no válida" },
          { status: 400 }
        )
      }

      const cityName = normalizeCityName(cityRecord.name)

      logger.info('Normalizing city name', {
        slug: citySlug,
        originalName: cityRecord.name,
        normalizedName: cityName,
        availableEnumValues: Object.keys(City)
      })

      // Validar que el nombre normalizado existe en el enum City
      if (!(cityName in City)) {
        logger.error('City name not found in enum', {
          originalName: cityRecord.name,
          normalizedName: cityName,
          availableValues: Object.keys(City)
        })
        return NextResponse.json(
          { error: "Ciudad no soportada en el sistema" },
          { status: 400 }
        )
      }

      cityEnum = cityName as City
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
          city: cityEnum,
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
        city: cityEnum,
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
    logger.error('Error registering user', { error })
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return registerRateLimiter(request, handlePOST);
}
