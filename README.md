# LoHaggo - Plataforma de Marketplace de Servicios

**Lo necesitas, LoHaggo.** - La forma más simple de encontrar cualquier servicio. Una plataforma moderna y segura para solicitar servicios con dashboards para clientes, socios y administradores.

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

### Diseño y UX
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive**: Funciona perfectamente en móviles, tablets y escritorio
- **Interfaz Intuitiva**: Navegación clara y simple
- **Retroalimentación Visual**: Estados de carga, confirmaciones y errores claros
- **PWA Ready**: Capacidades de Progressive Web App

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
```

**Importante**: Marcar las 3 opciones (Production, Preview, Development) para cada variable.

### 6. Deploy

```bash
git push origin main
```

Vercel desplegará automáticamente.

## 📱 Application Structure

### Public Pages
- `/` - Home page with categories and popular services
- `/servicios` - Complete service catalog with search and filters
- `/servicios/[slug]` - Service detail with request form and partner list
- `/ciudad/[slug]` - City-specific services and information
- `/login` - Login
- `/register` - New user registration

### Private Dashboards

#### Client (`/dashboard`)
- **My Requests**: View active requests and received proposals
- **My Bookings**: Manage contracted services
- **Favorites**: Quick access to favorite partners
- **Chat**: Communication with partners (integrated modal)
- **Ratings**: Rate completed services
- **Addresses**: Manage saved addresses
- **Payment Methods**: Manage saved cards
- **Notifications**: View all notifications

#### Partner (`/partner`)
- **Available Requests**: View and respond to client requests
- **My Proposals**: Track sent proposals
- **My Bookings**: Manage contracted services
- **Chat**: Communication with clients (integrated modal)
- **Ratings**: Rate clients
- **Verification**: Upload documents for verification
- **Statistics**: Income, completed services, average rating
- **Notifications**: View all notifications

#### Administrator (`/admin`)
- **Dashboard**: General platform statistics
- **Commissions**: Configure client and partner rates
- **Payments**: View all processed payments
- **Payouts**: Manage payments to partners
- **Users**: Manage clients and partners
- **Services**: Manage service catalog
- **Cities**: Manage available cities
- **Advertisements**: Create and manage ad campaigns with city and service targeting
- **Verification**: Approve/reject partner documents

## 💰 Payment and Commission System

### Payment Flow

1. **Client accepts proposal** → Booking is created with current frozen rates
2. **Client makes payment** → Processed with Mercado Pago
3. **Payment confirmed** → Payout is automatically created for partner
4. **Partner receives payment** → Net amount (after commission) is transferred

### Frozen Commissions

Commission rates are saved when the proposal is accepted:
- **Client**: 5% by default (configurable from `/admin`)
- **Partner**: 20% by default (configurable from `/admin`)

**Important**: Rate changes do NOT affect already contracted services.

## 💬 Chat System

### Features
- **Integrated Modal**: Chat without leaving current page
- **Real-Time**: Polling every 3 seconds for new messages
- **Validation**: Prevention of phone, email, WhatsApp exchange
- **System Messages**: Automatic alerts about restrictions
- **Auto Scroll**: Always shows the latest message
- **Read Marking**: Messages are automatically marked as read

## ⭐ Rating System

### Features
- **Bidirectional**: Client rates partner and vice versa
- **Stars**: 1 to 5 star system
- **Comments**: Optional detailed feedback
- **Once per service**: Can only rate after completing the service
- **Visible Average**: Average rating visible on profiles

## 🔔 Notification System

### Notification Types

#### For Clients
- New proposal received
- Proposal accepted
- Payment processed successfully
- Service completed
- Partner rated you

#### For Partners
- New request available
- Proposal accepted by client
- Payment received
- New payout available
- Client rated you

## 🏙️ City System

### Features
- **Multi-City Support**: Services available in multiple cities
- **Geolocation**: Automatic city detection based on user location
- **City Pages**: Dedicated pages for each city with local services
- **City Filtering**: Filter services and partners by city
- **City Management**: Admin panel for managing available cities

## ⭐ Favorite Partners

### Features
- **Save Favorites**: Mark partners as favorites for quick access
- **Favorites Dashboard**: Dedicated tab in client dashboard
- **Quick Requests**: Request services directly from favorite partners
- **Partner Details**: View partner services and verification status
- **Easy Management**: Add/remove favorites with one click

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

## 🔒 Mejores Prácticas de Seguridad

- Nunca hacer commit de archivos `.env`
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
