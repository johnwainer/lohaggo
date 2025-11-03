-- =====================================================
-- HAGGO - MIGRACIÓN COMPLETA PARA SUPABASE
-- =====================================================
-- Este script crea todas las tablas, índices y datos iniciales
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- Limpiar tablas existentes (CUIDADO: Esto borra todos los datos)
DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "Chat" CASCADE;
DROP TABLE IF EXISTS "Payout" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "PaymentMethod" CASCADE;
DROP TABLE IF EXISTS "PartnerAchievement" CASCADE;
DROP TABLE IF EXISTS "Achievement" CASCADE;
DROP TABLE IF EXISTS "VerificationDocument" CASCADE;
DROP TABLE IF EXISTS "RequestPhoto" CASCADE;
DROP TABLE IF EXISTS "Address" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "Proposal" CASCADE;
DROP TABLE IF EXISTS "ServiceRequest" CASCADE;
DROP TABLE IF EXISTS "Review" CASCADE;
DROP TABLE IF EXISTS "Booking" CASCADE;
DROP TABLE IF EXISTS "Availability" CASCADE;
DROP TABLE IF EXISTS "PartnerService" CASCADE;
DROP TABLE IF EXISTS "Service" CASCADE;
DROP TABLE IF EXISTS "Category" CASCADE;
DROP TABLE IF EXISTS "PartnerProfile" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "PlatformConfig" CASCADE;

-- Eliminar tipos enum existentes
DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "BookingStatus" CASCADE;
DROP TYPE IF EXISTS "ServiceRequestStatus" CASCADE;
DROP TYPE IF EXISTS "ProposalStatus" CASCADE;
DROP TYPE IF EXISTS "City" CASCADE;
DROP TYPE IF EXISTS "NotificationType" CASCADE;
DROP TYPE IF EXISTS "DocumentType" CASCADE;
DROP TYPE IF EXISTS "DocumentStatus" CASCADE;
DROP TYPE IF EXISTS "AchievementType" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "PayoutStatus" CASCADE;

-- =====================================================
-- CREAR TIPOS ENUM
-- =====================================================

CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PARTNER', 'ADMIN');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "City" AS ENUM ('MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA');
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
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
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
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- =====================================================
-- CREAR TABLAS
-- =====================================================

-- Tabla: User
CREATE TABLE "User" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "mercadopagoCustomerId" TEXT UNIQUE
);

-- Tabla: PartnerProfile
CREATE TABLE "PartnerProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE NOT NULL,
  "bio" TEXT,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalReviews" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabla: Category
CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "icon" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- Tabla: Service
CREATE TABLE "Service" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
);

-- Tabla: PartnerService
CREATE TABLE "PartnerService" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "city" "City" NOT NULL DEFAULT 'MEDELLIN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE,
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id"),
  UNIQUE ("partnerId", "serviceId")
);

-- Tabla: Availability
CREATE TABLE "Availability" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "partnerServiceId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE,
  FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE CASCADE
);

-- Tabla: ServiceRequest
CREATE TABLE "ServiceRequest" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
);

-- Tabla: Proposal
CREATE TABLE "Proposal" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE,
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id"),
  UNIQUE ("serviceRequestId", "partnerId")
);

-- Tabla: Booking
CREATE TABLE "Booking" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id"),
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id"),
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
);

-- Tabla: Review
CREATE TABLE "Review" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT UNIQUE NOT NULL,
  "clientToPartnerRating" INTEGER,
  "clientToPartnerComment" TEXT,
  "clientReviewedAt" TIMESTAMP(3),
  "partnerToClientRating" INTEGER,
  "partnerToClientComment" TEXT,
  "partnerReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE
);

-- Tabla: Notification
CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabla: Address
CREATE TABLE "Address" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabla: RequestPhoto
CREATE TABLE "RequestPhoto" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE
);

-- Tabla: VerificationDocument
CREATE TABLE "VerificationDocument" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE
);

-- Tabla: Achievement
CREATE TABLE "Achievement" (
  "id" TEXT PRIMARY KEY,
  "type" "AchievementType" UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: PartnerAchievement
CREATE TABLE "PartnerAchievement" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE,
  FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id"),
  UNIQUE ("partnerId", "achievementId")
);

-- Tabla: PaymentMethod
CREATE TABLE "PaymentMethod" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabla: Payment
CREATE TABLE "Payment" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
);

-- Tabla: Payout
CREATE TABLE "Payout" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id"),
  FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id")
);

-- Tabla: PlatformConfig
CREATE TABLE "PlatformConfig" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT UNIQUE NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL,
  "clientCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "partnerCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "minServicePrice" DOUBLE PRECISION NOT NULL,
  "maxServicePrice" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Tabla: Chat
CREATE TABLE "Chat" (
  "id" TEXT PRIMARY KEY,
  "serviceRequestId" TEXT NOT NULL,
  "proposalId" TEXT UNIQUE NOT NULL,
  "clientId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("serviceRequestId", "clientId", "partnerId")
);

-- Tabla: ChatMessage
CREATE TABLE "ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE
);

-- =====================================================
-- CREAR ÍNDICES
-- =====================================================

CREATE INDEX "Review_bookingId_idx" ON "Review"("bookingId");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Address_userId_isActive_idx" ON "Address"("userId", "isActive");
CREATE INDEX "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");
CREATE INDEX "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");
CREATE INDEX "VerificationDocument_partnerId_status_idx" ON "VerificationDocument"("partnerId", "status");
CREATE INDEX "VerificationDocument_status_idx" ON "VerificationDocument"("status");
CREATE INDEX "PartnerAchievement_partnerId_idx" ON "PartnerAchievement"("partnerId");
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX "PaymentMethod_mercadopagoCardId_idx" ON "PaymentMethod"("mercadopagoCardId");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_mercadopagoId_idx" ON "Payment"("mercadopagoId");
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");
CREATE INDEX "Payout_partnerId_idx" ON "Payout"("partnerId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
CREATE INDEX "Payout_paymentId_idx" ON "Payout"("paymentId");
CREATE INDEX "PlatformConfig_key_idx" ON "PlatformConfig"("key");
CREATE INDEX "Chat_clientId_idx" ON "Chat"("clientId");
CREATE INDEX "Chat_partnerId_idx" ON "Chat"("partnerId");
CREATE INDEX "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");
CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- =====================================================
-- INSERTAR CONFIGURACIÓN DE PLATAFORMA
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
);

-- =====================================================
-- SCRIPT COMPLETADO
-- =====================================================
-- Ahora ejecuta: npx prisma db seed
-- Para poblar con categorías, servicios y usuarios de prueba
-- =====================================================
