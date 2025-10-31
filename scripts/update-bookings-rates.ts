import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Actualizando bookings existentes con tarifas de comisión...\n')
  
  const config = await prisma.platformConfig.findFirst({
    where: { key: 'default' }
  }) || await prisma.platformConfig.findFirst()
  
  if (!config) {
    console.log('❌ No se encontró configuración de plataforma')
    return
  }
  
  console.log('📊 Tarifas actuales:')
  console.log(`  Client Commission Rate: ${config.clientCommissionRate}%`)
  console.log(`  Partner Commission Rate: ${config.partnerCommissionRate}%\n`)
  
  const bookingsWithoutRates = await prisma.booking.findMany({
    where: {
      OR: [
        { clientCommissionRate: null },
        { partnerCommissionRate: null }
      ]
    }
  })
  
  console.log(`📦 Encontrados ${bookingsWithoutRates.length} bookings sin tarifas\n`)
  
  if (bookingsWithoutRates.length === 0) {
    console.log('✅ Todos los bookings ya tienen tarifas asignadas')
    return
  }
  
  for (const booking of bookingsWithoutRates) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        clientCommissionRate: config.clientCommissionRate,
        partnerCommissionRate: config.partnerCommissionRate
      }
    })
    console.log(`✅ Actualizado booking ${booking.id}`)
  }
  
  console.log(`\n✅ Se actualizaron ${bookingsWithoutRates.length} bookings exitosamente!`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
