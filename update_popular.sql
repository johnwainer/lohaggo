-- Primero, marcar todos los servicios como NO populares
UPDATE "Service" SET popular = false;

-- Luego, marcar solo los 20 servicios más solicitados en Colombia como populares
UPDATE "Service" SET popular = true WHERE slug = 'plomeria';
UPDATE "Service" SET popular = true WHERE slug = 'electricidad';
UPDATE "Service" SET popular = true WHERE slug = 'limpieza-hogar';
UPDATE "Service" SET popular = true WHERE slug = 'carpinteria';
UPDATE "Service" SET popular = true WHERE slug = 'pintura';
UPDATE "Service" SET popular = true WHERE slug = 'jardineria';
UPDATE "Service" SET popular = true WHERE slug = 'fumigacion';
UPDATE "Service" SET popular = true WHERE slug = 'lavado-alfombras';
UPDATE "Service" SET popular = true WHERE slug = 'reparacion-electrodomesticos';
UPDATE "Service" SET popular = true WHERE slug = 'cerrajeria';
UPDATE "Service" SET popular = true WHERE slug = 'reparacion-aires';
UPDATE "Service" SET popular = true WHERE slug = 'peluqueria';
UPDATE "Service" SET popular = true WHERE slug = 'manicure-pedicure';
UPDATE "Service" SET popular = true WHERE slug = 'masajes';
UPDATE "Service" SET popular = true WHERE slug = 'reparacion-computadoras';
UPDATE "Service" SET popular = true WHERE slug = 'mudanzas';
UPDATE "Service" SET popular = true WHERE slug = 'clases-particulares';
UPDATE "Service" SET popular = true WHERE slug = 'veterinaria';
UPDATE "Service" SET popular = true WHERE slug = 'peluqueria-canina';
UPDATE "Service" SET popular = true WHERE slug = 'paseo-perros';

-- Verificar los servicios populares
SELECT name, slug, popular FROM "Service" WHERE popular = true ORDER BY name;
