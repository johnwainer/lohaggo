# 🚀 Instrucciones de Despliegue - Tarifas de Comisión Congeladas

## 📋 Resumen de Cambios

Este despliegue implementa el sistema de tarifas de comisión "congeladas" que asegura que las tarifas aplicadas a un servicio sean las del momento en que se aceptó la propuesta, no las actuales.

### Cambios Principales:
- ✅ Nuevos campos en tabla `Booking`: `clientCommissionRate` y `partnerCommissionRate`
- ✅ Modificación de endpoints de pagos y payouts
- ✅ Scripts de utilidad para gestión de configuración

---

## 🗄️ PASO 1: Ejecutar SQL en Base de Datos de Producción

### Opción A: Desde Vercel Postgres Dashboard

1. Ve a tu proyecto en Vercel
2. Navega a **Storage** → **Postgres** → **Query**
3. Copia y pega el siguiente SQL:

\`\`\`sql
-- =====================================================
-- MIGRACIÓN: Tarifas de Comisión Congeladas
-- =====================================================

-- 1. Agregar campos de comisión al modelo Booking
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "clientCommissionRate" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "partnerCommissionRate" DOUBLE PRECISION;

-- 2. Actualizar o crear configuración de plataforma
INSERT INTO "PlatformConfig" (
  id,
  key,
  "commissionRate",
  "clientCommissionRate",
  "partnerCommissionRate",
  "minServicePrice",
  "maxServicePrice",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'default',
  15.0,
  5.0,
  20.0,
  10000,
  10000000,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0,
  "commissionRate" = 15.0,
  "updatedAt" = NOW();

-- 3. Actualizar bookings existentes con las tarifas actuales
UPDATE "Booking"
SET 
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0
WHERE 
  "clientCommissionRate" IS NULL 
  OR "partnerCommissionRate" IS NULL;

-- 4. Verificar los cambios
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN "clientCommissionRate" IS NOT NULL THEN 1 END) as bookings_with_client_rate,
  COUNT(CASE WHEN "partnerCommissionRate" IS NOT NULL THEN 1 END) as bookings_with_partner_rate
FROM "Booking";

-- 5. Verificar configuración
SELECT 
  key,
  "clientCommissionRate",
  "partnerCommissionRate",
  "commissionRate"
FROM "PlatformConfig"
WHERE key = 'default';
\`\`\`

4. Haz clic en **Run Query**
5. Verifica que los resultados muestren:
   - Columnas agregadas exitosamente
   - Configuración creada/actualizada
   - Todos los bookings con tarifas asignadas

### Opción B: Desde Terminal con psql

\`\`\`bash
# Conectarse a la base de datos de producción
psql "postgresql://[TU_CONNECTION_STRING]"

# Ejecutar el archivo SQL
\\i migration-production.sql
\`\`\`

---

## 🔄 PASO 2: Despliegue Automático en Vercel

Los cambios ya están en GitHub, por lo que Vercel desplegará automáticamente:

1. Ve a tu proyecto en Vercel
2. Navega a **Deployments**
3. Espera a que el despliegue se complete (generalmente 2-3 minutos)
4. Verifica que el estado sea **Ready**

---

## ✅ PASO 3: Verificación Post-Despliegue

### 3.1 Verificar Base de Datos

Ejecuta esta query para confirmar que todo está correcto:

\`\`\`sql
-- Verificar estructura de Booking
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Booking' 
  AND column_name IN ('clientCommissionRate', 'partnerCommissionRate');

-- Verificar datos
SELECT 
  id,
  "totalPrice",
  "clientCommissionRate",
  "partnerCommissionRate",
  status
FROM "Booking"
LIMIT 5;
\`\`\`

**Resultado esperado:**
- Ambas columnas deben existir
- Tipo: `double precision`
- Nullable: `YES`
- Bookings existentes deben tener valores 5.0 y 20.0

### 3.2 Verificar Aplicación

1. **Dashboard de Cliente:**
   - Abre el dashboard del cliente
   - Verifica que se muestre el desglose de costos con 5% de tarifa
   - Revisa la consola del navegador para logs: `💰 Client Commission Rate from API: 5`

2. **Aceptar una Propuesta:**
   - Acepta una propuesta de prueba
   - Verifica en la base de datos que el booking tenga las tarifas guardadas:
   \`\`\`sql
   SELECT * FROM "Booking" ORDER BY "createdAt" DESC LIMIT 1;
   \`\`\`

3. **Panel de Admin:**
   - Ve a `/admin`
   - Navega a la sección de Comisiones
   - Verifica que puedas ver y modificar las tarifas

---

## 🔧 PASO 4: Configuración Opcional

Si deseas cambiar las tarifas por defecto, puedes hacerlo desde:

### Opción A: Panel de Admin
1. Ve a `https://tu-dominio.com/admin`
2. Sección **Comisiones**
3. Modifica las tarifas
4. Guarda los cambios

### Opción B: SQL Directo
\`\`\`sql
UPDATE "PlatformConfig"
SET 
  "clientCommissionRate" = 7.0,  -- Nueva tarifa cliente
  "partnerCommissionRate" = 25.0, -- Nueva tarifa socio
  "updatedAt" = NOW()
WHERE key = 'default';
\`\`\`

**IMPORTANTE:** Los cambios en tarifas solo afectarán a nuevos servicios, no a los ya contratados.

---

## 🐛 Troubleshooting

### Error: "Column already exists"
**Solución:** Esto es normal si ejecutas el SQL múltiples veces. El script es idempotente.

### Error: "PlatformConfig not found"
**Solución:** Ejecuta:
\`\`\`sql
INSERT INTO "PlatformConfig" (id, key, "commissionRate", "clientCommissionRate", "partnerCommissionRate", "minServicePrice", "maxServicePrice", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'default', 15.0, 5.0, 20.0, 10000, 10000000, NOW(), NOW());
\`\`\`

### Bookings sin tarifas
**Solución:** Ejecuta el script de actualización:
\`\`\`sql
UPDATE "Booking"
SET 
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0
WHERE 
  "clientCommissionRate" IS NULL;
\`\`\`

---

## 📊 Monitoreo

Después del despliegue, monitorea:

1. **Logs de Vercel:**
   - Busca mensajes: `✅ Usando tarifa guardada en el booking`
   - Verifica que no haya errores relacionados con comisiones

2. **Pagos:**
   - Verifica que los pagos se procesen correctamente
   - Confirma que los montos sean correctos

3. **Payouts:**
   - Verifica que los payouts se creen con las tarifas correctas
   - Confirma que los socios reciban el monto neto correcto

---

## 📝 Notas Importantes

1. **Compatibilidad hacia atrás:** Los bookings antiguos sin tarifas usarán las tarifas actuales de PlatformConfig
2. **Nuevos bookings:** Siempre guardarán las tarifas al momento de creación
3. **Cambios de tarifas:** Solo afectan a nuevos servicios, no a los existentes
4. **Rollback:** Si necesitas revertir, simplemente haz rollback en Vercel y ejecuta:
   \`\`\`sql
   ALTER TABLE "Booking" 
   DROP COLUMN IF EXISTS "clientCommissionRate",
   DROP COLUMN IF EXISTS "partnerCommissionRate";
   \`\`\`

---

## ✨ Archivos Importantes

- \`migration-production.sql\` - SQL para ejecutar en producción
- \`prisma/schema.prisma\` - Schema actualizado con nuevos campos
- \`app/api/proposals/[id]/accept/route.ts\` - Guarda tarifas al aceptar propuesta
- \`app/api/payments/create/route.ts\` - Usa tarifas guardadas
- \`app/api/payments/webhook/route.ts\` - Crea payouts con tarifas guardadas
- \`scripts/update-bookings-rates.ts\` - Script de utilidad

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, el sistema estará funcionando con tarifas congeladas. Los clientes y socios verán las tarifas que se aplicaron al momento de contratar el servicio, sin importar cambios posteriores en la configuración.
\`\`\`
