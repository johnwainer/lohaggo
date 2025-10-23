# Haggo - Plataforma de Servicios

Una plataforma moderna para solicitar servicios (plomería, limpieza, electricidad, etc.) con paneles para clientes, socios y administradores.

## 🚀 Características

- **50+ Servicios** organizados en 10 categorías
- **3 Tipos de Usuarios**: Clientes, Socios (Proveedores) y Administradores
- **Sistema de Solicitudes**: Los clientes publican solicitudes y los partners envían propuestas
- **Subida de Fotos**: Los clientes pueden adjuntar fotos a sus solicitudes
- **Notificaciones en Tiempo Real**: Sistema de notificaciones push
- **Gestión de Direcciones**: Los clientes pueden guardar múltiples direcciones
- **Autenticación** con NextAuth.js
- **Diseño Moderno** inspirado en Uber y Rappi
- **Responsive** - Funciona en móviles, tablets y desktop

## 🛠️ Tecnologías

- **Next.js 14** (App Router)
- **TypeScript**
- **Prisma** (ORM)
- **PostgreSQL** (Base de datos)
- **Supabase** (Base de datos en producción)
- **Cloudinary** (Almacenamiento de imágenes)
- **NextAuth.js** (Autenticación)
- **Tailwind CSS** (Estilos)

## 📋 Requisitos Previos

- Node.js 18+ instalado
- PostgreSQL instalado (para desarrollo local) o cuenta de Supabase
- Cuenta de Cloudinary (para subida de fotos)
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

### 1. Configurar Base de Datos (Supabase)

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a Settings → Database y copia la **Connection String** (modo: Transaction)
3. Ejecuta el archivo `database_migration.sql` en el SQL Editor de Supabase

### 2. Configurar Cloudinary

1. Crea una cuenta en [Cloudinary](https://cloudinary.com)
2. Ve a Dashboard y copia:
   - Cloud Name
   - API Key
   - API Secret

### 3. Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
NEXTAUTH_SECRET=tu-secreto-super-seguro-aqui
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
```

**Importante**: Marca las 3 opciones (Production, Preview, Development) para cada variable.

### 4. Deploy

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

## 📱 Estructura de la Aplicación

### Páginas Públicas
- `/` - Página principal con categorías y servicios populares
- `/servicios` - Catálogo completo de servicios con búsqueda y filtros
- `/servicios/[slug]` - Detalle de servicio con formulario de solicitud
- `/login` - Inicio de sesión
- `/register` - Registro de nuevos usuarios

### Paneles Privados
- `/dashboard` - Panel de cliente (crear solicitudes, ver propuestas)
- `/dashboard/addresses` - Gestión de direcciones guardadas
- `/partner` - Panel de socio (ver solicitudes, enviar propuestas)
- `/admin` - Panel administrativo (estadísticas y gestión completa)

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

- `database_migration.sql` - Migración completa de base de datos con datos iniciales
- `prisma/schema.prisma` - Esquema de la base de datos
- `.env.local` - Variables de entorno locales (no incluido en git)
- `ARCHITECTURE.md` - Documentación de la arquitectura del proyecto

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

# Linting y formato
npm run lint             # Ejecutar linter
```

## 🐛 Troubleshooting

### Error de conexión a base de datos en Vercel

Si ves el error `Can't reach database server`:

1. Verifica que tu base de datos de Supabase esté activa (no pausada)
2. Asegúrate de usar el puerto 6543 (Connection Pooling) en la URL
3. Verifica que todas las variables de entorno estén configuradas en Vercel
4. Ejecuta el archivo `database_migration.sql` en Supabase SQL Editor

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

## 📄 Licencia

Este proyecto es privado y confidencial.

## 🤝 Soporte

Para soporte, contacta al equipo de desarrollo.
