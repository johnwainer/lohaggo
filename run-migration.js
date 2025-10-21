const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function migrate() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "NotificationType" AS ENUM (
        'NEW_SERVICE_REQUEST', 
        'NEW_PROPOSAL', 
        'PROPOSAL_ACCEPTED', 
        'PROPOSAL_REJECTED', 
        'BOOKING_CONFIRMED', 
        'BOOKING_CANCELLED', 
        'BOOKING_IN_PROGRESS', 
        'BOOKING_COMPLETED'
      );
    `)
    console.log('✓ Created NotificationType enum')
  } catch (e) {
    console.log('NotificationType enum already exists')
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "pushSubscription" TEXT;
    `)
    console.log('✓ Added pushSubscription to User')
  } catch (e) {
    console.log('pushSubscription column already exists')
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Notification" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" "NotificationType" NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "data" TEXT,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
      );
    `)
    console.log('✓ Created Notification table')
  } catch (e) {
    console.log('Notification table already exists')
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
    `)
    console.log('✓ Created userId_read index')
  } catch (e) {
    console.log('Index already exists')
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
    `)
    console.log('✓ Created createdAt index')
  } catch (e) {
    console.log('Index already exists')
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Notification" 
      ADD CONSTRAINT "Notification_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    console.log('✓ Added foreign key constraint')
  } catch (e) {
    console.log('Foreign key already exists')
  }

  console.log('\n✅ Migration completed!')
  await prisma.$disconnect()
}

migrate().catch(console.error)
