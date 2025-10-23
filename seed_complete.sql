-- ============================================
-- SEED COMPLETO PARA SUPABASE
-- ============================================

-- Limpiar datos existentes (opcional, comentar si no quieres borrar)
-- TRUNCATE TABLE "Booking", "Availability", "PartnerService", "Service", "Category", "PartnerProfile", "User" CASCADE;

-- ============================================
-- CATEGORÍAS
-- ============================================
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

-- ============================================
-- SERVICIOS
-- ============================================
INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt") VALUES
-- Hogar
('srv-1', 'Plomería', 'plomeria', 'Reparación de tuberías, grifos y sistemas de agua', '🚰', 'cat-1', 100000, 120, true, NOW(), NOW()),
('srv-2', 'Electricidad', 'electricidad', 'Instalación y reparación eléctrica', '⚡', 'cat-1', 120000, 90, true, NOW(), NOW()),
('srv-5', 'Carpintería', 'carpinteria', 'Fabricación y reparación de muebles', '🪚', 'cat-1', 140000, 180, false, NOW(), NOW()),
('srv-6', 'Pintura', 'pintura', 'Pintura de interiores y exteriores', '🎨', 'cat-1', 200000, 480, true, NOW(), NOW()),
('srv-7', 'Jardinería', 'jardineria', 'Mantenimiento de jardines y áreas verdes', '🌱', 'cat-1', 90000, 120, false, NOW(), NOW()),
('srv-8', 'Fumigación', 'fumigacion', 'Control de plagas y fumigación', '🦟', 'cat-1', 110000, 90, false, NOW(), NOW()),
('srv-15', 'Instalación de muebles', 'instalacion-muebles', 'Armado e instalación de muebles', '🛋️', 'cat-1', 80000, 120, false, NOW(), NOW()),
('srv-69', 'Costura y arreglos', 'costura', 'Arreglos de ropa y confección', '🧵', 'cat-1', 40000, 60, false, NOW(), NOW()),

-- Limpieza
('srv-3', 'Limpieza de hogar', 'limpieza-hogar', 'Limpieza profunda de casas y apartamentos', '🧹', 'cat-2', 80000, 180, true, NOW(), NOW()),
('srv-4', 'Limpieza de oficinas', 'limpieza-oficinas', 'Limpieza profesional de espacios comerciales', '🏢', 'cat-2', 160000, 240, false, NOW(), NOW()),
('srv-9', 'Lavado de alfombras', 'lavado-alfombras', 'Limpieza profunda de alfombras y tapetes', '🧼', 'cat-2', 70000, 60, false, NOW(), NOW()),
('srv-10', 'Limpieza de ventanas', 'limpieza-ventanas', 'Limpieza de ventanas y cristales', '🪟', 'cat-2', 60000, 90, false, NOW(), NOW()),

-- Reparaciones
('srv-11', 'Reparación de electrodomésticos', 'reparacion-electrodomesticos', 'Reparación de lavadoras, refrigeradores, etc.', '🔌', 'cat-3', 130000, 120, true, NOW(), NOW()),
('srv-12', 'Cerrajería', 'cerrajeria', 'Apertura y cambio de cerraduras', '🔑', 'cat-3', 100000, 60, true, NOW(), NOW()),
('srv-13', 'Reparación de aires acondicionados', 'reparacion-aires', 'Mantenimiento y reparación de AC', '❄️', 'cat-3', 150000, 120, true, NOW(), NOW()),
('srv-14', 'Reparación de calentadores', 'reparacion-calentadores', 'Reparación de calentadores de agua', '🔥', 'cat-3', 120000, 90, false, NOW(), NOW()),

-- Belleza
('srv-16', 'Peluquería a domicilio', 'peluqueria', 'Corte y peinado en tu hogar', '💇', 'cat-4', 50000, 60, true, NOW(), NOW()),
('srv-17', 'Manicure y pedicure', 'manicure-pedicure', 'Cuidado de uñas profesional', '💅', 'cat-4', 60000, 90, true, NOW(), NOW()),
('srv-18', 'Masajes', 'masajes', 'Masajes terapéuticos y relajantes', '💆', 'cat-4', 100000, 60, true, NOW(), NOW()),
('srv-19', 'Maquillaje', 'maquillaje', 'Maquillaje profesional para eventos', '💄', 'cat-4', 90000, 90, false, NOW(), NOW()),
('srv-20', 'Barbería', 'barberia', 'Corte y arreglo de barba', '✂️', 'cat-4', 40000, 45, false, NOW(), NOW()),

-- Salud
('srv-21', 'Enfermería a domicilio', 'enfermeria', 'Cuidados de enfermería en casa', '💉', 'cat-5', 120000, 60, false, NOW(), NOW()),
('srv-22', 'Fisioterapia', 'fisioterapia', 'Terapia física y rehabilitación', '🏥', 'cat-5', 140000, 60, false, NOW(), NOW()),
('srv-23', 'Nutrición', 'nutricion', 'Consultas nutricionales personalizadas', '🥗', 'cat-5', 100000, 60, false, NOW(), NOW()),
('srv-24', 'Entrenador personal', 'entrenador-personal', 'Entrenamiento físico personalizado', '💪', 'cat-5', 80000, 60, true, NOW(), NOW()),
('srv-25', 'Yoga', 'yoga', 'Clases de yoga a domicilio', '🧘', 'cat-5', 70000, 60, false, NOW(), NOW()),

-- Tecnología
('srv-26', 'Reparación de computadoras', 'reparacion-computadoras', 'Reparación y mantenimiento de PC', '💻', 'cat-6', 100000, 120, true, NOW(), NOW()),
('srv-27', 'Reparación de celulares', 'reparacion-celulares', 'Reparación de smartphones y tablets', '📱', 'cat-6', 80000, 60, true, NOW(), NOW()),
('srv-28', 'Instalación de software', 'instalacion-software', 'Instalación y configuración de programas', '⚙️', 'cat-6', 70000, 90, false, NOW(), NOW()),
('srv-29', 'Soporte técnico', 'soporte-tecnico', 'Asistencia técnica remota o presencial', '🖥️', 'cat-6', 90000, 60, false, NOW(), NOW()),
('srv-30', 'Instalación de redes', 'instalacion-redes', 'Configuración de redes WiFi y cableado', '📡', 'cat-6', 120000, 120, false, NOW(), NOW()),

-- Transporte
('srv-31', 'Mudanzas', 'mudanzas', 'Servicio de mudanzas local', '📦', 'cat-7', 300000, 480, true, NOW(), NOW()),
('srv-32', 'Transporte de carga', 'transporte-carga', 'Transporte de mercancías', '🚚', 'cat-7', 160000, 180, false, NOW(), NOW()),
('srv-33', 'Mensajería', 'mensajeria', 'Entrega de paquetes y documentos', '📮', 'cat-7', 30000, 60, true, NOW(), NOW()),
('srv-68', 'Lavado de autos', 'lavado-autos', 'Lavado y detallado de vehículos', '🚗', 'cat-7', 60000, 90, true, NOW(), NOW()),

-- Educación
('srv-34', 'Clases particulares', 'clases-particulares', 'Tutorías académicas personalizadas', '👨‍🏫', 'cat-8', 60000, 60, true, NOW(), NOW()),
('srv-35', 'Clases de idiomas', 'clases-idiomas', 'Enseñanza de idiomas extranjeros', '🗣️', 'cat-8', 70000, 60, true, NOW(), NOW()),
('srv-36', 'Clases de música', 'clases-musica', 'Clases de instrumentos musicales', '🎸', 'cat-8', 80000, 60, false, NOW(), NOW()),
('srv-37', 'Clases de cocina', 'clases-cocina', 'Aprende a cocinar con profesionales', '👨‍🍳', 'cat-8', 90000, 120, false, NOW(), NOW()),
('srv-70', 'Asesoría legal', 'asesoria-legal', 'Consultas legales básicas', '⚖️', 'cat-8', 160000, 60, false, NOW(), NOW()),

-- Eventos
('srv-38', 'Catering', 'catering', 'Servicio de comida para eventos', '🍽️', 'cat-9', 400000, 240, true, NOW(), NOW()),
('srv-39', 'Fotografía', 'fotografia', 'Fotografía profesional para eventos', '📷', 'cat-9', 300000, 240, true, NOW(), NOW()),
('srv-40', 'DJ', 'dj', 'Música y animación para fiestas', '🎧', 'cat-9', 360000, 240, false, NOW(), NOW()),
('srv-41', 'Decoración de eventos', 'decoracion-eventos', 'Decoración profesional para eventos', '🎈', 'cat-9', 240000, 180, false, NOW(), NOW()),
('srv-42', 'Animación infantil', 'animacion-infantil', 'Entretenimiento para fiestas infantiles', '🤡', 'cat-9', 200000, 180, false, NOW(), NOW()),

-- Mascotas
('srv-43', 'Veterinaria a domicilio', 'veterinaria', 'Atención veterinaria en casa', '🐾', 'cat-10', 120000, 60, true, NOW(), NOW()),
('srv-44', 'Peluquería canina', 'peluqueria-canina', 'Baño y corte para mascotas', '🐕', 'cat-10', 70000, 90, true, NOW(), NOW()),
('srv-45', 'Paseo de perros', 'paseo-perros', 'Paseo y ejercicio para tu mascota', '🦮', 'cat-10', 30000, 60, true, NOW(), NOW()),
('srv-46', 'Entrenamiento canino', 'entrenamiento-canino', 'Adiestramiento profesional de perros', '🎾', 'cat-10', 100000, 60, false, NOW(), NOW()),
('srv-47', 'Cuidado de mascotas', 'cuidado-mascotas', 'Cuidado temporal de mascotas', '🏠', 'cat-10', 50000, 480, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USUARIOS DE PRUEBA
-- ============================================
-- Password para todos: password123
-- Hash bcrypt de 'password123': $2a$10$YourHashHere

INSERT INTO "User" (id, email, name, password, phone, role, "createdAt", "updatedAt") VALUES
-- Admin
('user-admin', 'admin@servicios.com', 'Administrador', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567890', 'ADMIN', NOW(), NOW()),

-- Clientes
('user-client-1', 'cliente@test.com', 'Juan Pérez', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567891', 'CLIENT', NOW(), NOW()),
('user-client-2', 'maria.lopez@test.com', 'María López', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567899', 'CLIENT', NOW(), NOW()),
('user-client-3', 'pedro.sanchez@test.com', 'Pedro Sánchez', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567898', 'CLIENT', NOW(), NOW()),

-- Socios (Partners)
('user-partner-1', 'socio1@test.com', 'María García', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567801', 'PARTNER', NOW(), NOW()),
('user-partner-2', 'socio2@test.com', 'Carlos Rodríguez', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567802', 'PARTNER', NOW(), NOW()),
('user-partner-3', 'socio3@test.com', 'Ana Martínez', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567803', 'PARTNER', NOW(), NOW()),
('user-partner-4', 'socio4@test.com', 'Luis Fernández', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567804', 'PARTNER', NOW(), NOW()),
('user-partner-5', 'socio5@test.com', 'Roberto Díaz', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567805', 'PARTNER', NOW(), NOW()),
('user-partner-6', 'socio6@test.com', 'Laura Gómez', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567806', 'PARTNER', NOW(), NOW()),
('user-partner-7', 'socio7@test.com', 'Diego Torres', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567807', 'PARTNER', NOW(), NOW()),
('user-partner-8', 'socio8@test.com', 'Carmen Ruiz', '$2a$10$rOJ0hs3VxqZZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567808', 'PARTNER', NOW(), NOW()),
('user-partner-9', 'socio9@test.com', 'Pedro Soto', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567809', 'PARTNER', NOW(), NOW()),
('user-partner-10', 'socio10@test.com', 'Isabel Morales', '$2a$10$rOJ0hs3VxqZZ9YvZ9YvZ9.YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ9YvZ', '+1234567810', 'PARTNER', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PERFILES DE SOCIOS
-- ============================================
INSERT INTO "PartnerProfile" (id, "userId", bio, rating, "totalReviews", verified, "createdAt", "updatedAt") VALUES
('profile-1', 'user-partner-1', 'Experta en servicios del hogar con 10 años de experiencia', 4.8, 45, true, NOW(), NOW()),
('profile-2', 'user-partner-2', 'Electricista certificado, servicio rápido y confiable', 4.9, 67, true, NOW(), NOW()),
('profile-3', 'user-partner-3', 'Especialista en limpieza profunda con productos ecológicos', 4.7, 38, true, NOW(), NOW()),
('profile-4', 'user-partner-4', 'Pintor y carpintero profesional con acabados de alta calidad', 4.6, 29, true, NOW(), NOW()),
('profile-5', 'user-partner-5', 'Técnico en reparación de electrodomésticos con garantía', 4.9, 52, true, NOW(), NOW()),
('profile-6', 'user-partner-6', 'Estilista profesional con cortes modernos y tratamientos', 4.8, 41, true, NOW(), NOW()),
('profile-7', 'user-partner-7', 'Técnico en computadoras y redes, soporte remoto disponible', 4.7, 35, true, NOW(), NOW()),
('profile-8', 'user-partner-8', 'Veterinaria con 12 años de experiencia en atención a domicilio', 4.9, 58, true, NOW(), NOW()),
('profile-9', 'user-partner-9', 'Plomero y electricista con servicio de emergencia 24/7', 4.8, 43, true, NOW(), NOW()),
('profile-10', 'user-partner-10', 'Especialista en limpieza y organización del hogar', 4.7, 36, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SERVICIOS DE SOCIOS (PartnerService)
-- ============================================
INSERT INTO "PartnerService" (id, "partnerId", "serviceId", price, active, "createdAt") VALUES
-- María García - Servicios del hogar
('ps-1-1', 'user-partner-1', 'srv-1', 95000, true, NOW()),
('ps-1-2', 'user-partner-1', 'srv-12', 95000, true, NOW()),
('ps-1-3', 'user-partner-1', 'srv-15', 75000, true, NOW()),

-- Carlos Rodríguez - Electricidad y tecnología
('ps-2-1', 'user-partner-2', 'srv-2', 115000, true, NOW()),
('ps-2-2', 'user-partner-2', 'srv-30', 115000, true, NOW()),
('ps-2-3', 'user-partner-2', 'srv-29', 85000, true, NOW()),

-- Ana Martínez - Limpieza
('ps-3-1', 'user-partner-3', 'srv-3', 75000, true, NOW()),
('ps-3-2', 'user-partner-3', 'srv-4', 150000, true, NOW()),
('ps-3-3', 'user-partner-3', 'srv-9', 65000, true, NOW()),
('ps-3-4', 'user-partner-3', 'srv-10', 55000, true, NOW()),

-- Luis Fernández - Pintura y carpintería
('ps-4-1', 'user-partner-4', 'srv-6', 190000, true, NOW()),
('ps-4-2', 'user-partner-4', 'srv-5', 135000, true, NOW()),
('ps-4-3', 'user-partner-4', 'srv-15', 75000, true, NOW()),

-- Roberto Díaz - Reparaciones
('ps-5-1', 'user-partner-5', 'srv-11', 125000, true, NOW()),
('ps-5-2', 'user-partner-5', 'srv-13', 145000, true, NOW()),
('ps-5-3', 'user-partner-5', 'srv-14', 115000, true, NOW()),

-- Laura Gómez - Belleza
('ps-6-1', 'user-partner-6', 'srv-16', 48000, true, NOW()),
('ps-6-2', 'user-partner-6', 'srv-17', 58000, true, NOW()),
('ps-6-3', 'user-partner-6', 'srv-19', 85000, true, NOW()),

-- Diego Torres - Tecnología
('ps-7-1', 'user-partner-7', 'srv-26', 95000, true, NOW()),
('ps-7-2', 'user-partner-7', 'srv-27', 75000, true, NOW()),
('ps-7-3', 'user-partner-7', 'srv-28', 65000, true, NOW()),
('ps-7-4', 'user-partner-7', 'srv-29', 85000, true, NOW()),

-- Carmen Ruiz - Mascotas
('ps-8-1', 'user-partner-8', 'srv-43', 115000, true, NOW()),
('ps-8-2', 'user-partner-8', 'srv-44', 65000, true, NOW()),
('ps-8-3', 'user-partner-8', 'srv-47', 48000, true, NOW()),

-- Pedro Soto - Plomería y electricidad
('ps-9-1', 'user-partner-9', 'srv-1', 98000, true, NOW()),
('ps-9-2', 'user-partner-9', 'srv-2', 118000, true, NOW()),
('ps-9-3', 'user-partner-9', 'srv-14', 118000, true, NOW()),

-- Isabel Morales - Limpieza
('ps-10-1', 'user-partner-10', 'srv-3', 78000, true, NOW()),
('ps-10-2', 'user-partner-10', 'srv-10', 58000, true, NOW()),
('ps-10-3', 'user-partner-10', 'srv-9', 68000, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FIN DEL SEED
-- ============================================
-- Verificar datos insertados
SELECT 'Categorías: ' || COUNT(*) FROM "Category";
SELECT 'Servicios: ' || COUNT(*) FROM "Service";
SELECT 'Usuarios: ' || COUNT(*) FROM "User";
SELECT 'Perfiles de socios: ' || COUNT(*) FROM "PartnerProfile";
SELECT 'Servicios de socios: ' || COUNT(*) FROM "PartnerService";
