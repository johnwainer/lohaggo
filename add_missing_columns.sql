-- ============================================
-- AGREGAR COLUMNAS FALTANTES
-- Ejecuta este SQL DESPUÉS de full_migration.sql
-- ============================================

-- Agregar columna pushSubscription a User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "pushSubscription" TEXT;

-- Agregar columna city a PartnerProfile
ALTER TABLE "PartnerProfile" 
ADD COLUMN IF NOT EXISTS "city" "City" NOT NULL DEFAULT 'MEDELLIN';

-- Verificar que las columnas se agregaron
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'pushSubscription';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'PartnerProfile' AND column_name = 'city';
