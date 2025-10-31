# Haggo - Plataforma de Servicios

Una plataforma moderna para solicitar servicios (plomería, limpieza, electricidad, etc.) con paneles para clientes, socios y administradores.

## 🚀 Características

- **50+ Servicios** organizados en 10 categorías
- **3 Tipos de Usuarios**: Clientes, Socios (Proveedores) y Administradores
- **Sistema de Solicitudes**: Los clientes publican solicitudes y los partners envían propuestas
- **Sistema de Pagos**: Integración completa con Mercado Pago
- **Comisiones Congeladas**: Las tarifas se guardan al momento de aceptar el servicio
- **Payouts Automáticos**: Distribución automática de pagos a socios
- **Subida de Fotos**: Los clientes pueden adjuntar fotos a sus solicitudes
- **Notificaciones en Tiempo Real**: Sistema de notificaciones push
- **Gestión de Direcciones**: Los clientes pueden guardar múltiples direcciones
- **Panel de Administración**: Control completo de comisiones, pagos y payouts
- **Autenticación** con NextAuth.js
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive** - Funciona en móviles, tablets y desktop

## 🛠️ Tecnologías

- **Next.js 14** (App Router)
- **TypeScript**
- **Prisma** (ORM)
- **PostgreSQL** (Base de datos)
- **Vercel Postgres** (Base de datos en producción)
- **Mercado Pago** (Procesamiento de pagos)
- **Cloudinary** (Almacenamiento de imágenes)
- **NextAuth.js** (Autenticación)
- **Tailwind CSS** (Estilos)

## 📋 Requisitos Previos

- Node.js 18+ instalado
- PostgreSQL instalado (para desarrollo local) o cuenta de Vercel
- Cuenta de Cloudinary (para subida de fotos)
- Cuenta de Mercado Pago (para procesamiento de pagos)
- npm o yarn

## 🔧 Instalación Local

1. **Clonar el repositorio**

```bash
git clone <tu-repositorio>
cd haggo
npm install
```

2. **Configurar variables de entorno**

Crear un archivo `.env.local` en la raíz del proyecto:

```env
# Base de datos
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/haggo_db"

# NextAuth
NEXTAUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (para subida de fotos)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="tu-cloud-name"
CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="tu-access-token"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="tu-public-key"
```

3. **Configurar la base de datos**

```bash
# Aplicar migraciones
npx prisma migrate deploy

# O usar el archivo SQL consolidado
psql -U usuario -d haggo_db -f database_migration.sql

# Poblar con datos iniciales
npx prisma db seed
```

4. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🚀 Deploy en Vercel

### 1. Configurar Base de Datos (Vercel Postgres)

1. Crea un proyecto en [Vercel](https://vercel.com)
2. Ve a Storage → Create Database → Postgres
3. Copia la **Connection String**
4. Ejecuta el archivo `migration-production.sql` en el Query Editor

### 2. Configurar Cloudinary

1. Crea una cuenta en [Cloudinary](https://cloudinary.com)
2. Ve a Dashboard y copia:
   - Cloud Name
   - API Key
   - API Secret

### 3. Configurar Mercado Pago

1. Crea una cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Ve a Tus integraciones → Crear aplicación
3. Copia las credenciales de producción:
   - Access Token
   - Public Key

### 4. Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require
NEXTAUTH_SECRET=tu-secreto-super-seguro-aqui
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
MERCADOPAGO_ACCESS_TOKEN=tu-access-token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu-public-key
```

**Importante**: Marca las 3 opciones (Production, Preview, Development) para cada variable.

### 5. Deploy

```bash
git push origin main
```

Vercel hará el deploy automáticamente.

### 6. Ejecutar Migración de Base de Datos

Después del primer deploy, ejecuta el SQL en Vercel Postgres:

1. Ve a Storage → Postgres → Query
2. Copia y pega el contenido de `migration-production.sql`
3. Haz clic en "Run Query"
4. Verifica que todas las tablas se hayan creado correctamente

**Ver instrucciones detalladas en:** `DEPLOYMENT_INSTRUCTIONS.md`

## 👥 Usuarios de Prueba

Después de ejecutar el seed, puedes usar estos usuarios:

### Cliente
- **Email**: cliente@test.com
- **Contraseña**: password123

### Socio/Proveedor
- **Email**: partner@test.com
- **Contraseña**: password123

## 📱 Estructura de la Aplicación

### Páginas Públicas
- `/` - Página principal con categorías y servicios populares
- `/servicios` - Catálogo completo de servicios con búsqueda y filtros
- `/servicios/[slug]` - Detalle de servicio con formulario de solicitud
- `/login` - Inicio de sesión
- `/register` - Registro de nuevos usuarios

### Paneles Privados
- `/dashboard` - Panel de cliente (crear solicitudes, ver propuestas, realizar pagos)
- `/dashboard/addresses` - Gestión de direcciones guardadas
- `/dashboard/payment-methods` - Gestión de métodos de pago
- `/partner` - Panel de socio (ver solicitudes, enviar propuestas, recibir payouts)
- `/admin` - Panel administrativo (estadísticas, comisiones, pagos y payouts)

## 💰 Sistema de Pagos y Comisiones

### Flujo de Pagos

1. **Cliente acepta propuesta** → Se crea un Booking con las tarifas actuales congeladas
2. **Cliente realiza pago** → Se procesa con Mercado Pago
3. **Pago confirmado** → Se crea automáticamente un Payout para el socio
4. **Socio recibe pago** → El monto neto (después de comisión) se transfiere

### Comisiones Congeladas

Las tarifas de comisión se guardan en el momento que se acepta la propuesta:
- **Cliente**: 5% por defecto (configurable desde `/admin`)
- **Socio**: 20% por defecto (configurable desde `/admin`)

**Importante**: Los cambios en las tarifas NO afectan servicios ya contratados.

### Desglose de Costos

Para un servicio de $10,000:
- **Precio del servicio**: $10,000
- **Comisión cliente (5%)**: $500
- **Total a pagar**: $10,500
- **Comisión socio (20%)**: $2,000
- **Payout al socio**: $8,000

### Panel de Administración

Desde `/admin` puedes:
- Ver todos los pagos y su estado
- Ver todos los payouts pendientes y completados
- Configurar tarifas de comisión (cliente y socio)
- Procesar payouts manualmente si es necesario
- Ver estadísticas de ingresos por comisiones

## 🎨 Categorías de Servicios

1. **Hogar** - Plomería, Electricidad, Carpintería, etc.
2. **Limpieza** - Limpieza de hogar, oficinas, alfombras, etc.
3. **Reparaciones** - Electrodomésticos, cerrajería, aires acondicionados, etc.
4. **Belleza** - Peluquería, Manicure, Masajes, etc.
5. **Salud** - Enfermería, fisioterapia, nutrición, etc.
6. **Tecnología** - Reparación de computadoras, instalación de software, etc.
7. **Transporte** - Mudanzas, mensajería, transporte de mascotas, etc.
8. **Educación** - Clases particulares, tutorías, idiomas, etc.
9. **Eventos** - Fotografía, catering, decoración, etc.
10. **Mascotas** - Veterinaria, peluquería, paseos, etc.

## 📂 Archivos Importantes

### Configuración
- `.env.local` - Variables de entorno locales (no incluido en git)
- `prisma/schema.prisma` - Esquema de la base de datos

### Migraciones y Scripts
- `migration-production.sql` - Migración SQL para producción (incluye comisiones)
- `database_migration.sql` - Migración completa de base de datos con datos iniciales
- `scripts/update-config.ts` - Script para actualizar configuración de comisiones
- `scripts/update-bookings-rates.ts` - Script para actualizar tarifas en bookings existentes
- `scripts/check-config.ts` - Script para verificar configuración actual

### Documentación
- `README.md` - Este archivo
- `DEPLOYMENT_INSTRUCTIONS.md` - Guía detallada de despliegue
- `PAYMENT_SYSTEM.md` - Documentación del sistema de pagos
- `ARCHITECTURE.md` - Documentación de la arquitectura del proyecto

### APIs Importantes
- `app/api/payments/create/route.ts` - Crear intención de pago
- `app/api/payments/process/route.ts` - Procesar pago con Mercado Pago
- `app/api/payments/webhook/route.ts` - Webhook de Mercado Pago (crea payouts)
- `app/api/payouts/process/route.ts` - Procesar payouts a socios
- `app/api/admin/commission-config/route.ts` - Gestión de comisiones

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Construir para producción
npm run start            # Iniciar servidor de producción

# Base de datos
npx prisma studio        # Abrir interfaz visual de la BD
npx prisma migrate dev   # Crear nueva migración
npx prisma migrate deploy # Aplicar migraciones
npx prisma db seed       # Poblar con datos iniciales
npx prisma generate      # Regenerar cliente de Prisma

# Scripts de utilidad
npx tsx scripts/check-config.ts           # Ver configuración actual
npx tsx scripts/update-config.ts          # Actualizar comisiones
npx tsx scripts/update-bookings-rates.ts  # Actualizar tarifas en bookings

# Linting y formato
npm run lint             # Ejecutar linter
```

## 🐛 Troubleshooting

### Error de conexión a base de datos en Vercel

Si ves el error `Can't reach database server`:

1. Verifica que tu base de datos de Vercel Postgres esté activa
2. Asegúrate de usar `?sslmode=require` al final de la URL
3. Verifica que todas las variables de entorno estén configuradas en Vercel
4. Ejecuta el archivo `migration-production.sql` en Vercel Postgres Query Editor

### Fotos no se suben

1. Verifica que las credenciales de Cloudinary estén correctas
2. Asegúrate de que las variables de entorno estén configuradas en Vercel
3. Revisa los logs de Vercel para más detalles

### Errores de TypeScript

```bash
# Regenerar cliente de Prisma
npx prisma generate

# Limpiar caché de Next.js
rm -rf .next
npm run dev
```

### Pagos no se procesan

1. Verifica que las credenciales de Mercado Pago sean de producción
2. Asegúrate de que el webhook esté configurado en Mercado Pago
3. Revisa los logs en `/admin` sección de Pagos
4. Verifica que la URL del webhook sea: `https://tu-dominio.vercel.app/api/payments/webhook`

### Comisiones incorrectas

1. Verifica la configuración en `/admin` sección de Comisiones
2. Ejecuta el script de verificación:
   ```bash
   npx tsx scripts/check-config.ts
   ```
3. Si es necesario, actualiza las tarifas:
   ```bash
   npx tsx scripts/update-config.ts
   ```

### Bookings sin tarifas guardadas

Si tienes bookings antiguos sin tarifas, ejecuta:
```bash
npx tsx scripts/update-bookings-rates.ts
```

O ejecuta este SQL en la base de datos:
```sql
UPDATE "Booking"
SET
  "clientCommissionRate" = 5.0,
  "partnerCommissionRate" = 20.0
WHERE
  "clientCommissionRate" IS NULL;
```

### Payouts no se crean automáticamente

1. Verifica que el webhook de Mercado Pago esté funcionando
2. Revisa los logs en `/api/payments/webhook`
3. Verifica que el pago tenga estado `approved` en Mercado Pago
4. Manualmente puedes crear payouts desde `/admin` sección de Payouts

### Error "Commission config not found"

1. Ejecuta el script para crear la configuración inicial:
   ```bash
   npx tsx scripts/update-config.ts
   ```
2. O ejecuta este SQL en la base de datos:
   ```sql
   INSERT INTO "CommissionConfig" ("id", "clientCommissionRate", "partnerCommissionRate")
   VALUES (1, 5.0, 20.0)
   ON CONFLICT ("id") DO UPDATE SET
     "clientCommissionRate" = EXCLUDED."clientCommissionRate",
     "partnerCommissionRate" = EXCLUDED."partnerCommissionRate";
   ```

### Webhook de Mercado Pago no funciona

1. Verifica que la URL del webhook esté configurada en tu aplicación de Mercado Pago
2. La URL debe ser: `https://tu-dominio.vercel.app/api/payments/webhook`
3. Asegúrate de que esté configurado para eventos de `payment`
4. Verifica que el endpoint responda con status 200
5. Revisa los logs de webhook en el dashboard de Mercado Pago

### Cálculos de comisiones incorrectos

Si los montos no coinciden, verifica:

1. **Fórmulas de cálculo**:
   - Total a pagar = Precio + (Precio × Comisión Cliente / 100)
   - Payout al socio = Precio - (Precio × Comisión Socio / 100)

2. **Ejemplo para servicio de $10,000**:
   - Comisión cliente 5%: $10,000 + $500 = $10,500 (total a pagar)
   - Comisión socio 20%: $10,000 - $2,000 = $8,000 (payout)

3. **Verificar en base de datos**:
   ```sql
   SELECT
     "servicePrice",
     "clientCommissionRate",
     "partnerCommissionRate",
     "totalAmount",
     "partnerPayout"
   FROM "Booking"
   WHERE "id" = 'tu-booking-id';
   ```

## 📄 Licencia

Este proyecto es privado y confidencial.

## 🤝 Soporte

Para soporte, contacta al equipo de desarrollo.
