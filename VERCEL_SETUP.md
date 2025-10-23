# Configuración de Variables de Entorno en Vercel

## ⚠️ IMPORTANTE: Pasos para configurar las variables de entorno

### 1. Accede a la configuración de tu proyecto en Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto "lohaggo"
3. Ve a **Settings** (en la parte superior)
4. En el menú lateral, selecciona **Environment Variables**

### 2. Agrega TODAS estas variables (una por una):

**CRÍTICO:** Asegúrate de copiar EXACTAMENTE cada valor, incluyendo las comillas si las hay.

#### Variable 1: DATABASE_URL
```
Name: DATABASE_URL
Value: postgres://postgres.kcuwlsfdqpjjondzgdqp:0G4CoVdDPNk9GCjG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 2: NEXTAUTH_SECRET
```
Name: NEXTAUTH_SECRET
Value: 9UBMCPRx5bMxzNZIDXGRQ5qaxt6+QGrE0lvz4aKwtkQ=
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 3: NEXTAUTH_URL
```
Name: NEXTAUTH_URL
Value: https://lohaggo.vercel.app
Environments: ✅ Production (solo Production)
```

#### Variable 4: SUPABASE_URL
```
Name: SUPABASE_URL
Value: https://kcuwlsfdqpjjondzgdqp.supabase.co
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 5: SUPABASE_ANON_KEY
```
Name: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTM1MjEsImV4cCI6MjA3Njc4OTUyMX0.oZJ9PH925a49KVCtosZDqs-Z-DnciQLTvWTQC6hU5N0
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 6: SUPABASE_SERVICE_ROLE_KEY
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxMzUyMSwiZXhwIjoyMDc2Nzg5NTIxfQ.LLwc8kYmVuT3yNZl5TUUm4CoB4FQ_qDXBVy0u5opm0g
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 7: NEXT_PUBLIC_SUPABASE_URL
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://kcuwlsfdqpjjondzgdqp.supabase.co
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 8: NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXdsc2ZkcXBqam9uZHpnZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTM1MjEsImV4cCI6MjA3Njc4OTUyMX0.oZJ9PH925a49KVCtosZDqs-Z-DnciQLTvWTQC6hU5N0
Environments: ✅ Production ✅ Preview ✅ Development
```

### 3. Verificar que las variables se guardaron

1. Después de agregar cada variable, verifica que aparezca en la lista
2. Asegúrate de que `DATABASE_URL` esté presente y visible
3. Si alguna variable no se guardó, agrégala de nuevo

### 4. Hacer un Redeploy

**IMPORTANTE:** Después de agregar TODAS las variables, debes hacer un redeploy:

1. Ve a la pestaña **Deployments**
2. Encuentra el último deployment
3. Click en los tres puntos (⋯) a la derecha
4. Selecciona **Redeploy**
5. Confirma el redeploy

### 5. Migrar la Base de Datos (SOLO UNA VEZ)

Antes o después del primer deploy exitoso, ejecuta las migraciones:

```bash
chmod +x migrate-supabase.sh
./migrate-supabase.sh
```

O manualmente:

```bash
export DATABASE_URL="postgres://postgres.kcuwlsfdqpjjondzgdqp:0G4CoVdDPNk9GCjG@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
npx prisma migrate deploy
npx prisma generate
```

## Verificar el Deploy

Después del redeploy, verifica:

1. ✅ La aplicación carga sin errores
2. ✅ Puedes ver la página principal
3. ✅ No hay errores en los Runtime Logs de Vercel
4. ✅ Puedes hacer login (después de migrar la BD)

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

**Solución:**
1. Ve a Settings → Environment Variables en Vercel
2. Verifica que `DATABASE_URL` esté presente
3. Si no está, agrégala de nuevo
4. Asegúrate de seleccionar **Production** en los ambientes
5. Haz un **Redeploy** completo (no solo "Retry")

### Error: "PrismaClientInitializationError"

**Solución:**
1. Verifica que todas las variables de entorno estén configuradas
2. Haz un redeploy completo
3. Ejecuta las migraciones de la base de datos

### La página muestra "Application error"

**Solución:**
1. Ve a la pestaña **Runtime Logs** en Vercel
2. Busca el error específico
3. Verifica que `DATABASE_URL` esté configurada
4. Haz un redeploy después de verificar las variables

## Notas Importantes

- **NO** subas el archivo `.env.production` a Git (ya está en `.gitignore`)
- Tu base de datos local (`.env`) no se verá afectada
- Las variables de entorno en Vercel son independientes de tu entorno local
- Después de agregar variables, SIEMPRE haz un redeploy completo
