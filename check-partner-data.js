const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPartnerData() {
  try {
    console.log('\n=== Verificando datos del Partner ===\n')
    
    const partner = await prisma.user.findFirst({
      where: { role: 'PARTNER' },
      include: {
        partnerProfile: {
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
        }
      }
    })
    
    if (!partner) {
      console.log('❌ No se encontró ningún partner')
      return
    }
    
    console.log(`✅ Partner encontrado: ${partner.email}`)
    console.log(`   ID: ${partner.id}`)
    
    if (!partner.partnerProfile) {
      console.log('❌ El partner no tiene perfil de partner')
      return
    }
    
    console.log(`   Profile ID: ${partner.partnerProfile.id}`)
    console.log(`   Servicios configurados: ${partner.partnerProfile.services.length}`)
    
    if (partner.partnerProfile.services.length > 0) {
      console.log('\n📋 Servicios del partner:')
      partner.partnerProfile.services.forEach(ps => {
        console.log(`   - ${ps.service.name} (${ps.service.category.name}) - $${ps.price}`)
      })
    } else {
      console.log('\n⚠️  El partner no tiene servicios configurados')
      console.log('   Debe ir a "Gestionar Servicios" para agregar servicios')
    }
    
    const serviceIds = partner.partnerProfile.services.map(ps => ps.serviceId)
    
    const activeRequests = await prisma.serviceRequest.findMany({
      where: {
        serviceId: { in: serviceIds },
        status: 'ACTIVE',
        expiresAt: { gte: new Date() }
      },
      include: {
        service: true,
        user: true
      }
    })
    
    console.log(`\n📨 Solicitudes activas disponibles: ${activeRequests.length}`)
    
    if (activeRequests.length > 0) {
      console.log('\nSolicitudes:')
      activeRequests.forEach(req => {
        console.log(`   - ${req.service.name} por ${req.user.name}`)
        console.log(`     Ciudad: ${req.city}, Expira: ${req.expiresAt.toLocaleString()}`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPartnerData()
