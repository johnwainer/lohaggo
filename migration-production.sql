-- =====================================================
-- MIGRACIÓN DE BASE DE DATOS PARA PRODUCCIÓN
-- Fecha: 2025-01-XX
-- Descripción: Agregar campos de comisión a Booking y actualizar configuración
-- =====================================================

-- 1. Agregar campos de comisión al modelo Booking
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "clientCommissionRate" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "partnerCommissionRate" DOUBLE PRECISION;

-- 2. Actualizar o crear configuración de plataforma con valores por defecto
INSERT INTO "PlatformConfig" (
  id,
  key,
  "commissionRate",
  "clientCommissionRate",
  "partnerCommissionRate",
  "minServicePrice",
  "maxServicePrice",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'default',
  15.0,
  5.0,
  20.0,
  10000,
  10000000,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0,
  "commissionRate" = 15.0,
  "updatedAt" = NOW();

-- 3. Actualizar bookings existentes con las tarifas actuales
-- (Solo los que no tienen tarifas asignadas)
UPDATE "Booking"
SET 
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0
WHERE 
  "clientCommissionRate" IS NULL 
  OR "partnerCommissionRate" IS NULL;

-- 4. Verificar los cambios
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN "clientCommissionRate" IS NOT NULL THEN 1 END) as bookings_with_client_rate,
  COUNT(CASE WHEN "partnerCommissionRate" IS NOT NULL THEN 1 END) as bookings_with_partner_rate
FROM "Booking";

-- 5. Verificar configuración de plataforma
SELECT 
  key,
  "clientCommissionRate",
  "partnerCommissionRate",
  "commissionRate"
FROM "PlatformConfig"
WHERE key = 'default';

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Este script es idempotente (se puede ejecutar múltiples veces)
-- 2. Los campos son opcionales (nullable) para mantener compatibilidad
-- 3. Los bookings existentes se actualizan con las tarifas actuales
-- 4. Los nuevos bookings guardarán las tarifas al momento de creación
-- 5. Si ya existe la configuración 'default', solo se actualizan las tarifas
-- =====================================================
