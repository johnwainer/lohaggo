# Solución: Error de conexión a base de datos en Vercel

## Error actual
```
Can't reach database server at `aws-1-us-east-1.pooler.supabase.com:6543`
```

## Causas posibles

### 1. Base de datos pausada (Supabase Free Tier)
Supabase pausa las bases de datos inactivas después de 7 días en el plan gratuito.

**Solución:**
1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Si ves un mensaje de "Database paused", haz clic en "Resume"
3. Espera unos minutos a que la base de datos se active
4. Verifica la conexión

### 2. Variable DATABASE_URL incorrecta en Vercel
La URL de conexión puede haber cambiado o estar mal configurada.

**Solución:**
1. Ve a tu proyecto en Supabase → Settings → Database
2. Copia la **Connection String** (modo: Transaction o Session)
3. Ve a Vercel → Settings → Environment Variables
4. Actualiza `DATABASE_URL` con la nueva URL
5. Redeploy el proyecto

### 3. Migración de base de datos no aplicada
La tabla `RequestPhoto` puede no existir en producción.

**Solución:**
1. Conéctate a tu base de datos de producción:
   ```bash
   # Opción 1: Desde Supabase SQL Editor
   # Ve a Supabase Dashboard → SQL Editor
   # Ejecuta la migración manualmente
   ```

2. O aplica la migración desde tu local:
   ```bash
   # Configura DATABASE_URL temporalmente con la URL de producción
   npx prisma migrate deploy
   ```

### 4. Firewall o restricciones de red
Supabase puede tener restricciones de IP.

**Solución:**
1. Ve a Supabase → Settings → Database → Connection Pooling
2. Asegúrate de que "Connection Pooling" esté habilitado
3. Usa la URL de Connection Pooling en Vercel (puerto 6543)
4. Verifica que no haya restricciones de IP

## Pasos recomendados (en orden)

### Paso 1: Verificar estado de Supabase
1. Abre [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Verifica si está pausado o activo
4. Si está pausado, actívalo

### Paso 2: Verificar migración de base de datos
1. Ve a Supabase → SQL Editor
2. Ejecuta esta consulta para verificar si la tabla existe:
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'RequestPhoto'
   );
   ```
3. Si retorna `false`, ejecuta la migración:
   ```sql
   -- Copia el contenido de: prisma/migrations/20251023190836_add_request_photos/migration.sql
   CREATE TABLE "RequestPhoto" (
       "id" TEXT NOT NULL,
       "serviceRequestId" TEXT NOT NULL,
       "url" TEXT NOT NULL,
       "publicId" TEXT,
       "order" INTEGER NOT NULL DEFAULT 0,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

       CONSTRAINT "RequestPhoto_pkey" PRIMARY KEY ("id")
   );

   CREATE INDEX "RequestPhoto_serviceRequestId_idx" ON "RequestPhoto"("serviceRequestId");

   ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_serviceRequestId_fkey" 
   FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") 
   ON DELETE CASCADE ON UPDATE CASCADE;
   ```

### Paso 3: Verificar variables de entorno en Vercel
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que existan:
   - `DATABASE_URL` (debe apuntar a Supabase con puerto 6543)
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`

### Paso 4: Redeploy
1. Ve a Vercel → Deployments
2. Haz clic en los 3 puntos del último deployment
3. Selecciona "Redeploy"
4. Espera a que termine el deploy
5. Verifica los logs

## Verificación de la URL de conexión

Tu URL de Supabase debe verse así:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Importante:**
- Usa el puerto **6543** (Connection Pooling) para Vercel
- Incluye `?pgbouncer=true` al final
- Asegúrate de que la contraseña sea correcta

## Comandos útiles

### Verificar conexión local
```bash
# Prueba la conexión desde tu máquina local
npx prisma db pull
```

### Ver estado de migraciones
```bash
npx prisma migrate status
```

### Aplicar migraciones pendientes
```bash
npx prisma migrate deploy
```

## Logs de Vercel

Para ver más detalles del error:
1. Ve a Vercel → Deployments → [último deploy]
2. Haz clic en "View Function Logs"
3. Busca errores relacionados con Prisma o base de datos

## Contacto con soporte

Si el problema persiste:
- **Supabase Support**: https://supabase.com/dashboard/support
- **Vercel Support**: https://vercel.com/help

## Checklist de verificación

- [ ] Base de datos de Supabase está activa (no pausada)
- [ ] Variable `DATABASE_URL` está configurada en Vercel
- [ ] URL de conexión usa puerto 6543 (Connection Pooling)
- [ ] Migración `add_request_photos` está aplicada en producción
- [ ] Variables de Cloudinary están configuradas en Vercel
- [ ] Último deploy fue exitoso
- [ ] No hay errores en los logs de Vercel

## Próximos pasos después de solucionar

Una vez que la base de datos esté accesible:
1. Verifica que la app cargue correctamente
2. Prueba crear una solicitud de servicio con fotos
3. Verifica que las fotos se suban a Cloudinary
4. Confirma que las fotos se muestren correctamente
