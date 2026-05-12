-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "partnerId" TEXT;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
