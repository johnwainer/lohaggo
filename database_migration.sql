-- ============================================
-- MIGRACIÓN COMPLETA - HAGGO
-- Base de datos PostgreSQL con todas las tablas y datos
-- ============================================

-- ============================================
-- PARTE 1: CREAR ENUMS
-- ============================================

CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PARTNER', 'ADMIN');
CREATE TYPE "City" AS ENUM ('MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA', 'CARTAGENA');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "NotificationType" AS ENUM ('NEW_SERVICE_REQUEST', 'NEW_PROPOSAL', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_IN_PROGRESS', 'BOOKING_COMPLETED');

-- ============================================
-- PARTE 2: CREAR TABLAS
-- ============================================

-- Tabla de usuarios
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "pushSubscription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Tabla de perfiles de partners
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

-- Tabla de categorías
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Tabla de servicios
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

-- Tabla de servicios de partners
CREATE TABLE "PartnerService" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customPrice" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerService_pkey" PRIMARY KEY ("id")
);

-- Tabla de disponibilidad
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

-- Tabla de reservas
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- Tabla de solicitudes de servicio
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

-- Tabla de propuestas
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

-- Tabla de notificaciones
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

-- Tabla de direcciones
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

-- Tabla de fotos de solicitudes
CREATE TABLE "RequestPhoto" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestPhoto_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- PARTE 3: CREAR ÍNDICES
-- ============================================

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE UNIQUE INDEX "PartnerService_partnerId_serviceId_key" ON "PartnerService"("partnerId", "serviceId");
CREATE UNIQUE INDEX "Proposal_serviceRequestId_partnerId_key" ON "Proposal"("serviceRequestId", "partnerId");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Address_userId_isActive_idx" ON "Address"("userId", "isActive");
CREATE INDEX "Address_userId_isPrimary_idx" ON "Address"("userId", "isPrimary");
CREATE INDEX "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");

-- ============================================
-- PARTE 4: CREAR FOREIGN KEYS
-- ============================================

ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_partnerServiceId_fkey" FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- PARTE 5: INSERTAR DATOS INICIALES
-- ============================================

-- Categorías
INSERT INTO "Category" (id, name, slug, icon, description, "order") VALUES
('cat-1', 'Hogar', 'hogar', '🏠', 'Servicios para el hogar', 1),
('cat-2', 'Limpieza', 'limpieza', '🧹', 'Servicios de limpieza profesional', 2),
('cat-3', 'Reparaciones', 'reparaciones', '🔧', 'Reparaciones y mantenimiento', 3),
('cat-4', 'Belleza', 'belleza', '💅', 'Servicios de belleza y cuidado personal', 4),
('cat-5', 'Salud', 'salud', '⚕️', 'Servicios de salud y bienestar', 5),
('cat-6', 'Tecnología', 'tecnologia', '💻', 'Servicios de tecnología', 6),
('cat-7', 'Transporte', 'transporte', '🚗', 'Servicios de transporte', 7),
('cat-8', 'Educación', 'educacion', '📚', 'Servicios educativos', 8),
('cat-9', 'Eventos', 'eventos', '🎉', 'Servicios para eventos', 9),
('cat-10', 'Mascotas', 'mascotas', '🐕', 'Servicios para mascotas', 10)
ON CONFLICT (id) DO NOTHING;

-- Servicios (muestra - agregar más según necesidad)
INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt") VALUES
-- Hogar
('srv-1', 'Plomería', 'plomeria', 'Reparación de tuberías, grifos y sistemas de agua', '🚰', 'cat-1', 100000, 120, true, NOW(), NOW()),
('srv-2', 'Electricidad', 'electricidad', 'Instalación y reparación eléctrica', '⚡', 'cat-1', 120000, 90, true, NOW(), NOW()),
('srv-5', 'Carpintería', 'carpinteria', 'Fabricación y reparación de muebles', '🪚', 'cat-1', 140000, 180, false, NOW(), NOW()),
('srv-6', 'Pintura', 'pintura', 'Pintura de interiores y exteriores', '🎨', 'cat-1', 200000, 480, true, NOW(), NOW()),
-- Limpieza
('srv-3', 'Limpieza de hogar', 'limpieza-hogar', 'Limpieza profunda de casas y apartamentos', '🧹', 'cat-2', 80000, 180, true, NOW(), NOW()),
('srv-4', 'Limpieza de oficinas', 'limpieza-oficinas', 'Limpieza profesional de espacios comerciales', '🏢', 'cat-2', 160000, 240, false, NOW(), NOW()),
-- Reparaciones
('srv-11', 'Reparación de electrodomésticos', 'reparacion-electrodomesticos', 'Reparación de lavadoras, refrigeradores, etc.', '🔌', 'cat-3', 130000, 120, true, NOW(), NOW()),
('srv-12', 'Cerrajería', 'cerrajeria', 'Apertura y cambio de cerraduras', '🔑', 'cat-3', 100000, 60, true, NOW(), NOW()),
-- Belleza
('srv-16', 'Peluquería a domicilio', 'peluqueria', 'Corte y peinado en tu hogar', '💇', 'cat-4', 50000, 60, true, NOW(), NOW()),
('srv-17', 'Manicure y pedicure', 'manicure-pedicure', 'Cuidado de uñas a domicilio', '💅', 'cat-4', 60000, 90, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Usuario de prueba (contraseña: password123)
INSERT INTO "User" (id, email, name, password, phone, role, "createdAt", "updatedAt") VALUES
('user-test-1', 'cliente@test.com', 'Cliente Test', '$2a$10$YourHashedPasswordHere', '3001234567', 'CLIENT', NOW(), NOW()),
('user-test-2', 'partner@test.com', 'Partner Test', '$2a$10$YourHashedPasswordHere', '3007654321', 'PARTNER', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Perfil de partner de prueba
INSERT INTO "PartnerProfile" (id, "userId", bio, rating, "totalReviews", verified, city, "createdAt", "updatedAt") VALUES
('partner-1', 'user-test-2', 'Partner profesional con 5 años de experiencia', 4.8, 120, true, 'MEDELLIN', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Servicios del partner
INSERT INTO "PartnerService" (id, "partnerId", "serviceId", "customPrice", active, "createdAt") VALUES
('ps-1', 'partner-1', 'srv-1', 95000, true, NOW()),
('ps-2', 'partner-1', 'srv-2', 115000, true, NOW()),
('ps-3', 'partner-1', 'srv-3', 75000, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

-- Verificar que todo se creó correctamente
SELECT 'Migración completada exitosamente' AS status;
SELECT COUNT(*) AS total_categorias FROM "Category";
SELECT COUNT(*) AS total_servicios FROM "Service";
SELECT COUNT(*) AS total_usuarios FROM "User";
