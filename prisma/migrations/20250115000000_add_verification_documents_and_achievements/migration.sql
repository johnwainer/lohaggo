-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP', 'DIPLOMA_BACHILLER', 'DIPLOMA_UNIVERSITARIO', 'CERTIFICADO_TECNICO', 'CERTIFICADO_CURSO', 'ANTECEDENTES');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('FIRST_SERVICE', 'IDENTITY_VERIFIED', 'EDUCATION_VERIFIED', 'BACKGROUND_CHECK_VERIFIED', 'FIVE_STAR_RATING', 'TEN_SERVICES', 'FIFTY_SERVICES', 'HUNDRED_SERVICES');

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "document_url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_achievements" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_documents_partner_id_idx" ON "verification_documents"("partner_id");

-- CreateIndex
CREATE INDEX "verification_documents_status_idx" ON "verification_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_type_key" ON "achievements"("type");

-- CreateIndex
CREATE INDEX "partner_achievements_partner_id_idx" ON "partner_achievements"("partner_id");

-- CreateIndex
CREATE INDEX "partner_achievements_achievement_id_idx" ON "partner_achievements"("achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_achievements_partner_id_achievement_id_key" ON "partner_achievements"("partner_id", "achievement_id");

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_achievements" ADD CONSTRAINT "partner_achievements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_achievements" ADD CONSTRAINT "partner_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default achievements
INSERT INTO "achievements" ("id", "type", "name", "description", "icon") VALUES
('ach_first_service', 'FIRST_SERVICE', 'Primer Servicio', 'Completaste tu primer servicio', '🎉'),
('ach_identity_verified', 'IDENTITY_VERIFIED', 'Identidad Verificada', 'Tu identidad ha sido verificada', '✅'),
('ach_education_verified', 'EDUCATION_VERIFIED', 'Educación Verificada', 'Tu educación ha sido verificada', '🎓'),
('ach_background_verified', 'BACKGROUND_CHECK_VERIFIED', 'Antecedentes Verificados', 'Tus antecedentes han sido verificados', '🛡️'),
('ach_five_star', 'FIVE_STAR_RATING', 'Cinco Estrellas', 'Recibiste una calificación de 5 estrellas', '⭐'),
('ach_ten_services', 'TEN_SERVICES', '10 Servicios', 'Completaste 10 servicios', '🔟'),
('ach_fifty_services', 'FIFTY_SERVICES', '50 Servicios', 'Completaste 50 servicios', '🏆'),
('ach_hundred_services', 'HUNDRED_SERVICES', '100 Servicios', 'Completaste 100 servicios', '👑');

-- Update NotificationType enum to include new types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DOCUMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_UNLOCKED';
