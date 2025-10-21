# 🚀 Inicio Rápido - ServiciosApp

## Opción 1: Instalación Automática (Linux/Mac)

```bash
chmod +x setup.sh
./setup.sh
npm run dev
```

## Opción 2: Instalación Manual

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copia el archivo `.env.example` a `.env` y actualiza los valores:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de PostgreSQL:
```env
DATABASE_URL="postgresql://tu_usuario:tu_contraseña@localhost:5432/servicios_db"
NEXTAUTH_SECRET="genera-un-secreto-con-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Configurar PostgreSQL

Asegúrate de tener PostgreSQL instalado y corriendo, luego crea la base de datos:

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE servicios_db;

# Salir
\q
```

### 4. Configurar Prisma y poblar datos

```bash
# Crear las tablas en la base de datos
npx prisma db push

# Poblar con datos iniciales (50 servicios, usuarios de prueba)
npx prisma db seed
```

### 5. Iniciar el servidor

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 👥 Usuarios de Prueba

Después del seed, usa estos usuarios para probar:

| Rol | Email | Contraseña |
|-----|-------|------------|
| Cliente | cliente@test.com | password123 |
| Socio | socio1@test.com | password123 |
| Admin | admin@servicios.com | password123 |

## 🎯 Primeros Pasos

1. **Como Cliente:**
   - Inicia sesión con `cliente@test.com`
   - Explora los servicios en `/servicios`
   - Haz una reserva
   - Ve tus reservas en `/dashboard`

2. **Como Socio:**
   - Inicia sesión con `socio1@test.com`
   - Ve las reservas de clientes en `/partner`
   - Confirma, inicia y completa servicios

3. **Como Admin:**
   - Inicia sesión con `admin@servicios.com`
   - Ve estadísticas generales en `/admin`
   - Gestiona todas las reservas

## 🛠️ Comandos Útiles

```bash
# Ver la base de datos visualmente
npx prisma studio

# Reiniciar la base de datos
npx prisma db push --force-reset
npx prisma db seed

# Construir para producción
npm run build
npm run start

# Linter
npm run lint
```

## ⚠️ Solución de Problemas

### Error de conexión a la base de datos
- Verifica que PostgreSQL esté corriendo
- Verifica las credenciales en `.env`
- Asegúrate de que la base de datos existe

### Error "NEXTAUTH_SECRET"
- Genera un secreto: `openssl rand -base64 32`
- Agrégalo a `.env`

### Error al hacer seed
- Ejecuta: `npx prisma db push --force-reset`
- Luego: `npx prisma db seed`

## 📚 Más Información

Consulta el [README.md](README.md) para documentación completa.
