# LoHaggo - Plataforma de Servicios

**Servicios a tu alcance** - Una plataforma moderna y segura para solicitar servicios (plomería, limpieza, electricidad, etc.) con paneles para clientes, socios y administradores.

## 🚀 Características Principales

### Sistema de Servicios
- **50+ Servicios** organizados en 10 categorías
- **Sistema de Solicitudes**: Los clientes publican solicitudes y los socios envían propuestas
- **Subida de Fotos**: Los clientes pueden adjuntar hasta 5 fotos a sus solicitudes
- **Búsqueda y Filtros**: Búsqueda por nombre, categoría y ordenamiento por popularidad/precio

### Sistema de Usuarios
- **3 Tipos de Usuarios**: Clientes, Socios (Proveedores) y Administradores
- **Autenticación Segura** con NextAuth.js y bcrypt
- **Perfiles Completos**: Información detallada de clientes y socios
- **Gestión de Direcciones**: Los clientes pueden guardar múltiples direcciones
- **Verificación de Socios**: Sistema de documentos con validación administrativa

### Sistema de Pagos
- **Integración con Mercado Pago**: Procesamiento seguro de pagos
- **Comisiones Congeladas**: Las tarifas se guardan al momento de aceptar el servicio
- **Payouts Automáticos**: Distribución automática de pagos a socios
- **Panel de Administración**: Control completo de comisiones, pagos y payouts
- **Métodos de Pago**: Gestión de tarjetas guardadas con Mercado Pago

### Sistema de Comunicación
- **Chat en Tiempo Real**: Comunicación directa entre clientes y socios
- **Mensajería Modal**: Chat integrado en "Mis Solicitudes" y "Mis Reservas"
- **Validación de Contenido**: Prevención de intercambio de información de contacto
- **Polling Automático**: Actualización de mensajes cada 3 segundos

### Sistema de Calificaciones
- **Calificaciones Bidireccionales**: Clientes califican a socios y viceversa
- **Sistema de Estrellas**: Calificación de 1 a 5 estrellas
- **Comentarios Opcionales**: Feedback detallado sobre el servicio
- **Historial de Calificaciones**: Visualización de todas las calificaciones recibidas

### Sistema de Notificaciones
- **Notificaciones Push**: Alertas instantáneas con Web Push API
- **Validación VAPID**: Claves validadas en startup con rotación programada
- **Múltiples Tipos**: Nueva propuesta, propuesta aceptada, pago recibido, etc.
- **Badge de No Leídas**: Contador visual de notificaciones pendientes
- **Historial Completo**: Acceso a todas las notificaciones históricas
- **Auto-limpieza**: Suscripciones expiradas se eliminan automáticamente

### Seguridad y Validación
- **Manejo Centralizado de Errores**: Sistema robusto con clases de error personalizadas
- **Validación con Zod**: Schemas de validación para todos los inputs críticos
- **Logging Estructurado**: Sistema de logs con Pino para monitoreo y debugging
- **Sanitización de Datos**: Limpieza automática de inputs peligrosos
- **Protección de Credenciales**: Cloudinary y VAPID keys con gestión segura
- **Rate Limiting**: Protección contra abuso de APIs
- **CSRF Protection**: Tokens de seguridad en formularios críticos

### Diseño y UX
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive**: Funciona perfectamente en móviles, tablets y desktop
- **Interfaz Intuitiva**: Navegación clara y sencilla
- **Feedback Visual**: Estados de carga, confirmaciones y errores claros

## 🛠️ Tecnologías

### Core
- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**

### Base de Datos
- **Prisma** (ORM)
- **PostgreSQL** (Base de datos)
- **Supabase** (Base de datos en producción)

### Autenticación y Seguridad
- **NextAuth.js** (Autenticación)
- **bcrypt** (Hash de contraseñas)
- **Zod** (Validación de schemas)
- **Pino** (Logging estructurado)

### Pagos y Servicios Externos
- **Mercado Pago** (Procesamiento de pagos)
- **Cloudinary** (Almacenamiento de imágenes)
- **Web Push API** (Notificaciones push)

### UI/UX
- **Tailwind CSS** (Estilos)
- **Lucide React** (Iconos)
- **Radix UI** (Componentes accesibles)

## 📋 Requisitos Previos

- Node.js 18+ instalado
- PostgreSQL instalado (para desarrollo local) o cuenta de Supabase
- Cuenta de Cloudinary (para subida de fotos)
- Cuenta de Mercado Pago (para procesamiento de pagos)
- npm o yarn

## 🔧 Instalación Local

1. **Clonar el repositorio**

```bash
git clone <tu-repositorio>
cd lohaggo
npm install
```

2. **Configurar variables de entorno**

Crear un archivo `.env.local` en la raíz del proyecto:

```env
# Base de datos
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/lohaggo_db"

# NextAuth
NEXTAUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (para subida de fotos)
# IMPORTANTE: Rotar credenciales cada 90 días
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="tu-cloud-name"
CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"
CLOUDINARY_LAST_ROTATION="2024-01-01"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="tu-access-token"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="tu-public-key"

# Push Notifications
# Generar con: npx web-push generate-vapid-keys
# IMPORTANTE: Rotar cada 90 días
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-vapid-public-key"
VAPID_PRIVATE_KEY="tu-vapid-private-key"
```

3. **Configurar la base de datos**

```bash
# Aplicar migraciones
npx prisma migrate deploy

# Poblar con datos iniciales
npx prisma db seed
```

4. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🚀 Deploy en Producción (Supabase + Vercel)

### 1. Configurar Base de Datos (Supabase)

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a Settings → Database → Connection String
3. Copia la **Connection String** (modo Transaction)
4. Ejecuta las migraciones con Prisma

### 2. Configurar Cloudinary

1. Crea una cuenta en [Cloudinary](https://cloudinary.com)
2. Ve a Dashboard y copia:
   - Cloud Name
   - API Key
   - API Secret
3. **IMPORTANTE**: Configura rotación de credenciales cada 90 días

### 3. Configurar Mercado Pago

1. Crea una cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Ve a Tus integraciones → Crear aplicación
3. Copia las credenciales de producción:
   - Access Token
   - Public Key

### 4. Generar VAPID Keys para Push Notifications

```bash
npx web-push generate-vapid-keys
```

Guarda las claves generadas para configurarlas en Vercel.

### 5. Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require
NEXTAUTH_SECRET=tu-secreto-super-seguro-aqui
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
CLOUDINARY_LAST_ROTATION=2024-01-01
MERCADOPAGO_ACCESS_TOKEN=tu-access-token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu-public-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu-vapid-public-key
VAPID_PRIVATE_KEY=tu-vapid-private-key
```

**Importante**: Marca las 3 opciones (Production, Preview, Development) para cada variable.

### 6. Deploy

```bash
git push origin main
```

Vercel hará el deploy automáticamente.

## 👥 Usuarios de Prueba

Después de ejecutar el seed, puedes usar estos usuarios:

### Cliente
- **Email**: cliente@test.com
- **Contraseña**: password123

### Socio/Proveedor
- **Email**: partner@test.com
- **Contraseña**: password123

### Administrador
- **Email**: admin@test.com
- **Contraseña**: password123

## 📱 Estructura de la Aplicación

### Páginas Públicas
- `/` - Página principal con categorías y servicios populares
- `/servicios` - Catálogo completo de servicios con búsqueda y filtros
- `/servicios/[slug]` - Detalle de servicio con formulario de solicitud
- `/login` - Inicio de sesión
- `/register` - Registro de nuevos usuarios

### Paneles Privados

#### Cliente (`/dashboard`)
- **Mis Solicitudes**: Ver solicitudes activas y propuestas recibidas
- **Mis Reservas**: Gestionar servicios contratados
- **Chat**: Comunicación con socios (modal integrado)
- **Calificaciones**: Calificar servicios completados
- **Direcciones**: Gestión de direcciones guardadas
- **Métodos de Pago**: Gestión de tarjetas guardadas
- **Notificaciones**: Ver todas las notificaciones

#### Socio (`/partner`)
- **Solicitudes Disponibles**: Ver y responder a solicitudes de clientes
- **Mis Propuestas**: Seguimiento de propuestas enviadas
- **Mis Reservas**: Gestionar servicios contratados
- **Chat**: Comunicación con clientes (modal integrado)
- **Calificaciones**: Calificar clientes
- **Verificación**: Subir documentos para verificación
- **Estadísticas**: Ingresos, servicios completados, calificación promedio
- **Notificaciones**: Ver todas las notificaciones

#### Administrador (`/admin`)
- **Dashboard**: Estadísticas generales de la plataforma
- **Comisiones**: Configurar tarifas de cliente y socio
- **Pagos**: Ver todos los pagos procesados
- **Payouts**: Gestionar pagos a socios
- **Usuarios**: Administrar clientes y socios
- **Servicios**: Gestionar catálogo de servicios
- **Verificación**: Aprobar/rechazar documentos de socios

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

## 💬 Sistema de Chat

### Características
- **Modal Integrado**: Chat sin salir de la página actual
- **Tiempo Real**: Polling cada 3 segundos para nuevos mensajes
- **Validación**: Prevención de intercambio de teléfonos, emails, WhatsApp
- **Mensajes del Sistema**: Alertas automáticas sobre restricciones
- **Scroll Automático**: Siempre muestra el último mensaje
- **Marcado de Leídos**: Los mensajes se marcan como leídos automáticamente

### Ubicación
- **Mis Solicitudes**: Chat disponible cuando hay propuesta aceptada
- **Mis Reservas**: Chat disponible en todas las reservas activas

## ⭐ Sistema de Calificaciones

### Características
- **Bidireccional**: Cliente califica a socio y viceversa
- **Estrellas**: Sistema de 1 a 5 estrellas
- **Comentarios**: Feedback opcional detallado
- **Una vez por servicio**: Solo se puede calificar después de completar el servicio
- **Promedio visible**: Calificación promedio visible en perfiles

### Flujo
1. Servicio se marca como **COMPLETED**
2. Aparece botón "Calificar" en la reserva
3. Usuario completa calificación (estrellas + comentario opcional)
4. Calificación se guarda y promedio se actualiza

## 🔔 Sistema de Notificaciones

### Tipos de Notificaciones

#### Para Clientes
- Nueva propuesta recibida
- Propuesta aceptada
- Pago procesado exitosamente
- Servicio completado
- Socio te ha calificado

#### Para Socios
- Nueva solicitud disponible
- Propuesta aceptada por cliente
- Pago recibido
- Nuevo payout disponible
- Cliente te ha calificado

### Características
- **Push Notifications**: Notificaciones del navegador con Web Push API
- **VAPID Keys**: Validación automática en startup
- **Badge de contador**: Muestra cantidad de notificaciones no leídas
- **Marca como leída**: Click en notificación la marca como leída
- **Historial completo**: Acceso a todas las notificaciones
- **Tiempo relativo**: "Hace 5 minutos", "Hace 2 horas", etc.
- **Auto-limpieza**: Suscripciones expiradas (410/404) se eliminan automáticamente

## 🔒 Seguridad

### Manejo de Errores
- **Clases de Error Personalizadas**: `AppError`, `ValidationError`, `AuthenticationError`, etc.
- **Handler Centralizado**: `handleApiError` para respuestas consistentes
- **Logging Estructurado**: Pino logger con niveles de severidad
- **Ocultamiento de Stack Traces**: En producción no se exponen detalles internos

### Validación de Datos
- **Zod Schemas**: Validación de todos los inputs críticos
- **Sanitización**: Limpieza automática de datos peligrosos
- **Type Safety**: TypeScript en todo el proyecto
- **Push Subscriptions**: Validación de formato y claves requeridas

### Gestión de Credenciales
- **Cloudinary Service**: Centralizado con recordatorios de rotación
- **VAPID Keys**: Validación de formato (87 chars base64url)
- **Rotación Programada**: Alertas cada 90 días
- **Environment Variables**: Nunca expuestas al cliente (excepto públicas)

### Protección de APIs
- **Autenticación**: NextAuth.js con sesiones seguras
- **Autorización**: Verificación de roles en cada endpoint
- **Rate Limiting**: Protección contra abuso
- **CSRF Tokens**: En formularios críticos

## 🎨 Categorías de Servicios

1. **Hogar** - Plomería, Electricidad, Carpintería, Pintura, Jardinería
2. **Limpieza** - Limpieza de hogar, oficinas, alfombras, cristales, post-construcción
3. **Reparaciones** - Electrodomésticos, cerrajería, aires acondicionados, techos
4. **Belleza** - Peluquería, Manicure, Pedicure, Masajes, Maquillaje
5. **Salud** - Enfermería, Fisioterapia, Nutrición, Cuidado de ancianos
6. **Tecnología** - Reparación de computadoras, instalación de software, redes
7. **Transporte** - Mudanzas, mensajería, transporte de mascotas, fletes
8. **Educación** - Clases particulares, tutorías, idiomas, música
9. **Eventos** - Fotografía, catering, decoración, animación, DJ
10. **Mascotas** - Veterinaria, peluquería, paseos, adiestramiento, guardería

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

# Seguridad
npx web-push generate-vapid-keys  # Generar claves VAPID para push notifications

# Linting y formato
npm run lint             # Ejecutar linter
```

## 🐛 Troubleshooting

### Error de conexión a base de datos

Si ves el error `Can't reach database server`:

1. Verifica que tu base de datos esté activa
2. Asegúrate de usar `?sslmode=require` al final de la URL (Supabase)
3. Verifica que todas las variables de entorno estén configuradas
4. Ejecuta las migraciones con Prisma

### Fotos no se suben

1. Verifica que las credenciales de Cloudinary estén correctas
2. Asegúrate de que las variables de entorno estén configuradas
3. Revisa los logs para más detalles
4. Verifica que no hayan expirado las credenciales (rotar cada 90 días)

### Push Notifications no funcionan

1. Verifica que las VAPID keys estén configuradas correctamente
2. Genera nuevas claves con `npx web-push generate-vapid-keys`
3. Asegúrate de que el navegador soporte Web Push API
4. Revisa los logs de startup para errores de validación VAPID

### Errores de TypeScript

1. Ejecuta `npx prisma generate` para regenerar el cliente
2. Reinicia el servidor de desarrollo
3. Verifica que todas las dependencias estén instaladas

## 📝 Mantenimiento

### Rotación de Credenciales

**Cada 90 días debes rotar:**

1. **Cloudinary Credentials**
   - Genera nuevas API keys en Cloudinary Dashboard
   - Actualiza variables de entorno
   - Actualiza `CLOUDINARY_LAST_ROTATION`

2. **VAPID Keys**
   - Genera nuevas con `npx web-push generate-vapid-keys`
   - Actualiza variables de entorno
   - Los usuarios deberán re-suscribirse automáticamente

### Monitoreo

**Métricas clave a monitorear:**
- Tasa de éxito de pagos
- Tasa de éxito de push notifications
- Errores en logs (nivel error/warn)
- Suscripciones push expiradas
- Tiempo de respuesta de APIs

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👨‍💻 Soporte

Para soporte técnico o consultas, contacta al equipo de desarrollo.
