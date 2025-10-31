const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn', 'info'],
})

async function main() {
  console.log('🔍 Testing Prisma connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set')
  console.log('POSTGRES_PRISMA_URL:', process.env.POSTGRES_PRISMA_URL ? '✅ Set' : '❌ Not set')
  
  try {
    console.log('\n📊 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Connected to database')
    
    console.log('\n📋 Fetching categories...')
    const categories = await prisma.category.findMany({ take: 5 })
    console.log(`✅ Found ${categories.length} categories:`)
    categories.forEach(cat => console.log(`  - ${cat.name}`))
    
    console.log('\n✅ All tests passed!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main()
