-- ============================================================================
-- SQL PARA AGREGAR 50 NUEVOS SERVICIOS A HAGGO
-- ============================================================================
-- Base de datos: PostgreSQL
-- Estructura: Usa CUIDs (text) como IDs
-- Fecha: 2024
-- ============================================================================

-- IMPORTANTE: Este script usa gen_random_uuid() para generar IDs únicos
-- Asegúrate de tener la extensión pgcrypto habilitada

-- Habilitar extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASO 1: INSERTAR NUEVAS CATEGORÍAS
-- ============================================================================
-- Solo se insertarán las categorías que no existan (ON CONFLICT DO NOTHING)

INSERT INTO "Category" (id, name, slug, icon, description, "order")
VALUES 
  (encode(gen_random_bytes(12), 'base64'), 'Hogar', 'hogar', '🏠', 'Servicios para el hogar', 1),
  (encode(gen_random_bytes(12), 'base64'), 'Limpieza', 'limpieza', '🧹', 'Servicios de limpieza profesional', 2),
  (encode(gen_random_bytes(12), 'base64'), 'Reparaciones', 'reparaciones', '🔧', 'Reparaciones y mantenimiento', 3),
  (encode(gen_random_bytes(12), 'base64'), 'Belleza', 'belleza', '💅', 'Servicios de belleza y cuidado personal', 4),
  (encode(gen_random_bytes(12), 'base64'), 'Salud', 'salud', '⚕️', 'Servicios de salud y bienestar', 5),
  (encode(gen_random_bytes(12), 'base64'), 'Tecnología', 'tecnologia', '💻', 'Servicios tecnológicos y soporte', 6),
  (encode(gen_random_bytes(12), 'base64'), 'Transporte', 'transporte', '🚗', 'Servicios de transporte', 7),
  (encode(gen_random_bytes(12), 'base64'), 'Educación', 'educacion', '📚', 'Servicios educativos', 8),
  (encode(gen_random_bytes(12), 'base64'), 'Eventos', 'eventos', '🎉', 'Servicios para eventos', 9),
  (encode(gen_random_bytes(12), 'base64'), 'Mascotas', 'mascotas', '🐕', 'Servicios para mascotas', 10),
  (encode(gen_random_bytes(12), 'base64'), 'Automotriz', 'automotriz', '🚙', 'Servicios automotrices', 11),
  (encode(gen_random_bytes(12), 'base64'), 'Profesional', 'profesional', '💼', 'Servicios profesionales y consultoría', 12)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PASO 2: INSERTAR 50 NUEVOS SERVICIOS
-- ============================================================================

-- HOGAR Y MANTENIMIENTO (10 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Impermeabilización',
  'impermeabilizacion',
  'Protección de techos y terrazas contra filtraciones',
  '☔',
  c.id,
  120000,
  240,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de cortinas',
  'instalacion-cortinas',
  'Medición, instalación y reparación de cortinas y persianas',
  '🪟',
  c.id,
  35000,
  90,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Pulido de pisos',
  'pulido-pisos',
  'Pulido y brillado de mármol, granito y madera',
  '✨',
  c.id,
  80000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de techos',
  'reparacion-techos',
  'Reparación de goteras, tejas e impermeabilización',
  '🏠',
  c.id,
  90000,
  240,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de cielo raso',
  'instalacion-cielo-raso',
  'Instalación de drywall, PVC y aluminio',
  '🔨',
  c.id,
  85000,
  300,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Herrería',
  'herreria',
  'Fabricación de rejas, portones y estructuras metálicas',
  '🔩',
  c.id,
  95000,
  240,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de enchapes',
  'instalacion-enchapes',
  'Enchapes para baños, cocinas y pisos',
  '🧱',
  c.id,
  75000,
  360,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de puertas',
  'reparacion-puertas',
  'Ajustes, cambio de vidrios y reparación de puertas y ventanas',
  '🚪',
  c.id,
  45000,
  90,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de riego',
  'instalacion-riego',
  'Sistemas de riego para jardines y cultivos urbanos',
  '💧',
  c.id,
  70000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Mantenimiento de piscinas',
  'mantenimiento-piscinas',
  'Limpieza, químicos y reparaciones de piscinas',
  '🏊',
  c.id,
  60000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

-- LIMPIEZA ESPECIALIZADA (8 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza post-construcción',
  'limpieza-post-construccion',
  'Remoción de escombros y polvo después de obras',
  '🏗️',
  c.id,
  90000,
  240,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza de tanques',
  'limpieza-tanques',
  'Limpieza y desinfección de tanques de agua',
  '🚰',
  c.id,
  70000,
  180,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza de fachadas',
  'limpieza-fachadas',
  'Limpieza de edificios, casas y locales comerciales',
  '🏢',
  c.id,
  100000,
  240,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Desinfección',
  'desinfeccion',
  'Desinfección y sanitización profesional',
  '🧴',
  c.id,
  55000,
  90,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza de tapizados',
  'limpieza-tapizados',
  'Limpieza de sofás, sillas y colchones',
  '🛋️',
  c.id,
  45000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza de cocinas industriales',
  'limpieza-cocinas-industriales',
  'Limpieza profunda de restaurantes y cafeterías',
  '🍳',
  c.id,
  120000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Organización del hogar',
  'organizacion-hogar',
  'Organización y orden profesional del hogar',
  '📦',
  c.id,
  50000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Limpieza de garajes',
  'limpieza-garajes',
  'Limpieza de garajes y bodegas',
  '🚗',
  c.id,
  40000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

-- REPARACIONES Y MANTENIMIENTO (8 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de lavadoras',
  'reparacion-lavadoras',
  'Servicio especializado en lavadoras',
  '🌀',
  c.id,
  60000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de neveras',
  'reparacion-neveras',
  'Mantenimiento preventivo y correctivo de refrigeradores',
  '🧊',
  c.id,
  70000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de estufas',
  'reparacion-estufas',
  'Reparación de estufas a gas y eléctricas',
  '🔥',
  c.id,
  55000,
  90,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de gas',
  'instalacion-gas',
  'Instalación y reparación de gas certificada',
  '⛽',
  c.id,
  65000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de persianas',
  'reparacion-persianas',
  'Reparación de persianas enrollables y verticales',
  '🪟',
  c.id,
  40000,
  60,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Tapicería de muebles',
  'tapiceria-muebles',
  'Restauración y tapizado de sofás y sillas',
  '🛋️',
  c.id,
  80000,
  240,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de bicicletas',
  'reparacion-bicicletas',
  'Mantenimiento y ajustes de bicicletas',
  '🚴',
  c.id,
  30000,
  60,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Soldadura',
  'soldadura',
  'Reparaciones metálicas y soldadura en general',
  '🔥',
  c.id,
  60000,
  90,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

-- BELLEZA Y BIENESTAR (7 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Depilación',
  'depilacion',
  'Depilación láser, cera e hilo',
  '✨',
  c.id,
  35000,
  60,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Tratamientos faciales',
  'tratamientos-faciales',
  'Limpieza, hidratación y tratamientos anti-edad',
  '🧖',
  c.id,
  55000,
  90,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Extensiones de pestañas',
  'extensiones-pestanas',
  'Aplicación de extensiones de pestañas',
  '👁️',
  c.id,
  60000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Micropigmentación',
  'micropigmentacion',
  'Micropigmentación de cejas, labios y delineado',
  '💉',
  c.id,
  150000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Tratamientos capilares',
  'tratamientos-capilares',
  'Keratina, botox capilar y tratamientos',
  '💇',
  c.id,
  80000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Spa a domicilio',
  'spa-domicilio',
  'Paquetes completos de spa y relajación',
  '🧖',
  c.id,
  120000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Asesoría de imagen',
  'asesoria-imagen',
  'Personal shopper y asesoría de estilismo',
  '👔',
  c.id,
  70000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

-- SALUD Y CUIDADO (5 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Terapia ocupacional',
  'terapia-ocupacional',
  'Rehabilitación funcional y terapia ocupacional',
  '🏥',
  c.id,
  65000,
  60,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Psicología',
  'psicologia',
  'Consultas psicológicas virtuales o presenciales',
  '🧠',
  c.id,
  80000,
  60,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Cuidado de adultos mayores',
  'cuidado-adultos-mayores',
  'Acompañamiento y cuidados básicos para adultos mayores',
  '👴',
  c.id,
  50000,
  240,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Aplicación de inyecciones',
  'aplicacion-inyecciones',
  'Enfermería básica y aplicación de medicamentos',
  '💉',
  c.id,
  25000,
  30,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Terapia respiratoria',
  'terapia-respiratoria',
  'Terapia respiratoria y rehabilitación pulmonar',
  '🫁',
  c.id,
  60000,
  60,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

-- TECNOLOGÍA Y SEGURIDAD (6 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de cámaras',
  'instalacion-camaras',
  'Instalación de CCTV y sistemas de alarmas',
  '📹',
  c.id,
  100000,
  180,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de TV',
  'instalacion-tv',
  'Montaje en pared y configuración de TV y home theater',
  '📺',
  c.id,
  50000,
  90,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Reparación de consolas',
  'reparacion-consolas',
  'Reparación de PlayStation, Xbox y Nintendo',
  '🎮',
  c.id,
  55000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Instalación de paneles solares',
  'instalacion-paneles-solares',
  'Instalación de sistemas de energía solar',
  '☀️',
  c.id,
  250000,
  480,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Smart home',
  'smart-home',
  'Configuración de domótica, Alexa y Google Home',
  '🏠',
  c.id,
  80000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Recuperación de datos',
  'recuperacion-datos',
  'Recuperación de datos de discos duros y celulares',
  '💾',
  c.id,
  90000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

-- AUTOMOTRIZ (4 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Mecánica a domicilio',
  'mecanica-domicilio',
  'Reparaciones mecánicas básicas en casa',
  '🔧',
  c.id,
  70000,
  120,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'automotriz'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Cambio de aceite',
  'cambio-aceite',
  'Cambio de aceite y filtros a domicilio',
  '🛢️',
  c.id,
  45000,
  60,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'automotriz'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Polarizado de vidrios',
  'polarizado-vidrios',
  'Polarizado de autos, casas y oficinas',
  '🚗',
  c.id,
  80000,
  180,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'automotriz'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Pintura automotriz',
  'pintura-automotriz',
  'Retoques y reparaciones de pintura automotriz',
  '🎨',
  c.id,
  100000,
  240,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'automotriz'
ON CONFLICT (slug) DO NOTHING;

-- PROFESIONAL (2 servicios)
-- ----------------------------------------------------------------------------

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Asesoría contable',
  'asesoria-contable',
  'Asesoría contable para independientes y empresas',
  '💰',
  c.id,
  70000,
  60,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'profesional'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Arquitectura',
  'arquitectura',
  'Diseño arquitectónico y remodelaciones',
  '📐',
  c.id,
  120000,
  120,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c WHERE c.slug = 'profesional'
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

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Total: 12 categorías + 50 servicios nuevos
-- Precios en pesos colombianos (COP)
-- ============================================================================
