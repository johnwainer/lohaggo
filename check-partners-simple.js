const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    // Check existing partners
    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    })
    
    console.log('\n=== Partners found:', partners.length, '===')
    partners.forEach(p => {
      console.log(`- ${p.user.name} (${p.user.email})`)
    })
    
    // Check if socio1@test.com exists
    const socio1 = await prisma.user.findUnique({
      where: { email: 'socio1@test.com' },
      include: { partnerProfile: true }
    })
    
    if (socio1) {
      console.log('\n=== User socio1@test.com found ===')
      console.log('Has partner profile:', !!socio1.partnerProfile)
      
      if (!socio1.partnerProfile) {
        console.log('\nCreating partner profile for socio1@test.com...')
        await prisma.partnerProfile.create({
          data: {
            userId: socio1.id,
            rating: 4.5,
            totalReviews: 0,
            verified: true
          }
        })
        console.log('✓ Partner profile created successfully!')
      }
    } else {
      console.log('\n✗ User socio1@test.com not found in database')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
