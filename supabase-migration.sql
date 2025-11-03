-- Migration SQL para Supabase
-- Nuevas funcionalidades: Sistema de Chat y Validación de Precios

-- 1. Agregar nuevo tipo de notificación
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_MESSAGE';

-- 2. Crear tabla Chat
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

-- 3. Crear tabla ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- 4. Crear índices únicos para Chat
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_proposalId_key" ON "Chat"("proposalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_serviceRequestId_clientId_partnerId_key" ON "Chat"("serviceRequestId", "clientId", "partnerId");

-- 5. Crear índices para Chat
CREATE INDEX IF NOT EXISTS "Chat_clientId_idx" ON "Chat"("clientId");
CREATE INDEX IF NOT EXISTS "Chat_partnerId_idx" ON "Chat"("partnerId");
CREATE INDEX IF NOT EXISTS "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");

-- 6. Crear índices para ChatMessage
CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- 7. Agregar foreign keys para Chat
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_serviceRequestId_fkey" 
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Chat" ADD CONSTRAINT "Chat_proposalId_fkey" 
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chat" ADD CONSTRAINT "Chat_clientId_fkey" 
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Chat" ADD CONSTRAINT "Chat_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Agregar foreign key para ChatMessage
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" 
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" 
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Verificar que la columna basePrice existe en Service (debería existir)
-- Si no existe, descomentar la siguiente línea:
-- ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Fin de la migración
