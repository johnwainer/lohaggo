-- Migration: Add Review System
-- Description: Adds mutual rating system for clients and partners

-- Step 1: Add rating fields to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "clientRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "clientTotalReviews" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Create Review table
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientToPartnerRating" INTEGER,
    "clientToPartnerComment" TEXT,
    "clientReviewedAt" TIMESTAMP(3),
    "partnerToClientRating" INTEGER,
    "partnerToClientComment" TEXT,
    "partnerReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create unique constraint on bookingId
CREATE UNIQUE INDEX IF NOT EXISTS "Review_bookingId_key" ON "Review"("bookingId");

-- Step 4: Create index for faster queries
CREATE INDEX IF NOT EXISTS "Review_bookingId_idx" ON "Review"("bookingId");

-- Step 5: Add foreign key constraint
ALTER TABLE "Review" 
ADD CONSTRAINT "Review_bookingId_fkey" 
FOREIGN KEY ("bookingId") 
REFERENCES "Booking"("id") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Step 6: Add comments to document the schema
COMMENT ON TABLE "Review" IS 'Stores mutual ratings between clients and partners for completed bookings';
COMMENT ON COLUMN "Review"."clientToPartnerRating" IS 'Rating given by client to partner (1-5 stars)';
COMMENT ON COLUMN "Review"."partnerToClientRating" IS 'Rating given by partner to client (1-5 stars)';
COMMENT ON COLUMN "User"."clientRating" IS 'Average rating of the client as rated by partners';
COMMENT ON COLUMN "User"."clientTotalReviews" IS 'Total number of reviews received by the client';

-- Verification queries (optional - run these to verify the migration)
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'User' AND column_name IN ('clientRating', 'clientTotalReviews');

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'Review';
