-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "City" AS ENUM ('MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_SERVICE_REQUEST', 'NEW_PROPOSAL', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_IN_PROGRESS', 'BOOKING_COMPLETED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'ACHIEVEMENT_UNLOCKED', 'NEW_MESSAGE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP', 'DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO', 'ANTECEDENTES');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('IDENTITY_VERIFIED', 'EDUCATION_VERIFIED', 'BACKGROUND_CHECK_VERIFIED', 'FIRST_SERVICE', 'TEN_SERVICES', 'FIFTY_SERVICES', 'HUNDRED_SERVICES', 'FIVE_STAR_RATING', 'VERIFIED_PARTNER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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
    "mercadopagoCustomerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "city" "City" NOT NULL DEFAULT 'MEDELLIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerService" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "city" "City" NOT NULL DEFAULT 'MEDELLIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerServiceId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "partnerId" TEXT,
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

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
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

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
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

-- CreateTable
CREATE TABLE "Address" (
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

-- CreateTable
CREATE TABLE "RequestPhoto" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAchievement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mercadopagoCardId" TEXT,
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

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "mercadopagoId" TEXT,
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

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
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

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "clientCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "partnerCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "minServicePrice" DOUBLE PRECISION NOT NULL,
    "maxServicePrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mercadopagoCustomerId_key" ON "User"("mercadopagoCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerService_partnerId_serviceId_key" ON "PartnerService"("partnerId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_bookingId_idx" ON "Review"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_serviceRequestId_partnerId_key" ON "Proposal"("serviceRequestId", "partnerId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Address_userId_isActive_idx" ON "Address"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");

-- CreateIndex
CREATE INDEX "VerificationDocument_partnerId_status_idx" ON "VerificationDocument"("partnerId", "status");

-- CreateIndex
CREATE INDEX "VerificationDocument_status_idx" ON "VerificationDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_type_key" ON "Achievement"("type");

-- CreateIndex
CREATE INDEX "PartnerAchievement_partnerId_idx" ON "PartnerAchievement"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAchievement_partnerId_achievementId_key" ON "PartnerAchievement"("partnerId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_mercadopagoCardId_key" ON "PaymentMethod"("mercadopagoCardId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_mercadopagoCardId_idx" ON "PaymentMethod"("mercadopagoCardId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mercadopagoId_key" ON "Payment"("mercadopagoId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_mercadopagoId_idx" ON "Payment"("mercadopagoId");

-- CreateIndex
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_paymentId_key" ON "Payout"("paymentId");

-- CreateIndex
CREATE INDEX "Payout_partnerId_idx" ON "Payout"("partnerId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_paymentId_idx" ON "Payout"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConfig_key_key" ON "PlatformConfig"("key");

-- CreateIndex
CREATE INDEX "PlatformConfig_key_idx" ON "PlatformConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_proposalId_key" ON "Chat"("proposalId");

-- CreateIndex
CREATE INDEX "Chat_clientId_idx" ON "Chat"("clientId");

-- CreateIndex
CREATE INDEX "Chat_partnerId_idx" ON "Chat"("partnerId");

-- CreateIndex
CREATE INDEX "Chat_serviceRequestId_idx" ON "Chat"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_serviceRequestId_clientId_partnerId_key" ON "Chat"("serviceRequestId", "clientId", "partnerId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerServiceId_fkey" FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAchievement" ADD CONSTRAINT "PartnerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAchievement" ADD CONSTRAINT "PartnerAchievement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
