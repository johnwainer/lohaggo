-- =====================================================
-- MIGRATION SQL FOR PRODUCTION DATABASE
-- Fecha: 2024
-- Descripción: Ajustes y correcciones después de las últimas modificaciones
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNAS FALTANTES EN TABLAS EXISTENTES
-- =====================================================

-- Agregar columnas de rating para clientes en User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "clientRating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "clientTotalReviews" INTEGER DEFAULT 0;

-- Agregar columna mercadopagoCustomerId en User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "mercadopagoCustomerId" TEXT;

-- Crear índice único para mercadopagoCustomerId
CREATE UNIQUE INDEX IF NOT EXISTS "User_mercadopagoCustomerId_key" 
ON "User"("mercadopagoCustomerId");

-- Agregar columnas de comisiones en Booking
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "clientCommissionRate" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "partnerCommissionRate" DOUBLE PRECISION;

-- Agregar columna proposalId en Booking
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "proposalId" TEXT;

-- =====================================================
-- 2. CREAR TABLA Chat SI NO EXISTE
-- =====================================================

CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- Crear índices para Chat
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_proposalId_key" ON "Chat"("proposalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_serviceRequestId_clientId_partnerId_key" 
ON "Chat"("serviceRequestId", "clientId", "partnerId");
CREATE INDEX IF NOT EXISTS "Chat_clientId_idx" ON "Chat"("clientId");
CREATE INDEX IF NOT EXISTS "Chat_partnerId_idx" ON "Chat"("partnerId");
CREATE INDEX IF NOT EXISTS "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");

-- =====================================================
-- 3. CREAR TABLA ChatMessage SI NO EXISTE
-- =====================================================

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- Crear índices para ChatMessage
CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- =====================================================
-- 4. AGREGAR FOREIGN KEYS FALTANTES
-- =====================================================

-- Foreign key para Booking.proposalId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Booking_proposalId_fkey'
    ) THEN
        ALTER TABLE "Booking" 
        ADD CONSTRAINT "Booking_proposalId_fkey" 
        FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Foreign keys para Chat
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Chat_serviceRequestId_fkey'
    ) THEN
        ALTER TABLE "Chat" 
        ADD CONSTRAINT "Chat_serviceRequestId_fkey" 
        FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Chat_proposalId_fkey'
    ) THEN
        ALTER TABLE "Chat" 
        ADD CONSTRAINT "Chat_proposalId_fkey" 
        FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Chat_clientId_fkey'
    ) THEN
        ALTER TABLE "Chat" 
        ADD CONSTRAINT "Chat_clientId_fkey" 
        FOREIGN KEY ("clientId") REFERENCES "User"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Chat_partnerId_fkey'
    ) THEN
        ALTER TABLE "Chat" 
        ADD CONSTRAINT "Chat_partnerId_fkey" 
        FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Foreign key para ChatMessage
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ChatMessage_chatId_fkey'
    ) THEN
        ALTER TABLE "ChatMessage" 
        ADD CONSTRAINT "ChatMessage_chatId_fkey" 
        FOREIGN KEY ("chatId") REFERENCES "Chat"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 5. ACTUALIZAR PLATFORMCONFIG CON VALORES POR DEFECTO
-- =====================================================

-- Agregar columnas de comisión si no existen
ALTER TABLE "PlatformConfig" 
ADD COLUMN IF NOT EXISTS "clientCommissionRate" DOUBLE PRECISION DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS "partnerCommissionRate" DOUBLE PRECISION DEFAULT 10.0;

-- Actualizar valores por defecto si existen registros sin estos valores
UPDATE "PlatformConfig" 
SET "clientCommissionRate" = 5.0 
WHERE "clientCommissionRate" IS NULL;

UPDATE "PlatformConfig" 
SET "partnerCommissionRate" = 10.0 
WHERE "partnerCommissionRate" IS NULL;

-- Insertar configuración por defecto si no existe
INSERT INTO "PlatformConfig" (
    "id",
    "key",
    "commissionRate",
    "clientCommissionRate",
    "partnerCommissionRate",
    "minServicePrice",
    "maxServicePrice",
    "createdAt",
    "updatedAt"
)
SELECT 
    gen_random_uuid()::text,
    'default',
    15.0,
    5.0,
    20.0,
    10000,
    10000000,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "PlatformConfig" WHERE "key" = 'default'
);

-- =====================================================
-- 6. ACTUALIZAR ÍNDICES PARA MEJOR PERFORMANCE
-- =====================================================

-- Índices para Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Índices para Address
CREATE INDEX IF NOT EXISTS "Address_userId_isActive_idx" ON "Address"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");

-- Índices para RequestPhoto
CREATE INDEX IF NOT EXISTS "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");

-- Índices para VerificationDocument
CREATE INDEX IF NOT EXISTS "VerificationDocument_partnerId_status_idx" ON "VerificationDocument"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "VerificationDocument_status_idx" ON "VerificationDocument"("status");

-- Índices para PartnerAchievement
CREATE INDEX IF NOT EXISTS "PartnerAchievement_partnerId_idx" ON "PartnerAchievement"("partnerId");

-- Índices para PaymentMethod
CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX IF NOT EXISTS "PaymentMethod_mercadopagoCardId_idx" ON "PaymentMethod"("mercadopagoCardId");

-- Índices para Payment
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_mercadopagoId_idx" ON "Payment"("mercadopagoId");
CREATE INDEX IF NOT EXISTS "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

-- Índices para Payout
CREATE INDEX IF NOT EXISTS "Payout_partnerId_idx" ON "Payout"("partnerId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");
CREATE INDEX IF NOT EXISTS "Payout_paymentId_idx" ON "Payout"("paymentId");

-- Índice para PlatformConfig
CREATE INDEX IF NOT EXISTS "PlatformConfig_key_idx" ON "PlatformConfig"("key");

-- Índice para Review
CREATE INDEX IF NOT EXISTS "Review_bookingId_idx" ON "Review"("bookingId");

-- =====================================================
-- 7. LIMPIAR DATOS INCONSISTENTES (OPCIONAL)
-- =====================================================

-- Eliminar bookings huérfanos (sin usuario o servicio válido)
-- COMENTADO POR SEGURIDAD - DESCOMENTAR SI ES NECESARIO
-- DELETE FROM "Booking" 
-- WHERE "userId" NOT IN (SELECT "id" FROM "User")
--    OR "serviceId" NOT IN (SELECT "id" FROM "Service");

-- Actualizar bookings con partnerId inválido
UPDATE "Booking" 
SET "partnerId" = NULL 
WHERE "partnerId" IS NOT NULL 
  AND "partnerId" NOT IN (SELECT "id" FROM "PartnerProfile");

-- =====================================================
-- 8. VERIFICAR INTEGRIDAD DE DATOS
-- =====================================================

-- Verificar que todos los usuarios tengan valores por defecto
UPDATE "User" 
SET "clientRating" = 0 
WHERE "clientRating" IS NULL;

UPDATE "User" 
SET "clientTotalReviews" = 0 
WHERE "clientTotalReviews" IS NULL;

-- Verificar que todos los PartnerProfile tengan valores por defecto
UPDATE "PartnerProfile" 
SET "rating" = 0 
WHERE "rating" IS NULL;

UPDATE "PartnerProfile" 
SET "totalReviews" = 0 
WHERE "totalReviews" IS NULL;

UPDATE "PartnerProfile" 
SET "verified" = false 
WHERE "verified" IS NULL;

-- =====================================================
-- 9. ACTUALIZAR TIMESTAMPS
-- =====================================================

-- Asegurar que todas las tablas tengan updatedAt actualizado
UPDATE "User" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "PartnerProfile" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "Booking" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "ServiceRequest" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "Proposal" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

-- Verificar que todo esté correcto
SELECT 'Migration completed successfully!' as status;
