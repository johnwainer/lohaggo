-- =====================================================
-- HAGGO - MIGRACIÓN COMPLETA PARA SUPABASE
-- =====================================================
-- Este script crea todas las tablas necesarias
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- PASO 1: CREAR TIPOS ENUM (SI NO EXISTEN)
-- =====================================================

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PARTNER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceRequestStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "City" AS ENUM ('MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'NEW_SERVICE_REQUEST',
    'NEW_PROPOSAL',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_IN_PROGRESS',
    'BOOKING_COMPLETED',
    'DOCUMENT_APPROVED',
    'DOCUMENT_REJECTED',
    'ACHIEVEMENT_UNLOCKED',
    'NEW_MESSAGE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM (
    'CEDULA_CIUDADANIA',
    'CEDULA_EXTRANJERIA',
    'PASAPORTE',
    'PEP',
    'DIPLOMA_BACHILLERATO',
    'DIPLOMA_TECNICO',
    'DIPLOMA_TECNOLOGO',
    'DIPLOMA_PROFESIONAL',
    'DIPLOMA_POSGRADO',
    'CERTIFICADO_CURSO',
    'ANTECEDENTES'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AchievementType" AS ENUM (
    'IDENTITY_VERIFIED',
    'EDUCATION_VERIFIED',
    'BACKGROUND_CHECK_VERIFIED',
    'FIRST_SERVICE',
    'TEN_SERVICES',
    'FIFTY_SERVICES',
    'HUNDRED_SERVICES',
    'FIVE_STAR_RATING',
    'VERIFIED_PARTNER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PASO 2: CREAR TABLAS (SI NO EXISTEN)
-- =====================================================

-- Tabla: User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "phone" TEXT,
  "image" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
  "pushSubscription" TEXT,
  "clientRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "clientTotalReviews" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mercadopagoCustomerId" TEXT UNIQUE
);

-- Tabla: PartnerProfile
CREATE TABLE IF NOT EXISTS "PartnerProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE NOT NULL,
  "bio" TEXT,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalReviews" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Category
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "icon" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- Tabla: Service
CREATE TABLE IF NOT EXISTS "Service" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "basePrice" DOUBLE PRECISION NOT NULL,
  "duration" INTEGER NOT NULL,
  "popular" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: PartnerService
CREATE TABLE IF NOT EXISTS "PartnerService" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Availability
CREATE TABLE IF NOT EXISTS "Availability" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "partnerServiceId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

-- Tabla: ServiceRequest
CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "notes" TEXT,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "preferredDate" TIMESTAMP(3),
  "preferredTime" TEXT,
  "isUrgent" BOOLEAN NOT NULL DEFAULT false,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Proposal
CREATE TABLE IF NOT EXISTS "Proposal" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Booking
CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "partnerId" TEXT,
  "proposalId" TEXT,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "scheduledTime" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "notes" TEXT,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "totalPrice" DOUBLE PRECISION NOT NULL,
  "clientCommissionRate" DOUBLE PRECISION,
  "partnerCommissionRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Review
CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT UNIQUE NOT NULL,
  "clientToPartnerRating" INTEGER,
  "clientToPartnerComment" TEXT,
  "clientReviewedAt" TIMESTAMP(3),
  "partnerToClientRating" INTEGER,
  "partnerToClientComment" TEXT,
  "partnerReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Notification
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Address
CREATE TABLE IF NOT EXISTS "Address" (
  "id" TEXT PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: RequestPhoto
CREATE TABLE IF NOT EXISTS "RequestPhoto" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: VerificationDocument
CREATE TABLE IF NOT EXISTS "VerificationDocument" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "documentUrl" TEXT NOT NULL,
  "publicId" TEXT,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Achievement
CREATE TABLE IF NOT EXISTS "Achievement" (
  "id" TEXT PRIMARY KEY,
  "type" "AchievementType" UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: PartnerAchievement
CREATE TABLE IF NOT EXISTS "PartnerAchievement" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: PaymentMethod
CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "mercadopagoCardId" TEXT UNIQUE,
  "cardToken" TEXT,
  "lastFourDigits" TEXT NOT NULL,
  "cardBrand" TEXT NOT NULL,
  "cardholderName" TEXT NOT NULL,
  "expirationMonth" INTEGER NOT NULL,
  "expirationYear" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Payment
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentMethodId" TEXT,
  "mercadopagoId" TEXT UNIQUE,
  "preferenceId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "serviceAmount" DOUBLE PRECISION NOT NULL,
  "clientCommission" DOUBLE PRECISION NOT NULL,
  "clientCommissionRate" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethodType" TEXT,
  "paymentType" TEXT,
  "transactionAmount" DOUBLE PRECISION,
  "netReceivedAmount" DOUBLE PRECISION,
  "mercadopagoFee" DOUBLE PRECISION,
  "metadata" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Payout
CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT UNIQUE NOT NULL,
  "partnerId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "partnerCommission" DOUBLE PRECISION NOT NULL,
  "partnerCommissionRate" DOUBLE PRECISION NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "processedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: PlatformConfig
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT UNIQUE NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL,
  "clientCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "partnerCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "minServicePrice" DOUBLE PRECISION NOT NULL,
  "maxServicePrice" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Chat
CREATE TABLE IF NOT EXISTS "Chat" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "proposalId" TEXT UNIQUE NOT NULL,
  "clientId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PASO 3: AGREGAR FOREIGN KEYS (SI NO EXISTEN)
-- =====================================================

DO $$ BEGIN
  ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" 
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_serviceId_fkey" 
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerServiceId_fkey" 
  FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceId_fkey" 
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" 
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" 
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_proposalId_fkey" 
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_serviceRequestId_fkey" 
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PartnerAchievement" ADD CONSTRAINT "PartnerAchievement_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PartnerAchievement" ADD CONSTRAINT "PartnerAchievement_achievementId_fkey" 
  FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" 
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" 
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Chat" ADD CONSTRAINT "Chat_serviceRequestId_fkey" 
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Chat" ADD CONSTRAINT "Chat_proposalId_fkey" 
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Chat" ADD CONSTRAINT "Chat_clientId_fkey" 
  FOREIGN KEY ("clientId") REFERENCES "User"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Chat" ADD CONSTRAINT "Chat_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PASO 4: CREAR ÍNDICES (SI NO EXISTEN)
-- =====================================================

CREATE INDEX IF NOT EXISTS "PartnerService_partnerId_serviceId_key" ON "PartnerService"("partnerId", "serviceId");
CREATE INDEX IF NOT EXISTS "Proposal_serviceRequestId_partnerId_key" ON "Proposal"("serviceRequestId", "partnerId");
CREATE INDEX IF NOT EXISTS "Review_bookingId_idx" ON "Review"("bookingId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "Address_userId_isActive_idx" ON "Address"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");
CREATE INDEX IF NOT EXISTS "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "VerificationDocument_partnerId_status_idx" ON "VerificationDocument"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "VerificationDocument_status_idx" ON "VerificationDocument"("status");
CREATE INDEX IF NOT EXISTS "PartnerAchievement_partnerId_idx" ON "PartnerAchievement"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnerAchievement_partnerId_achievementId_key" ON "PartnerAchievement"("partnerId", "achievementId");
CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payout_partnerId_idx" ON "Payout"("partnerId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");
CREATE INDEX IF NOT EXISTS "Chat_clientId_idx" ON "Chat"("clientId");
CREATE INDEX IF NOT EXISTS "Chat_partnerId_idx" ON "Chat"("partnerId");
CREATE INDEX IF NOT EXISTS "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "Chat_serviceRequestId_clientId_partnerId_key" ON "Chat"("serviceRequestId", "clientId", "partnerId");
CREATE INDEX IF NOT EXISTS "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- =====================================================
-- PASO 5: INSERTAR CONFIGURACIÓN INICIAL
-- =====================================================

INSERT INTO "PlatformConfig" ("id", "key", "commissionRate", "clientCommissionRate", "partnerCommissionRate", "minServicePrice", "maxServicePrice", "createdAt", "updatedAt")
VALUES (
  'default',
  'default',
  5.0,
  5.0,
  20.0,
  10000,
  10000000,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================
-- ✅ Todos los tipos ENUM creados
-- ✅ Todas las tablas creadas
-- ✅ Todas las foreign keys agregadas
-- ✅ Todos los índices creados
-- ✅ Configuración inicial insertada
-- ✅ Chat.partnerId referencia a PartnerProfile (CORREGIDO)
-- =====================================================
