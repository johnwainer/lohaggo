import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function initializeCompletedServicesCount() {
  console.log('Initializing completed services count for existing users and partners...')

  const completedBookings = await prisma.booking.findMany({
    where: {
      status: 'COMPLETED',
      payment: {
        status: 'APPROVED'
      }
    },
    include: {
      payment: true
    }
  })

  console.log(`Found ${completedBookings.length} completed and paid bookings`)

  const userCounts = new Map<string, number>()
  const partnerCounts = new Map<string, number>()

  for (const booking of completedBookings) {
    userCounts.set(booking.userId, (userCounts.get(booking.userId) || 0) + 1)
    
    if (booking.partnerId) {
      partnerCounts.set(booking.partnerId, (partnerCounts.get(booking.partnerId) || 0) + 1)
    }
  }

  console.log(`Updating ${userCounts.size} users...`)
  for (const [userId, count] of Array.from(userCounts.entries())) {
    await prisma.user.update({
      where: { id: userId },
      data: { completedServicesCount: count }
    })
  }

  console.log(`Updating ${partnerCounts.size} partners...`)
  for (const [partnerId, count] of Array.from(partnerCounts.entries())) {
    await prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { completedServicesCount: count }
    })
  }

  console.log('Completed services count initialization complete!')
}

initializeCompletedServicesCount()
  .catch((error) => {
    console.error('Error initializing completed services count:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
