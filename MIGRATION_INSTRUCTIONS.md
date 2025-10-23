# Migración Manual de Base de Datos en Supabase

## Opción 1: Si ya ejecutaste full_migration.sql (RECOMENDADO)

Si ya ejecutaste `full_migration.sql` y tienes datos en la base de datos, solo necesitas agregar las columnas faltantes:

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en **SQL Editor**
4. Copia TODO el contenido del archivo `add_missing_columns.sql`
5. Pégalo en el SQL Editor
6. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)

Luego continúa con el **Paso 3** más abajo.

---

## Opción 2: Si NO has ejecutado ninguna migración (Empezar desde cero)

### Paso 1: Accede al SQL Editor de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en **SQL Editor**

### Paso 2: Ejecuta el SQL de migración

1. Copia TODO el contenido del archivo `full_migration.sql` (actualizado)
2. Pégalo en el SQL Editor
3. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)

### Paso 3: Verifica que las tablas se crearon

1. En el menú lateral, haz clic en **Table Editor**
2. Deberías ver las tablas creadas

---

## Paso 3: Ejecuta el seed (datos iniciales)

Copia y ejecuta este SQL en el SQL Editor para agregar categorías y servicios:

1. Copia TODO el contenido del archivo `seed_complete.sql`
2. Pégalo en el SQL Editor
3. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)

---

## Paso 4: Redeploy en Vercel

Después de ejecutar las migraciones y el seed:

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto **lohaggo**
3. Ve a **Deployments**
4. Click en los 3 puntos del último deployment
5. Click en **Redeploy**

---

## Verificación

Después de ejecutar las migraciones y el redeploy:
1. Ve a https://lohaggo.vercel.app/
2. La página debería cargar correctamente
3. Podrás registrar usuarios sin errores

---

## Credenciales de prueba (después del seed)

**Admin:**
- Email: `admin@servicios.com`
- Password: `password123`

**Cliente:**
- Email: `cliente@test.com`
- Password: `password123`

**Socio:**
- Email: `socio1@test.com` (o socio2, socio3, etc. hasta socio10)
- Password: `password123`
