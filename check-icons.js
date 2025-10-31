const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const categories = await prisma.category.findMany({ take: 5 })
  console.log('Categories:')
  categories.forEach(cat => {
    console.log(`- ${cat.name}: icon="${cat.icon}"`)
  })
  
  const services = await prisma.service.findMany({ take: 5, include: { category: true } })
  console.log('\nServices:')
  services.forEach(svc => {
    console.log(`- ${svc.name}: icon="${svc.icon}"`)
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
  })
