-- Migration: Update Advertisement table for service-specific ads with city filtering
-- Date: 2024-12-05
-- Description: Remove CATEGORY placement, add serviceId for SERVICE ads, add cityId relation to CityConfig

-- Step 1: Add serviceId column (nullable)
ALTER TABLE "Advertisement" 
ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

-- Step 2: Add cityId column (nullable initially)
ALTER TABLE "Advertisement" 
ADD COLUMN IF NOT EXISTS "cityId" TEXT;

-- Step 3: Set default cityId to first active city for existing records
UPDATE "Advertisement" 
SET "cityId" = (SELECT id FROM "CityConfig" WHERE status = 'ACTIVE' ORDER BY "order" LIMIT 1)
WHERE "cityId" IS NULL;

-- Step 4: Update existing CATEGORY ads to HOME BEFORE modifying the enum
UPDATE "Advertisement" 
SET "placement" = 'HOME' 
WHERE "placement"::text = 'CATEGORY';

-- Step 5: Drop old city enum column if it exists
ALTER TABLE "Advertisement" 
DROP COLUMN IF EXISTS "city";

-- Step 6: Add foreign key constraint for serviceId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Advertisement_serviceId_fkey'
    ) THEN
        ALTER TABLE "Advertisement"
        ADD CONSTRAINT "Advertisement_serviceId_fkey" 
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 7: Add foreign key constraint for cityId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Advertisement_cityId_fkey'
    ) THEN
        ALTER TABLE "Advertisement"
        ADD CONSTRAINT "Advertisement_cityId_fkey" 
        FOREIGN KEY ("cityId") REFERENCES "CityConfig"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS "Advertisement_serviceId_idx" 
ON "Advertisement"("serviceId");

CREATE INDEX IF NOT EXISTS "Advertisement_cityId_idx" 
ON "Advertisement"("cityId");

-- Step 9: Remove CATEGORY from enum (requires recreating the enum)
-- First, check if the new enum already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdPlacement_new') THEN
        CREATE TYPE "AdPlacement_new" AS ENUM ('HOME', 'SERVICE');
    END IF;
END $$;

-- Update the column to use the new enum
ALTER TABLE "Advertisement" 
ALTER COLUMN "placement" TYPE "AdPlacement_new" 
USING ("placement"::text::"AdPlacement_new");

-- Drop the old enum if it exists and is different
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdPlacement') THEN
        DROP TYPE "AdPlacement";
    END IF;
END $$;

-- Rename the new enum to the original name
ALTER TYPE "AdPlacement_new" RENAME TO "AdPlacement";

-- Step 10: Make cityId column NOT NULL after setting defaults
ALTER TABLE "Advertisement" 
ALTER COLUMN "cityId" SET NOT NULL;

-- Verification queries (run these to verify the migration)
-- SELECT * FROM "Advertisement" WHERE "placement"::text = 'CATEGORY'; -- Should return 0 rows
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'Advertisement' ORDER BY ordinal_position;
-- SELECT a.id, a.title, c.name as city_name, c.slug as city_slug FROM "Advertisement" a JOIN "CityConfig" c ON a."cityId" = c.id;
-- SELECT COUNT(*) as total_ads, c.name as city FROM "Advertisement" a JOIN "CityConfig" c ON a."cityId" = c.id GROUP BY c.name;
