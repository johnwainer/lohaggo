-- =====================================================
-- HAGGO - MIGRACIÓN INCREMENTAL (SIN BORRAR DATOS)
-- =====================================================
-- Este script agrega solo las columnas y tablas nuevas
-- SIN BORRAR datos existentes
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNA proposalId A BOOKING
-- =====================================================

-- Agregar columna proposalId si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Booking' AND column_name = 'proposalId'
  ) THEN
    ALTER TABLE "Booking" ADD COLUMN "proposalId" TEXT;
  END IF;
END $$;

-- Agregar foreign key si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Booking_proposalId_fkey'
  ) THEN
    ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_proposalId_fkey" 
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 2. CREAR TABLA CHAT (SI NO EXISTE)
-- =====================================================

CREATE TABLE IF NOT EXISTS "Chat" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "proposalId" TEXT UNIQUE NOT NULL,
  "clientId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chat_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id"),
  CONSTRAINT "Chat_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id"),
  CONSTRAINT "Chat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id"),
  CONSTRAINT "Chat_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id"),
  CONSTRAINT "Chat_serviceRequestId_clientId_partnerId_key" UNIQUE ("serviceRequestId", "clientId", "partnerId")
);

-- Crear índices para Chat
CREATE INDEX IF NOT EXISTS "Chat_clientId_idx" ON "Chat"("clientId");
CREATE INDEX IF NOT EXISTS "Chat_partnerId_idx" ON "Chat"("partnerId");
CREATE INDEX IF NOT EXISTS "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");

-- =====================================================
-- 3. CREAR TABLA CHATMESSAGE (SI NO EXISTE)
-- =====================================================

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE
);

-- Crear índices para ChatMessage
CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- =====================================================
-- 4. VERIFICAR TABLAS CREADAS
-- =====================================================

-- Verificar que proposalId existe en Booking
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'Booking' AND column_name = 'proposalId'
    ) THEN '✅ Booking.proposalId creado'
    ELSE '❌ ERROR: Booking.proposalId no existe'
  END as status;

-- Verificar que Chat existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'Chat'
    ) THEN '✅ Tabla Chat creada'
    ELSE '❌ ERROR: Tabla Chat no existe'
  END as status;

-- Verificar que ChatMessage existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'ChatMessage'
    ) THEN '✅ Tabla ChatMessage creada'
    ELSE '❌ ERROR: Tabla ChatMessage no existe'
  END as status;

-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================
-- ✅ proposalId agregado a Booking
-- ✅ Tabla Chat creada
-- ✅ Tabla ChatMessage creada
-- ✅ Índices creados
-- ✅ Datos existentes preservados
-- =====================================================
