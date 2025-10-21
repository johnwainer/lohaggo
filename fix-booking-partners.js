const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    // Find bookings with invalid partnerId
    const bookings = await prisma.$queryRaw`
      SELECT b.id, b."partnerId", b."userId", b."serviceId"
      FROM "Booking" b
      LEFT JOIN "PartnerProfile" pp ON b."partnerId" = pp.id
      WHERE b."partnerId" IS NOT NULL AND pp.id IS NULL
    `
    
    console.log('\n=== Bookings con partnerId inválido:', bookings.length, '===')
    bookings.forEach(b => {
      console.log(`- Booking ID: ${b.id}, partnerId: ${b.partnerId}`)
    })
    
    if (bookings.length > 0) {
      console.log('\n⚠️  Limpiando bookings con partnerId inválido...')
      
      // Set partnerId to null for these bookings
      const result = await prisma.$executeRaw`
        UPDATE "Booking"
        SET "partnerId" = NULL
        WHERE "partnerId" IS NOT NULL
        AND "partnerId" NOT IN (SELECT id FROM "PartnerProfile")
      `
      
      console.log(`✓ ${result} bookings actualizados (partnerId = NULL)`)
    } else {
      console.log('✓ No hay bookings con partnerId inválido')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
