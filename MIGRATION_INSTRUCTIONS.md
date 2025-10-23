# Migración Manual de Base de Datos en Supabase

## Paso 1: Accede al SQL Editor de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en **SQL Editor**

## Paso 2: Ejecuta el SQL de migración

1. Copia TODO el contenido del archivo `full_migration.sql`
2. Pégalo en el SQL Editor
3. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)

## Paso 3: Verifica que las tablas se crearon

1. En el menú lateral, haz clic en **Table Editor**
2. Deberías ver las tablas creadas

## Paso 4: Ejecuta el seed (datos iniciales)

Copia y ejecuta este SQL en el SQL Editor para agregar categorías y servicios:

```sql
-- Insertar categorías
INSERT INTO "Category" (id, name, slug, icon, description, "order") VALUES
('1', 'Hogar', 'hogar', 'home', 'Servicios para el hogar', 1),
('2', 'Belleza', 'belleza', 'sparkles', 'Servicios de belleza y cuidado personal', 2),
('3', 'Tecnología', 'tecnologia', 'laptop', 'Servicios de tecnología y reparación', 3),
('4', 'Transporte', 'transporte', 'car', 'Servicios de transporte y mudanzas', 4),
('5', 'Eventos', 'eventos', 'calendar', 'Servicios para eventos y celebraciones', 5),
('6', 'Salud', 'salud', 'heart', 'Servicios de salud y bienestar', 6);

-- Insertar servicios
INSERT INTO "Service" (id, name, slug, description, "categoryId", "basePrice", duration, popular, "imageUrl") VALUES
('s1', 'Limpieza del Hogar', 'limpieza-hogar', 'Servicio profesional de limpieza para tu hogar', '1', 50000, 180, true, '/images/services/limpieza.jpg'),
('s2', 'Plomería', 'plomeria', 'Reparación e instalación de sistemas de agua', '1', 40000, 120, true, '/images/services/plomeria.jpg'),
('s3', 'Electricidad', 'electricidad', 'Instalación y reparación eléctrica', '1', 45000, 120, false, '/images/services/electricidad.jpg'),
('s4', 'Jardinería', 'jardineria', 'Mantenimiento y diseño de jardines', '1', 35000, 180, false, '/images/services/jardineria.jpg'),
('s5', 'Peluquería a Domicilio', 'peluqueria', 'Corte y peinado profesional en tu hogar', '2', 30000, 90, true, '/images/services/peluqueria.jpg'),
('s6', 'Manicure y Pedicure', 'manicure-pedicure', 'Cuidado profesional de uñas', '2', 25000, 90, false, '/images/services/manicure.jpg'),
('s7', 'Masajes', 'masajes', 'Masajes terapéuticos y relajantes', '2', 50000, 60, true, '/images/services/masajes.jpg'),
('s8', 'Reparación de Computadores', 'reparacion-computadores', 'Diagnóstico y reparación de PC y laptops', '3', 40000, 120, true, '/images/services/computadores.jpg'),
('s9', 'Instalación de Software', 'instalacion-software', 'Instalación y configuración de programas', '3', 30000, 60, false, '/images/services/software.jpg'),
('s10', 'Mudanzas', 'mudanzas', 'Servicio completo de mudanzas', '4', 150000, 240, true, '/images/services/mudanzas.jpg'),
('s11', 'Transporte de Carga', 'transporte-carga', 'Transporte de mercancía y objetos', '4', 80000, 120, false, '/images/services/carga.jpg'),
('s12', 'Catering', 'catering', 'Servicio de comida para eventos', '5', 200000, 240, true, '/images/services/catering.jpg'),
('s13', 'Fotografía', 'fotografia', 'Fotografía profesional para eventos', '5', 150000, 180, true, '/images/services/fotografia.jpg'),
('s14', 'DJ y Sonido', 'dj-sonido', 'Música y sonido para eventos', '5', 180000, 240, false, '/images/services/dj.jpg'),
('s15', 'Enfermería a Domicilio', 'enfermeria', 'Cuidados de enfermería en casa', '6', 60000, 120, false, '/images/services/enfermeria.jpg'),
('s16', 'Fisioterapia', 'fisioterapia', 'Terapia física y rehabilitación', '6', 55000, 60, true, '/images/services/fisioterapia.jpg');
```

## Verificación

Después de ejecutar las migraciones, ve a https://lohaggo.vercel.app/ y la página debería cargar correctamente.
