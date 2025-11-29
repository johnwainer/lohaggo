import { PrismaClient } from '@prisma/client'

const productionUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL

if (!productionUrl) {
  console.error('❌ No production database URL found')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionUrl
    }
  }
})

async function addColumns() {
  try {
    console.log('🔄 Adding missing columns to CityConfig table...')
    
    await prisma.$executeRaw`
      ALTER TABLE "CityConfig" 
      ADD COLUMN IF NOT EXISTS "lanzamiento" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "fechaLanzamiento" TIMESTAMP(3);
    `
    
    console.log('✅ Columns added successfully to production database')
    
    const cities = await prisma.cityConfig.findMany()
    console.log(`📊 Found ${cities.length} cities:`)
    cities.forEach(city => {
      console.log(`  - ${city.name} (${city.status})`)
    })
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addColumns()
