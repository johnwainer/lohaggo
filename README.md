# Plataforma de Servicios - ServiciosApp

Una plataforma moderna para solicitar servicios (plomería, limpieza, electricidad, etc.) con paneles para clientes, socios y administradores.

## 🚀 Características

- **50+ Servicios** organizados en 10 categorías
- **3 Tipos de Usuarios**: Clientes, Socios (Proveedores) y Administradores
- **Sistema de Reservas** completo con gestión de estados
- **Autenticación** con NextAuth.js
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive** - Funciona en móviles, tablets y desktop

## 🛠️ Tecnologías

- **Next.js 14** (App Router)
- **TypeScript**
- **Prisma** (ORM)
- **PostgreSQL** (Base de datos)
- **NextAuth.js** (Autenticación)
- **Tailwind CSS** (Estilos)

## 📋 Requisitos Previos

- Node.js 18+ instalado
- PostgreSQL instalado y corriendo
- npm o yarn

## 🔧 Instalación

1. **Clonar el repositorio** (o crear el proyecto)

```bash
npm install
```

2. **Configurar variables de entorno**

Crear un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/servicios_db"
NEXTAUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

3. **Configurar la base de datos**

```bash
# Crear la base de datos y tablas
npx prisma db push

# Poblar con datos iniciales (50 servicios, usuarios de prueba, etc.)
npx prisma db seed
```

4. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 👥 Usuarios de Prueba

Después de ejecutar el seed, puedes usar estos usuarios:

### Cliente
- **Email**: cliente@test.com
- **Contraseña**: password123

### Socio/Proveedor
- **Email**: socio1@test.com
- **Contraseña**: password123

### Administrador
- **Email**: admin@servicios.com
- **Contraseña**: password123

## 📱 Estructura de la Aplicación

### Páginas Públicas
- `/` - Página principal con categorías y servicios populares
- `/servicios` - Catálogo completo de servicios con búsqueda y filtros
- `/servicios/[slug]` - Detalle de servicio con formulario de reserva
- `/login` - Inicio de sesión
- `/register` - Registro de nuevos usuarios

### Paneles Privados
- `/dashboard` - Panel de cliente (ver y gestionar reservas)
- `/partner` - Panel de socio (gestionar servicios y reservas de clientes)
- `/admin` - Panel administrativo (estadísticas y gestión completa)

## 🎨 Categorías de Servicios

1. **Hogar** - Plomería, Electricidad, Carpintería, etc.
2. **Limpieza** - Limpieza de hogar, oficinas, alfombras, etc.
3. **Belleza** - Peluquería, Manicure, Masajes, etc.
4. **Tecnología** - Reparación de computadoras, instalación de software, etc.
5. **Transporte** - Mudanzas, mensajería, transporte de mascotas, etc.
6. **Educación** - Clases particulares, tutorías, idiomas, etc.
7. **Salud** - Enfermería, fisioterapia, nutrición, etc.
8. **Eventos** - Fotografía, catering, decoración, etc.
9. **Mascotas** - Veterinaria, peluquería canina, paseos, etc.
10. **Jardinería** - Mantenimiento de jardines, poda, paisajismo, etc.

## 🔄 Flujo de Reservas

1. **Cliente** busca y selecciona un servicio
2. **Cliente** completa el formulario de reserva (fecha, hora, dirección)
3. La reserva se crea con estado **PENDING**
4. **Socio** ve la reserva y puede:
   - Confirmar → Estado cambia a **CONFIRMED**
   - Rechazar → Estado cambia a **CANCELLED**
5. **Socio** inicia el servicio → Estado cambia a **IN_PROGRESS**
6. **Socio** completa el servicio → Estado cambia a **COMPLETED**

## 📊 API Routes

- `GET /api/services` - Listar servicios (con filtros)
- `GET /api/services/[slug]` - Detalle de servicio
- `GET /api/categories` - Listar categorías
- `GET /api/bookings` - Listar reservas del usuario
- `POST /api/bookings` - Crear nueva reserva
- `PATCH /api/bookings/[id]` - Actualizar estado de reserva
- `DELETE /api/bookings/[id]` - Cancelar reserva
- `POST /api/register` - Registrar nuevo usuario

## 🗄️ Modelos de Base de Datos

- **User** - Usuarios (clientes, socios, admins)
- **PartnerProfile** - Perfil extendido para socios
- **Category** - Categorías de servicios
- **Service** - Servicios disponibles
- **PartnerService** - Relación entre socios y servicios que ofrecen
- **Availability** - Disponibilidad de socios
- **Booking** - Reservas de servicios

## 🚀 Despliegue

### Vercel (Recomendado)

1. Subir el código a GitHub
2. Conectar el repositorio en Vercel
3. Configurar las variables de entorno
4. Desplegar

### Otras Plataformas

El proyecto es compatible con cualquier plataforma que soporte Next.js:
- Railway
- Render
- DigitalOcean
- AWS
- etc.

## 📝 Scripts Disponibles

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Construir para producción
npm run start        # Iniciar servidor de producción
npm run lint         # Ejecutar linter
npx prisma studio    # Abrir interfaz visual de la base de datos
npx prisma db seed   # Poblar base de datos con datos iniciales
```

## 🎯 Próximas Mejoras

- [ ] Sistema de calificaciones y reseñas
- [ ] Chat en tiempo real entre cliente y socio
- [ ] Notificaciones push
- [ ] Pagos integrados (Stripe, PayPal)
- [ ] Geolocalización de socios cercanos
- [ ] Historial de servicios
- [ ] Sistema de cupones y descuentos
- [ ] App móvil nativa (React Native)

## 📄 Licencia

MIT

## 👨‍💻 Autor

ServiciosApp - Plataforma de Servicios
