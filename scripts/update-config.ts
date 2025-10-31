import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Updating PlatformConfig...\n')
  
  const configs = await prisma.platformConfig.findMany()
  
  if (configs.length === 0) {
    console.log('❌ No PlatformConfig found')
    return
  }
  
  for (const config of configs) {
    console.log(`Updating config: ${config.key}`)
    console.log(`  Current clientCommissionRate: ${config.clientCommissionRate}%`)
    
    const updated = await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        clientCommissionRate: 5.0,
        commissionRate: 15.0
      }
    })
    
    console.log(`  ✅ Updated clientCommissionRate: ${updated.clientCommissionRate}%`)
    console.log(`  ✅ Updated commissionRate: ${updated.commissionRate}%\n`)
  }
  
  console.log('✅ All configs updated successfully!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
