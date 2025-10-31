import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking PlatformConfig...\n')
  
  const configs = await prisma.platformConfig.findMany()
  
  if (configs.length === 0) {
    console.log('❌ No PlatformConfig found in database')
    console.log('Creating default config...\n')
    
    const newConfig = await prisma.platformConfig.create({
      data: {
        key: 'default',
        commissionRate: 15.0,
        clientCommissionRate: 5.0,
        partnerCommissionRate: 20.0,
        minServicePrice: 10000,
        maxServicePrice: 10000000,
      }
    })
    
    console.log('✅ Created default config:')
    console.log(JSON.stringify(newConfig, null, 2))
  } else {
    console.log(`✅ Found ${configs.length} config(s):\n`)
    configs.forEach((config, index) => {
      console.log(`Config ${index + 1}:`)
      console.log(`  Key: ${config.key}`)
      console.log(`  Client Commission Rate: ${config.clientCommissionRate}%`)
      console.log(`  Partner Commission Rate: ${config.partnerCommissionRate}%`)
      console.log(`  Commission Rate: ${config.commissionRate}%`)
      console.log('')
    })
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
