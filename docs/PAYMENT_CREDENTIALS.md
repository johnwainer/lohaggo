# Sistema de Credenciales de MercadoPago

## 📋 Descripción

El sistema de pagos de LoHaggo utiliza MercadoPago como proveedor de pagos. Las credenciales se gestionan de forma dinámica desde la base de datos, permitiendo cambiar entre ambientes TEST y PRODUCTION sin necesidad de modificar código o variables de entorno.

## 🏗️ Arquitectura

### 1. **Modelo de Base de Datos**

```prisma
model PaymentConfig {
  id                        String              @id @default(cuid())
  environment               PaymentEnvironment  @default(TEST)
  testAccessToken           String?
  testPublicKey             String?
  testClientId              String?
  testClientSecret          String?
  productionAccessToken     String?
  productionPublicKey       String?
  productionClientId        String?
  productionClientSecret    String?
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt
}

enum PaymentEnvironment {
  TEST
  PRODUCTION
}
```

### 2. **Flujo de Credenciales**

```
┌─────────────────────────────────────────────────────────┐
│                   Solicitud de Pago                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         getMercadoPagoClient() - lib/mercadopago.ts     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  1. Verificar caché (TTL: 5 minutos)                    │
│  2. Si no hay caché, consultar DB                       │
│  3. Seleccionar credenciales según ambiente             │
│  4. Si falla, usar .env.local como fallback             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Retornar Cliente MercadoPago               │
└─────────────────────────────────────────────────────────┘
```

### 3. **Prioridad de Credenciales**

1. **Primera prioridad**: Credenciales en la base de datos
2. **Fallback**: Variables de entorno en `.env.local`

## 🔧 Configuración Inicial

### Paso 1: Verificar Configuración Actual

```bash
npx tsx scripts/check-payment-config.ts
```

Este script mostrará:
- ✅ Si existe configuración en la DB
- 📊 Detalles de las credenciales configuradas
- 🔑 Estado de credenciales TEST y PRODUCTION
- 📌 Ambiente actual (TEST o PRODUCTION)

### Paso 2: Actualizar Credenciales

```bash
npx tsx scripts/update-payment-config.ts
```

Este script:
- Lee las credenciales de `.env.local`
- Actualiza la configuración en la base de datos
- Confirma la actualización exitosa

## 🔑 Credenciales de MercadoPago

### Credenciales TEST (Sandbox)

Las credenciales TEST se usan para desarrollo y pruebas. Obtén tus credenciales de prueba en:
https://www.mercadopago.com.co/developers/panel/credentials

```env
MERCADOPAGO_ACCESS_TOKEN="APP_USR-XXXXXXXX-XXXXXX-..."
MERCADOPAGO_PUBLIC_KEY="APP_USR-XXXXXXXX-XXXX-..."
```

**Características**:
- ✅ No procesa pagos reales
- ✅ Permite probar el flujo completo
- ✅ Usa tarjetas de prueba de MercadoPago
- ✅ Ideal para desarrollo

### Credenciales PRODUCTION

Las credenciales PRODUCTION se usan en el entorno de producción. Obtén tus credenciales de producción en:
https://www.mercadopago.com.co/developers/panel/credentials

```env
MERCADOPAGO_PRODUCTION_ACCESS_TOKEN="APP_USR-XXXXXXXX-XXXXXX-..."
MERCADOPAGO_PRODUCTION_PUBLIC_KEY="APP_USR-XXXXXXXX-XXXX-..."
```

**Características**:
- ⚠️ Procesa pagos reales
- ⚠️ Requiere cuenta verificada de MercadoPago
- ⚠️ Cobra comisiones reales
- ⚠️ Solo para producción

## 🔄 Cambiar Entre Ambientes

### Opción 1: Desde la Base de Datos (Recomendado)

```sql
-- Cambiar a TEST
UPDATE "PaymentConfig" 
SET environment = 'TEST' 
WHERE id = 'tu-config-id';

-- Cambiar a PRODUCTION
UPDATE "PaymentConfig" 
SET environment = 'PRODUCTION' 
WHERE id = 'tu-config-id';
```

### Opción 2: Desde la API (Próximamente)

Se puede crear un endpoint de administración para cambiar el ambiente desde el panel de admin.

## 📊 Monitoreo

### Verificar Ambiente Actual

```bash
# Desde la terminal
npx tsx scripts/check-payment-config.ts

# Desde la API
curl http://localhost:3000/api/payment-mode
```

### Respuesta de la API

```json
{
  "isTestMode": true
}
```

## 🎨 Banner de Modo Pruebas

El sistema incluye un banner visual que indica cuando está en modo TEST:

```tsx
// components/TestModeBanner.tsx
- Muestra: "⚠️ MODO PRUEBAS ACTIVO"
- Color: Gradiente naranja-rojo animado
- Ubicación: Parte superior de todas las páginas
- Comportamiento: Se oculta automáticamente en PRODUCTION
```

## 🔒 Seguridad

### Buenas Prácticas

1. **Nunca** commitear credenciales en el código
2. **Siempre** usar variables de entorno
3. **Rotar** credenciales periódicamente
4. **Limitar** acceso a credenciales PRODUCTION
5. **Monitorear** transacciones sospechosas

### Protección de Credenciales

- ✅ Credenciales almacenadas en DB (encriptadas en producción)
- ✅ Variables de entorno como fallback
- ✅ Caché con TTL de 5 minutos
- ✅ Logs sin exponer credenciales completas

### Archivos Sensibles

Los siguientes archivos **NUNCA** deben estar en git:

```
.env
.env.local
.env.production
.env.production.local
```

Verifica que estén en `.gitignore`:

```gitignore
# local env files
.env*.local
.env
.env.production
.env.production.local
```

## 📝 Scripts Disponibles

### `check-payment-config.ts`

Verifica y muestra la configuración actual de pagos.

```bash
npx tsx scripts/check-payment-config.ts
```

**Salida**:
- ID de configuración
- Ambiente actual
- Estado de credenciales TEST
- Estado de credenciales PRODUCTION
- Advertencias si faltan credenciales

### `update-payment-config.ts`

Actualiza las credenciales desde `.env.local`.

```bash
npx tsx scripts/update-payment-config.ts
```

**Acciones**:
- Lee `MERCADOPAGO_ACCESS_TOKEN`
- Lee `MERCADOPAGO_PUBLIC_KEY`
- Actualiza la configuración en DB
- Confirma la actualización

## 🚀 Despliegue

### Desarrollo

```bash
# 1. Configurar credenciales TEST en .env.local
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
MERCADOPAGO_PUBLIC_KEY="APP_USR-..."

# 2. Actualizar DB
npx tsx scripts/update-payment-config.ts

# 3. Verificar
npx tsx scripts/check-payment-config.ts

# 4. Iniciar servidor
npm run dev
```

### Producción

```bash
# 1. Configurar credenciales PRODUCTION en variables de entorno
export MERCADOPAGO_PRODUCTION_ACCESS_TOKEN="APP_USR-..."
export MERCADOPAGO_PRODUCTION_PUBLIC_KEY="APP_USR-..."

# 2. Actualizar DB con credenciales PRODUCTION
# (Usar script personalizado o panel de admin)

# 3. Cambiar ambiente a PRODUCTION
UPDATE "PaymentConfig" SET environment = 'PRODUCTION';

# 4. Verificar
npx tsx scripts/check-payment-config.ts

# 5. Desplegar
npm run build && npm start
```

## 🐛 Troubleshooting

### Error: "No payment configuration found"

**Causa**: No existe configuración en la base de datos.

**Solución**:
```bash
npx tsx scripts/check-payment-config.ts
```

### Error: "Missing test/production credentials"

**Causa**: Faltan credenciales para el ambiente actual.

**Solución**:
1. Verificar `.env.local`
2. Ejecutar `npx tsx scripts/update-payment-config.ts`
3. O configurar credenciales directamente en DB

### Banner de TEST no aparece

**Causa**: El ambiente está en PRODUCTION o hay error en la API.

**Solución**:
1. Verificar ambiente: `npx tsx scripts/check-payment-config.ts`
2. Cambiar a TEST si es necesario
3. Reiniciar el servidor

## 📚 Referencias

- [Documentación de MercadoPago](https://www.mercadopago.com.co/developers)
- [Credenciales de Prueba](https://www.mercadopago.com.co/developers/es/docs/credentials)
- [Tarjetas de Prueba](https://www.mercadopago.com.co/developers/es/docs/testing/test-cards)

## 🤝 Contribuir

Para agregar nuevas funcionalidades al sistema de pagos:

1. Actualizar el modelo `PaymentConfig` si es necesario
2. Modificar `lib/mercadopago.ts` para la lógica de credenciales
3. Crear scripts de migración si hay cambios en DB
4. Actualizar esta documentación

---

**Última actualización**: Diciembre 2, 2025
**Versión**: 1.0.0
