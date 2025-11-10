-- SQL para agregar 50 nuevos servicios a la base de datos de producción
-- Ejecutar este script en tu base de datos de producción

-- Primero, agregar las nuevas categorías si no existen
INSERT INTO "Category" (name, slug, icon, "createdAt", "updatedAt")
VALUES 
  ('Automotriz', 'automotriz', '🚙', NOW(), NOW()),
  ('Profesional', 'profesional', '💼', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Insertar nuevos servicios (50 servicios)
-- Nota: Reemplaza los IDs de categoría según tu base de datos

-- Hogar y Mantenimiento (10 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Impermeabilización', 'impermeabilizacion', 'Protección de techos y terrazas contra filtraciones', '☔', id, 120, 240, true, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Instalación de cortinas', 'instalacion-cortinas', 'Medición, instalación y reparación de cortinas y persianas', '🪟', id, 35, 90, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Pulido de pisos', 'pulido-pisos', 'Pulido y brillado de mármol, granito y madera', '✨', id, 80, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Reparación de techos', 'reparacion-techos', 'Reparación de goteras, tejas e impermeabilización', '🏠', id, 90, 240, true, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Instalación de cielo raso', 'instalacion-cielo-raso', 'Instalación de drywall, PVC y aluminio', '🔨', id, 85, 300, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Herrería', 'herreria', 'Fabricación de rejas, portones y estructuras metálicas', '🔩', id, 95, 240, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Instalación de enchapes', 'instalacion-enchapes', 'Enchapes para baños, cocinas y pisos', '🧱', id, 75, 360, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Reparación de puertas', 'reparacion-puertas', 'Ajustes, cambio de vidrios y reparación de puertas y ventanas', '🚪', id, 45, 90, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Instalación de riego', 'instalacion-riego', 'Sistemas de riego para jardines y cultivos urbanos', '💧', id, 70, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
UNION ALL
SELECT 'Mantenimiento de piscinas', 'mantenimiento-piscinas', 'Limpieza, químicos y reparaciones de piscinas', '🏊', id, 60, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;

-- Limpieza Especializada (8 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Limpieza post-construcción', 'limpieza-post-construccion', 'Remoción de escombros y polvo después de obras', '🏗️', id, 90, 240, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Limpieza de tanques', 'limpieza-tanques', 'Limpieza y desinfección de tanques de agua', '🚰', id, 70, 180, true, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Limpieza de fachadas', 'limpieza-fachadas', 'Limpieza de edificios, casas y locales comerciales', '🏢', id, 100, 240, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Desinfección', 'desinfeccion', 'Desinfección y sanitización profesional', '🧴', id, 55, 90, true, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Limpieza de tapizados', 'limpieza-tapizados', 'Limpieza de sofás, sillas y colchones', '🛋️', id, 45, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Limpieza de cocinas industriales', 'limpieza-cocinas-industriales', 'Limpieza profunda de restaurantes y cafeterías', '🍳', id, 120, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Organización del hogar', 'organizacion-hogar', 'Organización y orden profesional del hogar', '📦', id, 50, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
UNION ALL
SELECT 'Limpieza de garajes', 'limpieza-garajes', 'Limpieza de garajes y bodegas', '🚗', id, 40, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'limpieza'
ON CONFLICT (slug) DO NOTHING;

-- Reparaciones y Mantenimiento (8 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Reparación de lavadoras', 'reparacion-lavadoras', 'Servicio especializado en lavadoras', '🌀', id, 60, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Reparación de neveras', 'reparacion-neveras', 'Mantenimiento preventivo y correctivo de refrigeradores', '🧊', id, 70, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Reparación de estufas', 'reparacion-estufas', 'Reparación de estufas a gas y eléctricas', '🔥', id, 55, 90, false, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Instalación de gas', 'instalacion-gas', 'Instalación y reparación de gas certificada', '⛽', id, 65, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Reparación de persianas', 'reparacion-persianas', 'Reparación de persianas enrollables y verticales', '🪟', id, 40, 60, false, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Tapicería de muebles', 'tapiceria-muebles', 'Restauración y tapizado de sofás y sillas', '🛋️', id, 80, 240, false, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Reparación de bicicletas', 'reparacion-bicicletas', 'Mantenimiento y ajustes de bicicletas', '🚴', id, 30, 60, false, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
UNION ALL
SELECT 'Soldadura', 'soldadura', 'Reparaciones metálicas y soldadura en general', '🔥', id, 60, 90, false, NOW(), NOW() FROM "Category" WHERE slug = 'reparaciones'
ON CONFLICT (slug) DO NOTHING;

-- Belleza y Bienestar (7 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Depilación', 'depilacion', 'Depilación láser, cera e hilo', '✨', id, 35, 60, true, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Tratamientos faciales', 'tratamientos-faciales', 'Limpieza, hidratación y tratamientos anti-edad', '🧖', id, 55, 90, true, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Extensiones de pestañas', 'extensiones-pestanas', 'Aplicación de extensiones de pestañas', '👁️', id, 60, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Micropigmentación', 'micropigmentacion', 'Micropigmentación de cejas, labios y delineado', '💉', id, 150, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Tratamientos capilares', 'tratamientos-capilares', 'Keratina, botox capilar y tratamientos', '💇', id, 80, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Spa a domicilio', 'spa-domicilio', 'Paquetes completos de spa y relajación', '🧖', id, 120, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
UNION ALL
SELECT 'Asesoría de imagen', 'asesoria-imagen', 'Personal shopper y asesoría de estilismo', '👔', id, 70, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'belleza'
ON CONFLICT (slug) DO NOTHING;

-- Salud y Cuidado (5 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Terapia ocupacional', 'terapia-ocupacional', 'Rehabilitación funcional y terapia ocupacional', '🏥', id, 65, 60, false, NOW(), NOW() FROM "Category" WHERE slug = 'salud'
UNION ALL
SELECT 'Psicología', 'psicologia', 'Consultas psicológicas virtuales o presenciales', '🧠', id, 80, 60, true, NOW(), NOW() FROM "Category" WHERE slug = 'salud'
UNION ALL
SELECT 'Cuidado de adultos mayores', 'cuidado-adultos-mayores', 'Acompañamiento y cuidados básicos para adultos mayores', '👴', id, 50, 240, true, NOW(), NOW() FROM "Category" WHERE slug = 'salud'
UNION ALL
SELECT 'Aplicación de inyecciones', 'aplicacion-inyecciones', 'Enfermería básica y aplicación de medicamentos', '💉', id, 25, 30, false, NOW(), NOW() FROM "Category" WHERE slug = 'salud'
UNION ALL
SELECT 'Terapia respiratoria', 'terapia-respiratoria', 'Terapia respiratoria y rehabilitación pulmonar', '🫁', id, 60, 60, false, NOW(), NOW() FROM "Category" WHERE slug = 'salud'
ON CONFLICT (slug) DO NOTHING;

-- Tecnología y Seguridad (6 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Instalación de cámaras', 'instalacion-camaras', 'Instalación de CCTV y sistemas de alarmas', '📹', id, 100, 180, true, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
UNION ALL
SELECT 'Instalación de TV', 'instalacion-tv', 'Montaje en pared y configuración de TV y home theater', '📺', id, 50, 90, true, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
UNION ALL
SELECT 'Reparación de consolas', 'reparacion-consolas', 'Reparación de PlayStation, Xbox y Nintendo', '🎮', id, 55, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
UNION ALL
SELECT 'Instalación de paneles solares', 'instalacion-paneles-solares', 'Instalación de sistemas de energía solar', '☀️', id, 250, 480, false, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
UNION ALL
SELECT 'Smart home', 'smart-home', 'Configuración de domótica, Alexa y Google Home', '🏠', id, 80, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
UNION ALL
SELECT 'Recuperación de datos', 'recuperacion-datos', 'Recuperación de datos de discos duros y celulares', '💾', id, 90, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'tecnologia'
ON CONFLICT (slug) DO NOTHING;

-- Automotriz (4 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Mecánica a domicilio', 'mecanica-domicilio', 'Reparaciones mecánicas básicas en casa', '🔧', id, 70, 120, true, NOW(), NOW() FROM "Category" WHERE slug = 'automotriz'
UNION ALL
SELECT 'Cambio de aceite', 'cambio-aceite', 'Cambio de aceite y filtros a domicilio', '🛢️', id, 45, 60, true, NOW(), NOW() FROM "Category" WHERE slug = 'automotriz'
UNION ALL
SELECT 'Polarizado de vidrios', 'polarizado-vidrios', 'Polarizado de autos, casas y oficinas', '🚗', id, 80, 180, false, NOW(), NOW() FROM "Category" WHERE slug = 'automotriz'
UNION ALL
SELECT 'Pintura automotriz', 'pintura-automotriz', 'Retoques y reparaciones de pintura automotriz', '🎨', id, 100, 240, false, NOW(), NOW() FROM "Category" WHERE slug = 'automotriz'
ON CONFLICT (slug) DO NOTHING;

-- Profesionales y Consultoría (2 servicios)
INSERT INTO "Service" (name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 'Asesoría contable', 'asesoria-contable', 'Asesoría contable para independientes y empresas', '💰', id, 70, 60, false, NOW(), NOW() FROM "Category" WHERE slug = 'profesional'
UNION ALL
SELECT 'Arquitectura', 'arquitectura', 'Diseño arquitectónico y remodelaciones', '📐', id, 120, 120, false, NOW(), NOW() FROM "Category" WHERE slug = 'profesional'
ON CONFLICT (slug) DO NOTHING;
