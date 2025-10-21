# 🏗️ Arquitectura del Proyecto

## Estructura de Directorios

```
servicios-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Backend)
│   │   ├── auth/                 # Autenticación (NextAuth)
│   │   ├── bookings/             # Gestión de reservas
│   │   ├── categories/           # Categorías de servicios
│   │   ├── register/             # Registro de usuarios
│   │   └── services/             # Servicios disponibles
│   ├── admin/                    # Panel administrativo
│   ├── dashboard/                # Panel de cliente
│   ├── login/                    # Página de login
│   ├── partner/                  # Panel de socio
│   ├── register/                 # Página de registro
│   ├── servicios/                # Catálogo de servicios
│   ├── globals.css               # Estilos globales
│   ├── layout.tsx                # Layout principal
│   ├── page.tsx                  # Página de inicio
│   └── providers.tsx             # Providers (Session)
├── components/                   # Componentes reutilizables
│   └── Navbar.tsx                # Barra de navegación
├── lib/                          # Utilidades y configuración
│   ├── auth.ts                   # Utilidades de autenticación
│   ├── data.ts                   # Datos de servicios
│   └── prisma.ts                 # Cliente de Prisma
├── prisma/                       # Configuración de base de datos
│   ├── schema.prisma             # Esquema de la base de datos
│   └── seed.js                   # Script de población inicial
├── types/                        # Tipos de TypeScript
│   └── next-auth.d.ts            # Tipos de NextAuth
├── .env                          # Variables de entorno
├── .env.example                  # Ejemplo de variables de entorno
├── .gitignore                    # Archivos ignorados por Git
├── next.config.js                # Configuración de Next.js
├── package.json                  # Dependencias del proyecto
├── postcss.config.js             # Configuración de PostCSS
├── tailwind.config.js            # Configuración de Tailwind
├── tsconfig.json                 # Configuración de TypeScript
├── README.md                     # Documentación principal
├── QUICKSTART.md                 # Guía de inicio rápido
└── setup.sh                      # Script de instalación
```

## Flujo de Datos

### 1. Autenticación
```
Usuario → /login → API /api/auth/[...nextauth] → NextAuth → Prisma → PostgreSQL
```

### 2. Navegación de Servicios
```
Usuario → /servicios → API /api/services → Prisma → PostgreSQL → Renderizado
```

### 3. Creación de Reserva
```
Cliente → /servicios/[slug] → Formulario → API /api/bookings (POST) → Prisma → PostgreSQL
```

### 4. Gestión de Reservas (Socio)
```
Socio → /partner → API /api/bookings (GET) → Prisma → PostgreSQL
Socio → Actualizar estado → API /api/bookings/[id] (PATCH) → Prisma → PostgreSQL
```

## Modelos de Base de Datos

### User
- Almacena información de todos los usuarios
- Roles: CLIENT, PARTNER, ADMIN
- Relaciones: bookings (como cliente), partnerProfile

### PartnerProfile
- Información extendida para socios
- Relaciones: user, services, availability

### Category
- Categorías de servicios (Hogar, Limpieza, etc.)
- Relaciones: services

### Service
- Servicios disponibles (50 en total)
- Relaciones: category, partners, bookings

### PartnerService
- Tabla de relación entre socios y servicios
- Define qué servicios ofrece cada socio

### Availability
- Disponibilidad de socios por día de la semana

### Booking
- Reservas de servicios
- Estados: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
- Relaciones: user, service, partner

## Rutas de API

### Públicas
- `POST /api/register` - Registro de usuarios
- `POST /api/auth/signin` - Inicio de sesión

### Autenticadas
- `GET /api/services` - Listar servicios
- `GET /api/services/[slug]` - Detalle de servicio
- `GET /api/categories` - Listar categorías
- `GET /api/bookings` - Listar reservas del usuario
- `POST /api/bookings` - Crear reserva
- `PATCH /api/bookings/[id]` - Actualizar reserva
- `DELETE /api/bookings/[id]` - Cancelar reserva

## Componentes Principales

### Navbar
- Navegación principal
- Muestra diferentes opciones según el rol del usuario
- Responsive (móvil y desktop)

### Páginas Públicas
- **/** - Landing page con categorías y servicios populares
- **/servicios** - Catálogo completo con búsqueda y filtros
- **/servicios/[slug]** - Detalle de servicio con modal de reserva

### Paneles Privados
- **/dashboard** - Panel de cliente con estadísticas y reservas
- **/partner** - Panel de socio con gestión de reservas
- **/admin** - Panel administrativo con estadísticas globales

## Tecnologías y Librerías

### Frontend
- **Next.js 14** - Framework React con App Router
- **React 18** - Librería de UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework de estilos
- **Lucide React** - Iconos

### Backend
- **Next.js API Routes** - Backend integrado
- **Prisma** - ORM para base de datos
- **PostgreSQL** - Base de datos relacional
- **NextAuth.js** - Autenticación
- **bcryptjs** - Hash de contraseñas

### Utilidades
- **date-fns** - Manejo de fechas
- **zod** - Validación de datos

## Patrones de Diseño

### 1. Server Components (por defecto)
- Renderizado en el servidor
- Mejor SEO y performance inicial

### 2. Client Components ('use client')
- Para interactividad (formularios, estados)
- Usado en: login, register, dashboards

### 3. API Routes
- Backend RESTful
- Separación de lógica de negocio

### 4. Middleware de Autenticación
- NextAuth.js maneja sesiones
- Protección de rutas privadas

### 5. Prisma Client Singleton
- Una sola instancia del cliente de Prisma
- Evita múltiples conexiones en desarrollo

## Estados de Reserva

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
   ↓
CANCELLED
```

- **PENDING**: Reserva creada, esperando confirmación del socio
- **CONFIRMED**: Socio confirmó la reserva
- **IN_PROGRESS**: Servicio en ejecución
- **COMPLETED**: Servicio completado
- **CANCELLED**: Reserva cancelada (por cliente o socio)

## Seguridad

### Autenticación
- Contraseñas hasheadas con bcryptjs
- Sesiones manejadas por NextAuth.js
- Tokens JWT para autenticación

### Autorización
- Verificación de roles en API routes
- Redirección según rol del usuario
- Protección de rutas privadas

### Base de Datos
- Validación de datos con Prisma
- Relaciones definidas en el esquema
- Constraints de base de datos

## Performance

### Optimizaciones
- Server Components por defecto
- Lazy loading de componentes
- Imágenes optimizadas con Next.js Image
- CSS optimizado con Tailwind

### Caching
- Next.js cache automático
- Revalidación de datos cuando es necesario

## Escalabilidad

### Horizontal
- Stateless API routes
- Sesiones en base de datos
- Fácil despliegue en múltiples instancias

### Vertical
- PostgreSQL soporta grandes volúmenes
- Índices en campos frecuentemente consultados
- Paginación en listados grandes

## Próximas Mejoras Técnicas

- [ ] Implementar Redis para caching
- [ ] WebSockets para notificaciones en tiempo real
- [ ] Implementar rate limiting
- [ ] Agregar tests (Jest, React Testing Library)
- [ ] Implementar CI/CD
- [ ] Monitoreo con Sentry
- [ ] Analytics con Google Analytics
- [ ] Optimización de imágenes con CDN
