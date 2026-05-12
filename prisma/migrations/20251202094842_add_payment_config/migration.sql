-- CreateEnum
CREATE TYPE "PaymentEnvironment" AS ENUM ('TEST', 'PRODUCTION');

-- CreateTable
CREATE TABLE "PaymentConfig" (
    "id" TEXT NOT NULL,
    "environment" "PaymentEnvironment" NOT NULL DEFAULT 'TEST',
    "testAccessToken" TEXT,
    "testPublicKey" TEXT,
    "productionAccessToken" TEXT,
    "productionPublicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);
