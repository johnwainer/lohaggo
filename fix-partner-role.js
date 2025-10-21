const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    // Check socio1@test.com
    const socio1 = await prisma.user.findUnique({
      where: { email: 'socio1@test.com' },
      include: { partnerProfile: true }
    })
    
    if (socio1) {
      console.log('\n=== User socio1@test.com ===')
      console.log('Name:', socio1.name)
      console.log('Role:', socio1.role)
      console.log('Has partner profile:', !!socio1.partnerProfile)
      
      if (socio1.role !== 'PARTNER') {
        console.log('\n⚠️  User role is not PARTNER, updating...')
        await prisma.user.update({
          where: { id: socio1.id },
          data: { role: 'PARTNER' }
        })
        console.log('✓ User role updated to PARTNER')
      } else {
        console.log('✓ User already has PARTNER role')
      }
    } else {
      console.log('\n✗ User socio1@test.com not found')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
