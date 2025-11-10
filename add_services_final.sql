-- ============================================================================
-- SQL PARA AGREGAR 50 NUEVOS SERVICIOS A HAGGO
-- ============================================================================
-- Base de datos: PostgreSQL
-- IDs: Categorías = cat-XX, Servicios = srv-XXX
-- Precios: Pesos colombianos (COP)
-- ============================================================================

-- ============================================================================
-- PASO 1: INSERTAR NUEVAS CATEGORÍAS
-- ============================================================================

INSERT INTO "Category" (id, name, slug, icon, description, "order")
VALUES 
  ('cat-1', 'Hogar', 'hogar', '🏠', 'Servicios para el hogar', 1),
  ('cat-2', 'Limpieza', 'limpieza', '🧹', 'Servicios de limpieza profesional', 2),
  ('cat-3', 'Reparaciones', 'reparaciones', '🔧', 'Reparaciones y mantenimiento', 3),
  ('cat-4', 'Belleza', 'belleza', '💅', 'Servicios de belleza y cuidado personal', 4),
  ('cat-5', 'Salud', 'salud', '⚕️', 'Servicios de salud y bienestar', 5),
  ('cat-6', 'Tecnología', 'tecnologia', '💻', 'Servicios tecnológicos y soporte', 6),
  ('cat-7', 'Transporte', 'transporte', '🚗', 'Servicios de transporte', 7),
  ('cat-8', 'Educación', 'educacion', '📚', 'Servicios educativos', 8),
  ('cat-9', 'Eventos', 'eventos', '🎉', 'Servicios para eventos', 9),
  ('cat-10', 'Mascotas', 'mascotas', '🐕', 'Servicios para mascotas', 10),
  ('cat-11', 'Automotriz', 'automotriz', '🚙', 'Servicios automotrices', 11),
  ('cat-12', 'Profesional', 'profesional', '💼', 'Servicios profesionales y consultoría', 12)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PASO 2: INSERTAR 50 NUEVOS SERVICIOS
-- ============================================================================

-- HOGAR Y MANTENIMIENTO (10 servicios) - srv-101 a srv-110
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-101', 'Impermeabilización', 'impermeabilizacion', 'Protección de techos y terrazas contra filtraciones', '☔', 'cat-1', 120000, 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-102', 'Instalación de cortinas', 'instalacion-cortinas', 'Medición, instalación y reparación de cortinas y persianas', '🪟', 'cat-1', 35000, 90, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-103', 'Pulido de pisos', 'pulido-pisos', 'Pulido y brillado de mármol, granito y madera', '✨', 'cat-1', 80000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-104', 'Reparación de techos', 'reparacion-techos', 'Reparación de goteras, tejas e impermeabilización', '🏠', 'cat-1', 90000, 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-105', 'Instalación de cielo raso', 'instalacion-cielo-raso', 'Instalación de drywall, PVC y aluminio', '🔨', 'cat-1', 85000, 300, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-106', 'Herrería', 'herreria', 'Fabricación de rejas, portones y estructuras metálicas', '🔩', 'cat-1', 95000, 240, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-107', 'Instalación de enchapes', 'instalacion-enchapes', 'Enchapes para baños, cocinas y pisos', '🧱', 'cat-1', 75000, 360, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-108', 'Reparación de puertas', 'reparacion-puertas', 'Ajustes, cambio de vidrios y reparación de puertas y ventanas', '🚪', 'cat-1', 45000, 90, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-109', 'Instalación de riego', 'instalacion-riego', 'Sistemas de riego para jardines y cultivos urbanos', '💧', 'cat-1', 70000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-110', 'Mantenimiento de piscinas', 'mantenimiento-piscinas', 'Limpieza, químicos y reparaciones de piscinas', '🏊', 'cat-1', 60000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- LIMPIEZA ESPECIALIZADA (8 servicios) - srv-201 a srv-208
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-201', 'Limpieza post-construcción', 'limpieza-post-construccion', 'Remoción de escombros y polvo después de obras', '🏗️', 'cat-2', 90000, 240, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-202', 'Limpieza de tanques', 'limpieza-tanques', 'Limpieza y desinfección de tanques de agua', '🚰', 'cat-2', 70000, 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-203', 'Limpieza de fachadas', 'limpieza-fachadas', 'Limpieza de edificios, casas y locales comerciales', '🏢', 'cat-2', 100000, 240, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-204', 'Desinfección', 'desinfeccion', 'Desinfección y sanitización profesional', '🧴', 'cat-2', 55000, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-205', 'Limpieza de tapizados', 'limpieza-tapizados', 'Limpieza de sofás, sillas y colchones', '🛋️', 'cat-2', 45000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-206', 'Limpieza de cocinas industriales', 'limpieza-cocinas-industriales', 'Limpieza profunda de restaurantes y cafeterías', '🍳', 'cat-2', 120000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-207', 'Organización del hogar', 'organizacion-hogar', 'Organización y orden profesional del hogar', '📦', 'cat-2', 50000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-208', 'Limpieza de garajes', 'limpieza-garajes', 'Limpieza de garajes y bodegas', '🚗', 'cat-2', 40000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- REPARACIONES Y MANTENIMIENTO (8 servicios) - srv-301 a srv-308
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-301', 'Reparación de lavadoras', 'reparacion-lavadoras', 'Servicio especializado en lavadoras', '🌀', 'cat-3', 60000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-302', 'Reparación de neveras', 'reparacion-neveras', 'Mantenimiento preventivo y correctivo de refrigeradores', '🧊', 'cat-3', 70000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-303', 'Reparación de estufas', 'reparacion-estufas', 'Reparación de estufas a gas y eléctricas', '🔥', 'cat-3', 55000, 90, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-304', 'Instalación de gas', 'instalacion-gas', 'Instalación y reparación de gas certificada', '⛽', 'cat-3', 65000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-305', 'Reparación de persianas', 'reparacion-persianas', 'Reparación de persianas enrollables y verticales', '🪟', 'cat-3', 40000, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-306', 'Tapicería de muebles', 'tapiceria-muebles', 'Restauración y tapizado de sofás y sillas', '🛋️', 'cat-3', 80000, 240, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-307', 'Reparación de bicicletas', 'reparacion-bicicletas', 'Mantenimiento y ajustes de bicicletas', '🚴', 'cat-3', 30000, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-308', 'Soldadura', 'soldadura', 'Reparaciones metálicas y soldadura en general', '🔥', 'cat-3', 60000, 90, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- BELLEZA Y BIENESTAR (7 servicios) - srv-401 a srv-407
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-401', 'Depilación', 'depilacion', 'Depilación láser, cera e hilo', '✨', 'cat-4', 35000, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-402', 'Tratamientos faciales', 'tratamientos-faciales', 'Limpieza, hidratación y tratamientos anti-edad', '🧖', 'cat-4', 55000, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-403', 'Extensiones de pestañas', 'extensiones-pestanas', 'Aplicación de extensiones de pestañas', '👁️', 'cat-4', 60000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-404', 'Micropigmentación', 'micropigmentacion', 'Micropigmentación de cejas, labios y delineado', '💉', 'cat-4', 150000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-405', 'Tratamientos capilares', 'tratamientos-capilares', 'Keratina, botox capilar y tratamientos', '💇', 'cat-4', 80000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-406', 'Spa a domicilio', 'spa-domicilio', 'Paquetes completos de spa y relajación', '🧖', 'cat-4', 120000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-407', 'Asesoría de imagen', 'asesoria-imagen', 'Personal shopper y asesoría de estilismo', '👔', 'cat-4', 70000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- SALUD Y CUIDADO (5 servicios) - srv-501 a srv-505
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-501', 'Terapia ocupacional', 'terapia-ocupacional', 'Rehabilitación funcional y terapia ocupacional', '🏥', 'cat-5', 65000, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-502', 'Psicología', 'psicologia', 'Consultas psicológicas virtuales o presenciales', '🧠', 'cat-5', 80000, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-503', 'Cuidado de adultos mayores', 'cuidado-adultos-mayores', 'Acompañamiento y cuidados básicos para adultos mayores', '👴', 'cat-5', 50000, 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-504', 'Aplicación de inyecciones', 'aplicacion-inyecciones', 'Enfermería básica y aplicación de medicamentos', '💉', 'cat-5', 25000, 30, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-505', 'Terapia respiratoria', 'terapia-respiratoria', 'Terapia respiratoria y rehabilitación pulmonar', '🫁', 'cat-5', 60000, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- TECNOLOGÍA Y SEGURIDAD (6 servicios) - srv-601 a srv-606
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-601', 'Instalación de cámaras', 'instalacion-camaras', 'Instalación de CCTV y sistemas de alarmas', '📹', 'cat-6', 100000, 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-602', 'Instalación de TV', 'instalacion-tv', 'Montaje en pared y configuración de TV y home theater', '📺', 'cat-6', 50000, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-603', 'Reparación de consolas', 'reparacion-consolas', 'Reparación de PlayStation, Xbox y Nintendo', '🎮', 'cat-6', 55000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-604', 'Instalación de paneles solares', 'instalacion-paneles-solares', 'Instalación de sistemas de energía solar', '☀️', 'cat-6', 250000, 480, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-605', 'Smart home', 'smart-home', 'Configuración de domótica, Alexa y Google Home', '🏠', 'cat-6', 80000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-606', 'Recuperación de datos', 'recuperacion-datos', 'Recuperación de datos de discos duros y celulares', '💾', 'cat-6', 90000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- AUTOMOTRIZ (4 servicios) - srv-701 a srv-704
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-701', 'Mecánica a domicilio', 'mecanica-domicilio', 'Reparaciones mecánicas básicas en casa', '🔧', 'cat-11', 70000, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-702', 'Cambio de aceite', 'cambio-aceite', 'Cambio de aceite y filtros a domicilio', '🛢️', 'cat-11', 45000, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-703', 'Polarizado de vidrios', 'polarizado-vidrios', 'Polarizado de autos, casas y oficinas', '🚗', 'cat-11', 80000, 180, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-704', 'Pintura automotriz', 'pintura-automotriz', 'Retoques y reparaciones de pintura automotriz', '🎨', 'cat-11', 100000, 240, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- PROFESIONAL (2 servicios) - srv-801 a srv-802
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
VALUES
  ('srv-801', 'Asesoría contable', 'asesoria-contable', 'Asesoría contable para independientes y empresas', '💰', 'cat-12', 70000, 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv-802', 'Arquitectura', 'arquitectura', 'Diseño arquitectónico y remodelaciones', '📐', 'cat-12', 120000, 120, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Contar servicios por categoría
SELECT c.name, COUNT(s.id) as total_servicios
FROM "Category" c
LEFT JOIN "Service" s ON s."categoryId" = c.id
GROUP BY c.name, c."order"
ORDER BY c."order";

-- Ver servicios populares
SELECT name, "basePrice", popular
FROM "Service"
WHERE popular = true
ORDER BY "basePrice" DESC;

-- Ver últimos servicios creados
SELECT id, name, "categoryId"
FROM "Service"
WHERE id LIKE 'srv-%'
ORDER BY id DESC
LIMIT 10;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Total: 12 categorías + 50 servicios nuevos
-- IDs: cat-1 a cat-12, srv-101 a srv-802
-- Precios en pesos colombianos (COP)
-- ============================================================================
