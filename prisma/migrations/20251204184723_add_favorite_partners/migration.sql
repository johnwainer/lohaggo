-- CreateTable
CREATE TABLE "FavoritePartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoritePartner_userId_idx" ON "FavoritePartner"("userId");

-- CreateIndex
CREATE INDEX "FavoritePartner_partnerId_idx" ON "FavoritePartner"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePartner_userId_partnerId_key" ON "FavoritePartner"("userId", "partnerId");

-- AddForeignKey
ALTER TABLE "FavoritePartner" ADD CONSTRAINT "FavoritePartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePartner" ADD CONSTRAINT "FavoritePartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
