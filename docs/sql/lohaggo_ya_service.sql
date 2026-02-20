-- LoHaggo Ya (categoría Favor + servicio destacado)
-- Ejecutar en Supabase SQL Editor

BEGIN;

WITH favor_category AS (
  INSERT INTO "Category" (
    "id",
    "name",
    "slug",
    "icon",
    "description",
    "order"
  )
  VALUES (
    gen_random_uuid()::text,
    'Favor',
    'favor',
    '🛵',
    'Encargos y diligencias rápidas para clientes.',
    0
  )
  ON CONFLICT ("slug") DO UPDATE
  SET
    "name" = EXCLUDED."name",
    "icon" = EXCLUDED."icon",
    "description" = EXCLUDED."description",
    "order" = EXCLUDED."order"
  RETURNING "id"
),
resolved_category AS (
  SELECT "id" FROM favor_category
  UNION ALL
  SELECT c."id"
  FROM "Category" c
  WHERE c."slug" = 'favor'
  LIMIT 1
)
INSERT INTO "Service" (
  "id",
  "name",
  "slug",
  "description",
  "icon",
  "categoryId",
  "basePrice",
  "duration",
  "popular",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'LoHaggo Ya',
  'lohaggo-ya',
  'Encargos y diligencias express: compra, recogida y entrega en minutos.',
  '🛵',
  rc."id",
  25000,
  60,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM resolved_category rc
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "categoryId" = EXCLUDED."categoryId",
  "basePrice" = EXCLUDED."basePrice",
  "duration" = EXCLUDED."duration",
  "popular" = EXCLUDED."popular",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Asignar automáticamente LoHaggo Ya a socios existentes (puedes eliminar este bloque si prefieres asignación manual)
WITH lohaggo_ya AS (
  SELECT "id", "basePrice" FROM "Service" WHERE "slug" = 'lohaggo-ya' LIMIT 1
)
INSERT INTO "PartnerService" (
  "id",
  "partnerId",
  "serviceId",
  "price",
  "city",
  "active",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  pp."id",
  s."id",
  s."basePrice",
  u."city",
  true,
  CURRENT_TIMESTAMP
FROM lohaggo_ya s
JOIN "PartnerProfile" pp ON true
JOIN "User" u ON u."id" = pp."userId"
ON CONFLICT ("partnerId", "serviceId") DO NOTHING;

COMMIT;
