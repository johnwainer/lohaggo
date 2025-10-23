-- ============================================
-- AGREGAR COLUMNAS Y TABLAS FALTANTES
-- Ejecuta este SQL DESPUÉS de full_migration.sql
-- ============================================

-- 1. Agregar columna pushSubscription a User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "pushSubscription" TEXT;

-- 2. Agregar columna city a PartnerProfile
ALTER TABLE "PartnerProfile" 
ADD COLUMN IF NOT EXISTS "city" "City" NOT NULL DEFAULT 'MEDELLIN';

-- 3. Agregar columnas faltantes a ServiceRequest
ALTER TABLE "ServiceRequest" 
ADD COLUMN IF NOT EXISTS "preferredDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "preferredTime" TEXT,
ADD COLUMN IF NOT EXISTS "isUrgent" BOOLEAN NOT NULL DEFAULT false;

-- 4. Agregar columna city a PartnerService
ALTER TABLE "PartnerService" 
ADD COLUMN IF NOT EXISTS "city" "City" NOT NULL DEFAULT 'MEDELLIN';

-- 5. Crear enum NotificationType si no existe
DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Crear tabla Notification
CREATE TABLE IF NOT EXISTS "Notification" (
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

-- 7. Crear tabla Address
CREATE TABLE IF NOT EXISTS "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "postalCode" TEXT,
    "instructions" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- 8. Agregar foreign keys si no existen
DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 9. Crear índices
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "Address_userId_isActive_idx" ON "Address"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");

-- 10. Verificar que todo se creó correctamente
SELECT 'User.pushSubscription' as check_name, 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'User' AND column_name = 'pushSubscription'
       ) THEN '✓ OK' ELSE '✗ MISSING' END as status
UNION ALL
SELECT 'PartnerProfile.city', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'PartnerProfile' AND column_name = 'city'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'ServiceRequest.preferredDate', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ServiceRequest' AND column_name = 'preferredDate'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'ServiceRequest.preferredTime', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ServiceRequest' AND column_name = 'preferredTime'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'ServiceRequest.isUrgent', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ServiceRequest' AND column_name = 'isUrgent'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'PartnerService.city', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'PartnerService' AND column_name = 'city'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'Notification table', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.tables 
           WHERE table_name = 'Notification'
       ) THEN '✓ OK' ELSE '✗ MISSING' END
UNION ALL
SELECT 'Address table', 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.tables 
           WHERE table_name = 'Address'
       ) THEN '✓ OK' ELSE '✗ MISSING' END;
