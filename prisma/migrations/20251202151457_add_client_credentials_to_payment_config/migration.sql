/*
  Warnings:

  - You are about to drop the column `active` on the `CityConfig` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMING_SOON');

-- AlterTable
ALTER TABLE "CityConfig" DROP COLUMN "active",
ADD COLUMN     "fechaLanzamiento" TIMESTAMP(3),
ADD COLUMN     "lanzamiento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "status" "CityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "PaymentConfig" ADD COLUMN     "productionClientId" TEXT,
ADD COLUMN     "productionClientSecret" TEXT,
ADD COLUMN     "testClientId" TEXT,
ADD COLUMN     "testClientSecret" TEXT;
