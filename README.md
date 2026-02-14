# LoHaggo - Plataforma de Marketplace de Servicios

**LoHaggo, Lo necesitas.** - La forma más simple de encontrar cualquier servicio. Una plataforma moderna y segura para solicitar servicios con dashboards para clientes, socios y administradores.

## 🚀 Características Principales

### Sistema de Servicios
- **50+ Servicios** organizados en 10 categorías
- **Sistema de Solicitudes**: Los clientes publican solicitudes y los socios envían propuestas
- **Carga de Fotos**: Los clientes pueden adjuntar hasta 5 fotos a sus solicitudes
- **Búsqueda y Filtros**: Buscar por nombre, categoría y ordenar por popularidad/precio
- **Servicios por Ciudad**: Servicios filtrados por ciudad con soporte de geolocalización
- **Solicitudes Directas a Socios**: Solicitar servicios directamente a socios específicos
- **Socios Favoritos**: Guardar socios favoritos para acceso rápido

### Sistema de Publicidad
- **Gestión Dinámica de Anuncios**: Crear y gestionar anuncios desde el panel de administración
- **Dimensiones Estandarizadas**: Todos los anuncios son de 1200x200px (relación 6:1) para consistencia
- **Múltiples Ubicaciones**: HOME (página principal) y SERVICE (páginas de servicios específicos)
- **Segmentación por Ciudad**: Dirigir anuncios a ciudades específicas usando relación CityConfig
- **Anuncios Específicos por Servicio**: Mostrar anuncios en páginas de servicios específicos
- **Sistema de Prioridad**: Controlar el orden de visualización con niveles de prioridad
- **Seguimiento de Rendimiento**: Rastrear impresiones y clics de cada anuncio
- **Editor de Imágenes Integrado**: Recortar, redimensionar, ajustar brillo/contraste y rotar imágenes
- **Control Activo/Inactivo**: Habilitar o deshabilitar anuncios sin eliminarlos
- **Programación de Fechas**: Establecer fechas de inicio y fin para campañas publicitarias
- **Ubicación Estratégica**: Los anuncios HOME aparecen entre "¿Por qué LoHaggo?" y "Servicios más populares"

### Sistema de Usuarios
- **3 Tipos de Usuario**: Clientes, Socios (Proveedores) y Administradores
- **Autenticación Segura** con NextAuth.js y bcrypt
- **Perfiles Completos**: Información detallada para clientes y socios
- **Gestión de Direcciones**: Los clientes pueden guardar múltiples direcciones
- **Verificación de Socios**: Sistema de documentos con validación administrativa
- **Insignias de Verificación**: Insignias de ID, Educación y Antecedentes

### Sistema de Pagos
- **Integración con Mercado Pago**: Procesamiento seguro de pagos
- **Comisiones Congeladas**: Las tarifas se guardan al aceptar el servicio
- **Pagos Automáticos**: Distribución automática de pagos a socios
- **Panel de Administración**: Control completo de comisiones, pagos y desembolsos
- **Métodos de Pago**: Gestión de tarjetas guardadas con Mercado Pago
- **Transacciones Seguras**: Procesamiento de pagos compatible con PCI

### Sistema de Comunicación
- **Chat en Tiempo Real**: Comunicación directa entre clientes y socios
- **Mensajería Modal**: Chat integrado en "Mis Solicitudes" y "Mis Reservas"
- **Validación de Contenido**: Prevención de intercambio de información de contacto
- **Auto Polling**: Actualización de mensajes cada 3 segundos
- **Contadores de No Leídos**: Indicadores visuales para mensajes no leídos

### Sistema de Calificaciones
- **Calificaciones Bidireccionales**: Los clientes califican a los socios y viceversa
- **Sistema de Estrellas**: Calificaciones de 1 a 5 estrellas
- **Comentarios Opcionales**: Retroalimentación detallada sobre el servicio
- **Historial de Calificaciones**: Ver todas las calificaciones recibidas
- **Visualización de Promedio**: Promedio de calificación visible en perfiles

### Sistema de Notificaciones
- **Notificaciones Push**: Alertas instantáneas con Web Push API
- **Validación VAPID**: Claves validadas al inicio con rotación programada
- **Múltiples Tipos**: Nueva propuesta, propuesta aceptada, pago recibido, etc.
- **Insignia de No Leídos**: Contador visual para notificaciones pendientes
- **Historial Completo**: Acceso a todas las notificaciones históricas
- **Auto-limpieza**: Las suscripciones expiradas se eliminan automáticamente

### Seguridad y Validación
- **Manejo Centralizado de Errores**: Sistema robusto con clases de error personalizadas
- **Validación Zod**: Esquemas de validación para todas las entradas críticas
- **Logging Estructurado**: Sistema de logging Pino para monitoreo y depuración
- **Sanitización de Datos**: Limpieza automática de entradas peligrosas
- **Protección de Credenciales**: Gestión segura de claves de Cloudinary y VAPID
- **Rate Limiting**: Protección contra abuso de API
- **Protección CSRF**: Tokens de seguridad en formularios críticos
- **Detección de Amenazas**: Detección de escaneo, inyección en query y user-agents maliciosos
- **Bloqueo de IPs**: Bloqueo/desbloqueo manual y automático con auditoría en DB
- **Panel de Seguridad Admin**: Gestión en `/admin/security` con eventos y estado de bloqueos

### Diseño y UX
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive**: Funciona perfectamente en móviles, tablets y escritorio
- **Interfaz Intuitiva**: Navegación clara y simple
- **Retroalimentación Visual**: Estados de carga, confirmaciones y errores claros
- **PWA Ready**: Capacidades de Progressive Web App
- **Tours Interactivos**: Guías paso a paso para nuevos usuarios (mobile y desktop)
  - **Tour de Inicio**: Introducción a búsqueda, navegación y categorías en la página principal
  - **Tour de Servicios**: Guía de búsqueda, filtros y exploración del catálogo de servicios
  - **Tour de Detalle de Servicio**: Explicación de cómo solicitar servicios y ver profesionales
  - **Botón de Ayuda Flotante**: Botón circular visible en mobile y desktop para reactivar tours
  - **Responsive**: Botones y tooltips adaptados para mobile (bottom-24) y desktop (bottom-6)
  - **Persistencia**: Tours se muestran solo una vez, con opción "No volver a mostrar"
  - **Auto-scroll**: Elementos destacados siempre visibles durante el tour
  - **Multiidioma**: Soporte completo en español e inglés
  - **Accesibilidad**: Etiquetas ARIA y navegación por teclado

## 🛠️ Tecnologías

### Core
- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**

### Base de Datos
- **Prisma** (ORM)
- **PostgreSQL** (Base de datos)
- **Supabase** (Base de datos de producción)

### Autenticación y Seguridad
- **NextAuth.js** (Autenticación)
- **bcrypt** (Hashing de contraseñas)
- **Zod** (Validación de esquemas)
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
- Cuenta de Cloudinary (para carga de fotos)
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
# Base de Datos
DATABASE_URL="postgresql://user:password@localhost:5432/lohaggo_db"

# NextAuth
NEXTAUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (para carga de fotos)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="tu-cloud-name"
CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="tu-access-token"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="tu-public-key"

# Notificaciones Push
# Generar con: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-vapid-public-key"
VAPID_PRIVATE_KEY="tu-vapid-private-key"

# Anti-bot (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="tu-turnstile-site-key"
TURNSTILE_SECRET_KEY="tu-turnstile-secret-key"

# Mensajería omnicanal (Admin)
TWILIO_ACCOUNT_SID="tu-twilio-account-sid"
TWILIO_AUTH_TOKEN="tu-twilio-auth-token"
TWILIO_SMS_FROM="+1xxxxxxxxxx"
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
SENDGRID_API_KEY="tu-sendgrid-api-key"
SENDGRID_FROM_EMAIL="no-reply@lohaggo.com"
```

3. **Configurar la base de datos**

```bash
# Aplicar migraciones
npx prisma migrate deploy

# Sembrar con datos iniciales
npx prisma db seed
```

4. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🚀 Deploy en Producción (Supabase + Vercel)

### 1. Configurar Base de Datos (Supabase)

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Ir a Settings → Database → Connection String
3. Copiar el **Connection String** (modo Transaction)
4. Ejecutar migraciones con Prisma

### 2. Configurar Cloudinary

1. Crear una cuenta en [Cloudinary](https://cloudinary.com)
2. Ir al Dashboard y copiar:
   - Cloud Name
   - API Key
   - API Secret

### 3. Configurar Mercado Pago

1. Crear una cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Ir a Tus integraciones → Crear aplicación
3. Copiar credenciales de producción:
   - Access Token
   - Public Key

### 4. Generar Claves VAPID para Notificaciones Push

```bash
npx web-push generate-vapid-keys
```

Guardar las claves generadas para configurarlas en Vercel.

### 5. Configurar Variables de Entorno en Vercel

Ir a tu proyecto en Vercel → Settings → Environment Variables y agregar:

```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require
NEXTAUTH_SECRET=tu-secreto-super-seguro-aqui
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
MERCADOPAGO_ACCESS_TOKEN=tu-access-token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu-public-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu-vapid-public-key
VAPID_PRIVATE_KEY=tu-vapid-private-key
NEXT_PUBLIC_TURNSTILE_SITE_KEY=tu-turnstile-site-key
TURNSTILE_SECRET_KEY=tu-turnstile-secret-key
SECURITY_INTERNAL_TOKEN=token-interno-largo-y-aleatorio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxx
TWILIO_SMS_FROM=+1xxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=no-reply@lohaggo.com
```

**Importante**: Marcar las 3 opciones (Production, Preview, Development) para cada variable.

### 6. Deploy

```bash
git push origin main
```

Vercel desplegará automáticamente.

### 7. SQL obligatorio para producción (Supabase)

Antes del primer deploy productivo, ejecutar en este orden en SQL Editor de Supabase:

1. `docs/sql/admin_control_plane.sql`
2. `docs/sql/bank_catalog_seed.sql`
3. `docs/sql/security_monitoring.sql`
4. `docs/sql/launch_blockers_ops.sql`
5. `docs/sql/admin_messaging.sql`

### 8. Proveedores recomendados para comunicaciones

- `SMS y WhatsApp`: Twilio Messaging API (rápido de integrar y con webhooks de estado).
- `Email`: SendGrid (tracking de entregas/open/click y buena reputación de envío).
- `Alternativa WhatsApp enterprise`: Meta WhatsApp Cloud API (si luego quieres migrar desde Twilio).

### 9. Configuración de webhooks de mensajería

- Twilio Status Callback URL:
  - `https://tu-dominio.com/api/messaging/webhook/twilio?token=${SECURITY_INTERNAL_TOKEN}`
- SendGrid Event Webhook URL:
  - `https://tu-dominio.com/api/messaging/webhook/sendgrid?token=${SECURITY_INTERNAL_TOKEN}`

Ambos endpoints actualizan métricas de entrega/apertura/click/fallo en campañas admin.

### 10. Envío programado (cron) y A/B testing

- Endpoint cron interno:
  - `POST /api/messaging/cron/run-scheduled?token=${SECURITY_INTERNAL_TOKEN}`
- Recomendación Vercel Cron:
  - cada 5 minutos, llamar ese endpoint
- A/B testing:
  - Crear campaña con `Activar A/B test`
  - Definir variante A/B, contenido y split (%A / %B)
  - Métricas por variante en `Admin > Comunicaciones > Métricas`

### 8. QA de regresión crítica (recomendado antes de cada release)

```bash
node scripts/qa/critical-regression-flow.mjs
```

Genera reporte en `docs/qa/critical-regression-flow.json` para validar login y rutas críticas de cliente, socio y admin en mobile.

Notas:
- El catálogo de bancos se administra desde `/admin/banks`.
- Si agregas nuevos bancos manualmente en DB, usa códigos únicos (`code`) y valida rangos de cuenta.

## 📱 Estructura de la Aplicación

### Páginas Públicas
- `/` - Página principal con categorías y servicios populares
- `/servicios` - Catálogo completo de servicios con búsqueda y filtros
- `/servicios/[slug]` - Detalle de servicio con formulario de solicitud y lista de socios
- `/ciudad/[slug]` - Servicios e información específica de la ciudad
- `/login` - Inicio de sesión
- `/register` - Registro de nuevos usuarios (clientes)
- `/registro-socios` - Registro de socios/proveedores de servicios
- `/about` - Información sobre la plataforma
- `/how-it-works` - Explicación del funcionamiento de la plataforma
- `/faq` - Preguntas frecuentes
- `/contact` - Formulario de contacto
- `/download/android` - Instrucciones para instalar PWA en Android
- `/download/ios` - Instrucciones para instalar PWA en iOS
- `/terms` - Términos y condiciones
- `/privacy` - Política de privacidad
- `/cookies` - Política de cookies

### Dashboards Privados

#### Cliente (`/dashboard`)
- **Mis Solicitudes**: Ver solicitudes activas y propuestas recibidas
- **Mis Reservas**: Gestionar servicios contratados
- **Favoritos**: Acceso rápido a socios favoritos
- **Chat**: Comunicación con socios (modal integrado)
- **Calificaciones**: Calificar servicios completados
- **Direcciones**: Gestionar direcciones guardadas
- **Métodos de Pago**: Gestionar tarjetas guardadas
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
- **Comisiones**: Configurar tarifas de clientes y socios
- **Pagos**: Ver todos los pagos procesados
- **Desembolsos**: Gestionar pagos a socios
- **Usuarios**: Gestionar clientes y socios
- **Servicios**: Gestionar catálogo de servicios
- **Ciudades**: Gestionar ciudades disponibles
- **Publicidad**: Crear y gestionar campañas publicitarias con segmentación por ciudad y servicio
- **Verificación**: Aprobar/rechazar documentos de socios

## 💰 Sistema de Pagos y Comisiones

### Flujo de Pago

1. **Cliente acepta propuesta** → Se crea Reserva con tarifas congeladas actuales
2. **Cliente realiza pago** → Procesado con Mercado Pago
3. **Pago confirmado** → Se crea automáticamente Payout para el socio
4. **Socio recibe pago** → Monto neto (después de comisión) es transferido

### Comisiones Congeladas

Las tarifas de comisión se guardan cuando se acepta la propuesta:
- **Cliente**: 5% por defecto (configurable desde `/admin`)
- **Socio**: 20% por defecto (configurable desde `/admin`)

**Importante**: Los cambios de tarifas NO afectan servicios ya contratados.

## 💬 Sistema de Chat

### Características
- **Modal Integrado**: Chat sin salir de la página actual
- **Tiempo Real**: Polling cada 3 segundos para nuevos mensajes
- **Validación**: Prevención de intercambio de teléfono, email, WhatsApp
- **Mensajes del Sistema**: Alertas automáticas sobre restricciones
- **Auto Scroll**: Siempre muestra el último mensaje
- **Marcado de Lectura**: Los mensajes se marcan automáticamente como leídos

## ⭐ Sistema de Calificaciones

### Características
- **Bidireccional**: Cliente califica al socio y viceversa
- **Estrellas**: Sistema de 1 a 5 estrellas
- **Comentarios**: Retroalimentación detallada opcional
- **Una vez por servicio**: Solo se puede calificar después de completar el servicio
- **Promedio Visible**: Calificación promedio visible en perfiles

## 🔔 Sistema de Notificaciones

### Tipos de Notificaciones

#### Para Clientes
- Nueva propuesta recibida
- Propuesta aceptada
- Pago procesado exitosamente
- Servicio completado
- Socio te calificó

#### Para Socios
- Nueva solicitud disponible
- Propuesta aceptada por cliente
- Pago recibido
- Nuevo desembolso disponible
- Cliente te calificó

## 🏙️ Sistema de Ciudades

### Características
- **Soporte Multi-Ciudad**: Servicios disponibles en múltiples ciudades
- **Geolocalización**: Detección automática de ciudad basada en ubicación del usuario
- **Páginas de Ciudad**: Páginas dedicadas para cada ciudad con servicios locales
- **Filtrado por Ciudad**: Filtrar servicios y socios por ciudad
- **Gestión de Ciudades**: Panel de administración para gestionar ciudades disponibles

## ⭐ Socios Favoritos

### Características
- **Guardar Favoritos**: Marcar socios como favoritos para acceso rápido
- **Dashboard de Favoritos**: Pestaña dedicada en dashboard de cliente
- **Solicitudes Rápidas**: Solicitar servicios directamente desde socios favoritos
- **Detalles del Socio**: Ver servicios del socio y estado de verificación
- **Gestión Fácil**: Agregar/eliminar favoritos con un clic

## 📢 Sistema de Publicidad

### Características
- **Panel de Gestión de Anuncios**: Interfaz CRUD completa en `/admin/ads`
- **Dimensiones Estandarizadas de Banners**:
  - Todos los banners: **1200x200px (relación 6:1)** - OBLIGATORIO
  - Tamaño consistente para ubicaciones HOME y SERVICE
  - Optimizado para visualización responsive en todos los dispositivos
- **Múltiples Ubicaciones**:
  - **HOME**: Mostrar en página principal entre "¿Por qué LoHaggo?" y "Servicios más populares"
  - **SERVICE**: Mostrar en páginas de detalle de servicios específicos
- **Segmentación por Ciudad**: Dirigir anuncios a ciudades específicas usando relación dinámica CityConfig
- **Anuncios Específicos por Servicio**: Asociar anuncios con servicios específicos para visualización dirigida
- **Sistema de Prioridad**: Controlar orden de visualización con prioridad numérica (mayor = se muestra primero)
- **Seguimiento de Rendimiento**:
  - Impresiones: Rastrear cuántas veces se muestra el anuncio
  - Clics: Rastrear interacciones de usuarios con anuncios
- **Editor de Imágenes Integrado**:
  - Recortar y redimensionar imágenes a dimensiones exactas de 1200x200px
  - Ajustar brillo (50-150%)
  - Ajustar contraste (50-150%)
  - Rotar imágenes en incrementos de 90°
  - Vista previa en tiempo real con filtros
  - Carga directa a Cloudinary
- **Programación de Campañas**:
  - Establecer fechas de inicio para campañas
  - Fechas de fin opcionales para promociones por tiempo limitado
- **Toggle Activo/Inactivo**: Habilitar o deshabilitar anuncios sin eliminarlos
- **Visualización Responsive**:
  - Móvil: 128px de altura (h-32)
  - Tablet: 160px de altura (h-40)
  - Escritorio: 192px de altura (h-48)
  - Mantiene relación 6:1 en todos los breakpoints
- **Carga Dinámica**: Los anuncios se obtienen según la ciudad actual y contexto de página
- **Persistencia de Sesión**: Los anuncios cerrados permanecen ocultos durante la sesión

### Lógica de Visualización de Anuncios
- **Página Principal**:
  - Muestra todos los anuncios activos de ubicación HOME para la ciudad seleccionada
  - Posicionado entre características de "¿Por qué LoHaggo?" y "Servicios más populares"
  - Sección con fondo blanco para integración limpia
- **Páginas de Servicios**:
  - Muestra anuncios de ubicación SERVICE asociados con ese servicio específico y ciudad
  - Mostrado antes de la sección del botón de reserva
- **Filtrado por Ciudad**: Solo muestra anuncios dirigidos a la ciudad actualmente seleccionada del usuario
- **Ordenamiento por Prioridad**: Los anuncios se muestran en orden de prioridad (descendente) luego por fecha de creación
- **Carrusel**: Múltiples anuncios rotan automáticamente con controles de navegación
- **Botón de Cerrar**: Los usuarios pueden descartar anuncios (ocultos durante la sesión)

### Características del Panel de Administración
- **Vista Previa de Imagen**:
  - Vista previa del formulario: 128px de altura con relación 6:1
  - Vista previa de lista: 320px de ancho × 128px de altura
  - Información de dimensiones mostrada: "1200x200px (Relación 6:1)"
- **Selector de Ciudad**: Dropdown dinámico solo con ciudades activas
- **Selector de Servicio**: Visualización condicional basada en tipo de ubicación
- **Métricas de Rendimiento**: Ver impresiones y clics para cada anuncio
- **Acciones Rápidas**: Toggle activo/inactivo, editar, eliminar
- **Indicadores de Estado Visual**: Insignias codificadas por color para ubicación, ciudad, servicio y estado

### Esquema de Base de Datos
```prisma
model Advertisement {
  id          String      @id @default(cuid())
  title       String
  imageUrl    String      // Imágenes de 1200x200px almacenadas en Cloudinary
  linkUrl     String?
  placement   AdPlacement // HOME o SERVICE
  serviceId   String?     // Para ubicación SERVICE
  cityId      String      // Relación a CityConfig (requerido)
  active      Boolean
  startDate   DateTime
  endDate     DateTime?
  priority    Int
  impressions Int
  clicks      Int
  service     Service?    @relation(fields: [serviceId], references: [id])
  city        CityConfig  @relation(fields: [cityId], references: [id])
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

enum AdPlacement {
  HOME
  SERVICE
}
```

### Implementación Técnica
- **Componente**: `components/ads/AdBanner.tsx`
- **Editor de Imágenes**: `components/ads/ImageEditor.tsx` con react-image-crop
- **Rutas API**:
  - `GET /api/ads` - Obtener anuncios por ciudad y ubicación
  - `POST /api/ads` - Crear nuevo anuncio
  - `PATCH /api/ads/[id]` - Actualizar anuncio
  - `DELETE /api/ads/[id]` - Eliminar anuncio
  - `POST /api/ads/track` - Rastrear impresiones y clics
- **Almacenamiento de Imágenes**: Cloudinary con optimización automática
- **Clases Responsive**: Tailwind CSS con h-full para escalado apropiado

## 📱 Progressive Web App (PWA)

### Características
- **Instalable**: Los usuarios pueden instalar la aplicación en sus dispositivos móviles y escritorio
- **Service Worker**: Funcionalidad offline y actualizaciones automáticas
- **Manifest.json**: Configuración completa con iconos, colores y atajos
- **Atajos de Aplicación**:
  - Acceso rápido a Servicios
  - Acceso rápido a Perfil
- **Prompt de Instalación**: Banner inteligente que sugiere instalar la PWA
- **Actualizaciones Automáticas**: Notificación cuando hay nueva versión disponible
- **Páginas de Descarga**:
  - `/download/android` - Guía paso a paso para Android
  - `/download/ios` - Guía paso a paso para iOS (Safari)
- **Iconos Adaptativos**: Múltiples tamaños (192x192, 512x512) para diferentes dispositivos
- **Splash Screens**: Pantallas de carga personalizadas
- **Modo Standalone**: Experiencia de aplicación nativa sin barra del navegador

### Implementación Técnica
- **Service Worker**: `/public/sw.js` con estrategias de caché
- **Manifest**: `/public/manifest.json` con configuración completa
- **Componentes**:
  - `PWARegister.tsx` - Registro automático del service worker
  - `PWAInstallPrompt.tsx` - Banner de instalación inteligente
- **Hooks**: `usePushNotifications.ts` integrado con service worker
- **Script de Verificación**: `npm run check-pwa` para validar configuración

### Capacitor (Aplicaciones Nativas)
- **Android**: Configuración completa en `/android`
- **iOS**: Configuración completa en `/ios`
- **Build Nativo**: Posibilidad de generar APK/IPA para tiendas de aplicaciones
- **Plugins Nativos**: Acceso a funcionalidades nativas del dispositivo

## 🎓 Sistema de Tours Interactivos

### Características
- **3 Tours Disponibles**:
  - **OnboardingTour**: Tour de bienvenida en la página principal
  - **ServicesTour**: Tour del catálogo de servicios
  - **ServiceDetailTour**: Tour de la página de detalle de servicio
- **Responsive**: Funciona perfectamente en mobile y desktop
- **Botón Flotante**: Botón de ayuda circular siempre visible
  - Mobile: Posición `bottom-24 right-4` (sobre navegación inferior)
  - Desktop: Posición `bottom-6 right-4`
  - Tamaño adaptativo: 48px (mobile) / 56px (desktop)
- **Tooltip con Hover**: Texto explicativo al pasar el mouse
- **Multiidioma**: Soporte completo en español e inglés
- **Persistencia Inteligente**:
  - Tours se muestran automáticamente la primera vez
  - Opción "No volver a mostrar" para usuarios experimentados
  - Almacenamiento en localStorage por tour
- **Navegación**:
  - Botones Anterior/Siguiente
  - Indicadores de progreso (puntos)
  - Contador de pasos (ej: "2 de 5")
  - Botón de cerrar (X)
- **Destacado Visual**:
  - Overlay oscuro (bg-black/70)
  - Borde de resaltado en elemento objetivo
  - Auto-scroll para mantener elemento visible
  - Animaciones suaves (fadeIn)
- **Accesibilidad**:
  - Etiquetas ARIA completas
  - Navegación por teclado
  - Contraste adecuado

### Implementación Técnica
- **Componentes**:
  - `components/OnboardingTour.tsx`
  - `components/ServicesTour.tsx`
  - `components/ServiceDetailTour.tsx`
- **Atributos data-tour**: Elementos marcados con `data-tour="nombre"` para targeting
- **Iconos**: Lucide React (HelpCircle, ChevronRight, ChevronLeft, X)
- **Estilos**: Tailwind CSS con clases responsive
- **Estado**: React hooks (useState, useEffect) para gestión de estado

## 🔒 Mejores Prácticas de Seguridad

- Nunca hacer commit de archivos `.env`
- Mantener solo archivos de ejemplo versionados (`.env.example`, `.env.production.example`)
- Ejecutar `npm run pre-deploy` antes de cada `git push` a `main`
- Verificar que no existan `console.log/info/debug/warn` en runtime antes de release
- Rotar credenciales regularmente
- Usar contraseñas fuertes para producción
- Habilitar 2FA en todas las cuentas de servicio
- Monitorear logs para actividad sospechosa
- Mantener dependencias actualizadas
- Usar HTTPS en producción

## 📝 Licencia

Este proyecto es privado y propietario.

## 🤝 Contribuir

Este es un proyecto privado. Contactar al propietario del repositorio para pautas de contribución.
