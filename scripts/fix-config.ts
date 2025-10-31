import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixConfig() {
  try {
    console.log('🔧 Corrigiendo configuración de comisiones...\n')

    const config = await prisma.platformConfig.findFirst()

    if (!config) {
      console.log('❌ No se encontró configuración')
      return
    }

    console.log('📊 Configuración ANTES:')
    console.log(`   Comisión Cliente: ${config.clientCommissionRate}%`)
    console.log(`   Comisión Socio: ${config.partnerCommissionRate}%`)
    console.log('')

    // Actualizar la configuración
    const updated = await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        clientCommissionRate: 0,
        partnerCommissionRate: 20,
      },
    })

    console.log('✅ Configuración DESPUÉS:')
    console.log(`   Comisión Cliente: ${updated.clientCommissionRate}%`)
    console.log(`   Comisión Socio: ${updated.partnerCommissionRate}%`)
    console.log('')

    // Mostrar ejemplo
    const serviceAmount = 100000
    const clientCommission = (serviceAmount * updated.clientCommissionRate) / 100
    const totalClientPays = serviceAmount + clientCommission
    const partnerCommission = (serviceAmount * updated.partnerCommissionRate) / 100
    const partnerReceives = serviceAmount - partnerCommission

    console.log('💰 Ejemplo con servicio de $100,000 COP:')
    console.log(`   Cliente paga: $${totalClientPays.toLocaleString('es-CO')} COP (sin comisión)`)
    console.log(`   Socio recibe: $${partnerReceives.toLocaleString('es-CO')} COP`)
    console.log(`   Plataforma gana: $${(clientCommission + partnerCommission).toLocaleString('es-CO')} COP (${updated.partnerCommissionRate}% del servicio)`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixConfig()
