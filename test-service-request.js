const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testServiceRequest() {
  try {
    console.log('Testing service request creation...')
    
    // First, check if the service exists
    const service = await prisma.service.findUnique({
      where: { id: 'cmh00zdml002dlgwejwnahygl' }
    })
    
    console.log('Service found:', service ? 'YES' : 'NO')
    if (service) {
      console.log('Service:', service.name)
    }
    
    // Check if user exists (you'll need to replace with actual user ID)
    const users = await prisma.user.findMany({ take: 1 })
    console.log('Users found:', users.length)
    
    if (users.length > 0 && service) {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      
      console.log('Creating service request...')
      const serviceRequest = await prisma.serviceRequest.create({
        data: {
          userId: users[0].id,
          serviceId: service.id,
          address: 'Test Address',
          notes: 'Test notes',
          city: 'MEDELLIN',
          status: 'ACTIVE',
          expiresAt: expiresAt
        }
      })
      
      console.log('Service request created successfully:', serviceRequest.id)
    }
    
  } catch (error) {
    console.error('Error:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testServiceRequest()
