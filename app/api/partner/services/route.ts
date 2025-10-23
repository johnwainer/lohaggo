import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

 // GET - Obtener todos los servicios disponibles y los del partner
 export async function GET(request: NextRequest) {
   try {
     const session = await getServerSession(authOptions)
     const { searchParams } = new URL(request.url)
     const testMode = searchParams.get('test') === 'true'

     // En modo test, usar un partner de prueba
     let partnerProfile = null

     if (testMode) {
       // Obtener el primer partner disponible para testing
       partnerProfile = await prisma.partnerProfile.findFirst({
         include: {
           services: {
             include: {
               service: {
                 include: {
                   category: true
                 }
               }
             }
           }
         }
       })
     } else {
       // Modo normal: requiere autenticación
       if (!session?.user?.id) {
         return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
       }

       // Obtener el perfil del partner
       partnerProfile = await prisma.partnerProfile.findUnique({
         where: { userId: session.user.id },
         include: {
           services: {
             include: {
               service: {
                 include: {
                   category: true
                 }
               }
             }
           }
         }
       })
     }

     if (!partnerProfile) {
       return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
     }
    const allServices = await prisma.service.findMany({
      include: {
        category: true
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    // Marcar cuáles servicios ya tiene el partner
    const servicesWithStatus = allServices.map((service) => {
      const partnerService = partnerProfile.services.find((ps) => ps.serviceId === service.id)
      return {
        ...service,
        isActive: !!partnerService,
        partnerServiceId: partnerService?.id,
        price: partnerService?.price || (service as { basePrice?: number }).basePrice,
        city: partnerService?.city
      }
    })

    return NextResponse.json({
      services: servicesWithStatus,
      partnerId: partnerProfile.id
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Error al obtener servicios' }, { status: 500 })
  }
}

// POST - Agregar o actualizar un servicio del partner
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const testMode = searchParams.get('test') === 'true'

    let partnerProfile = null

    if (testMode) {
      // En modo test, usar el primer partner disponible
      partnerProfile = await prisma.partnerProfile.findFirst()
    } else {
      // Modo normal: requiere autenticación
      const session = await getServerSession(authOptions)

      if (!session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }

      // Obtener el perfil del partner
      partnerProfile = await prisma.partnerProfile.findUnique({
        where: { userId: session.user.id }
      })
    }

    const { serviceId, price, city, active } = await req.json()

    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId requerido' }, { status: 400 })
    }

    // Obtener información del servicio para valores por defecto
    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    })

    if (!service) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    // Usar valores por defecto si no se proporcionan
    const defaultPrice = price !== undefined && price !== null ? parseFloat(price) : service.basePrice
    const defaultCity = city && city.trim() !== '' ? city : 'MEDELLIN'

    // Verificar si ya existe
    const existing = await prisma.partnerService.findUnique({
      where: {
        partnerId_serviceId: {
          partnerId: partnerProfile.id,
          serviceId: serviceId
        }
        // Si existe, al actualizar usar los valores por defecto:
        // data: {
        //   price: defaultPrice,
        //   city: defaultCity,
        //   active: active !== undefined ? active : true
        // },
      }
    })

    let partnerService

    if (existing) {
      // Actualizar
      partnerService = await prisma.partnerService.update({
        where: { id: existing.id },
        data: {
          price: defaultPrice,
          city: defaultCity,
          active: active !== undefined ? active : true
        },
        include: {
          service: {
            include: {
              category: true
            }
          }
        }
      })
    } else {
      // Crear nuevo
      partnerService = await prisma.partnerService.create({
        data: {
          partnerId: partnerProfile.id,
          serviceId: serviceId,
          price: defaultPrice,
          city: defaultCity,
          active: true
        },
        include: {
          service: {
            include: {
              category: true
            }
          }
        }
      })
    }

    return NextResponse.json(partnerService)
  } catch (error) {
    console.error('Error saving service:', error)
    return NextResponse.json({ error: 'Error al guardar servicio' }, { status: 500 })
  }
}

// DELETE - Eliminar un servicio del partner
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const partnerServiceId = searchParams.get('id')

    if (!partnerServiceId) {
      return NextResponse.json({ error: 'ID de servicio requerido' }, { status: 400 })
    }

    // Verificar que el servicio pertenece al partner
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    const partnerService = await prisma.partnerService.findUnique({
      where: { id: partnerServiceId }
    })

    if (!partnerService || partnerService.partnerId !== partnerProfile.id) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    // Eliminar el servicio (esto también eliminará las disponibilidades por cascade)
    await prisma.partnerService.delete({
      where: { id: partnerServiceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Error al eliminar servicio' }, { status: 500 })
  }
}
